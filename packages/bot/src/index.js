import process from 'node:process'
import { readdir, rm } from 'node:fs/promises'
import qrcode from 'qrcode-terminal'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import { config } from './config.js'
import { CommandRegistry } from './lib/command-registry.js'
import { startHealthServer } from './lib/health-server.js'
import { logger } from './lib/logger.js'
import { cleanNumber, extractText, isOwner } from './lib/message-utils.js'

const registry = new CommandRegistry()
const state = {
  commandCount: 0,
  connection: 'booting',
  lastConnectedAt: null,
  lastDisconnectReason: null,
}
const runtime = {
  registered: false,
  lastPairingCode: null,
  lastPairingRequestAt: null,
  latestQr: null,
  latestQrAt: null,
  resetScheduled: false,
  sock: null,
}

async function ensurePairingCode(sock) {
  if (!config.usePairingCode || sock.authState.creds.registered) {
    return
  }

  let phoneNumber = cleanNumber(config.pairingNumber)
  if (!phoneNumber) {
    logger.warn(
      `No PAIRING_NUMBER configured. Request one locally at http://127.0.0.1:${config.healthPort}/pairing?phone=628...`,
    )
    return
  }

  const pairingCode = await requestPairingCode(phoneNumber)
  logger.success(`Pairing code: ${pairingCode}`)
}

async function requestPairingCode(phoneNumber) {
  const sock = runtime.sock
  if (!sock) {
    throw new Error('Socket is not ready yet.')
  }

  const sanitized = cleanNumber(phoneNumber || config.pairingNumber)
  if (!sanitized) {
    throw new Error('Phone number is required.')
  }

  if (sock.authState.creds.registered) {
    runtime.registered = true
    return 'already-registered'
  }

  const pairingCode = await sock.requestPairingCode(sanitized)
  runtime.lastPairingCode = pairingCode
  runtime.lastPairingRequestAt = new Date().toISOString()
  return pairingCode
}

async function clearSessionFiles() {
  const entries = await readdir(config.sessionDir, { withFileTypes: true }).catch(() => [])
  await Promise.all(
    entries
      .filter((entry) => entry.name !== '.gitkeep')
      .map((entry) =>
        rm(`${config.sessionDir}/${entry.name}`, {
          force: true,
          recursive: entry.isDirectory(),
        }),
      ),
  )
}

function scheduleRestart(message, reason) {
  if (runtime.resetScheduled) {
    return {
      message: 'Reset already scheduled.',
      restartScheduled: true,
      clearedSession: true,
    }
  }

  runtime.registered = false
  runtime.lastPairingCode = null
  runtime.lastPairingRequestAt = null
  runtime.latestQr = null
  runtime.latestQrAt = null
  runtime.resetScheduled = true
  state.connection = 'resetting'
  state.lastDisconnectReason = reason
  logger.warn(message)

  if (runtime.sock) {
    runtime.sock.end(new Error(message))
  }

  setTimeout(() => {
    process.exit(0)
  }, 300)

  return {
    message: 'Session cleared. Bot restart scheduled.',
    restartScheduled: true,
    clearedSession: true,
  }
}

async function resetSession() {
  await clearSessionFiles()

  return scheduleRestart('Session reset requested. Restarting bot process...', 'manual-reset')
}

async function boot() {
  await registry.load()
  state.commandCount = registry.count()

  const { state: authState, saveCreds } = await useMultiFileAuthState(config.sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    auth: authState,
    browser: Browsers.appropriate('Chrome'),
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    version,
  })
  runtime.sock = sock
  runtime.registered = Boolean(sock.authState.creds.registered)

  await ensurePairingCode(sock)

  sock.ev.on('creds.update', (...args) => {
    runtime.registered = Boolean(sock.authState.creds.registered)
    return saveCreds(...args)
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      runtime.latestQr = qr
      runtime.latestQrAt = new Date().toISOString()

      if (!config.usePairingCode) {
        qrcode.generate(qr, { small: true })
      }
    }

    if (connection === 'connecting') {
      state.connection = 'connecting'
      logger.info('Connecting to WhatsApp...')
    }

    if (connection === 'open') {
      state.connection = 'open'
      state.lastConnectedAt = new Date().toISOString()
      state.lastDisconnectReason = null
      runtime.registered = true
      runtime.latestQr = null
      runtime.latestQrAt = null
      logger.success(`${config.botName} is connected.`)
    }

    if (connection === 'close') {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.statusCode ||
        'unknown'

      state.connection = 'closed'
      state.lastDisconnectReason = String(statusCode)
      runtime.registered = Boolean(sock.authState.creds.registered)

      if (statusCode === DisconnectReason.loggedOut) {
        await clearSessionFiles()
        scheduleRestart(
          'Session logged out. Clearing session files and restarting for a fresh pairing state...',
          'logged-out',
        )
        return
      }

      logger.warn('Connection closed. Reconnecting in 3 seconds...')
      setTimeout(() => {
        boot().catch((error) => {
          logger.error(`Reconnect failed: ${error.message}`)
        })
      }, 3000)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') {
      return
    }

    const message = messages[0]
    if (!message?.message || message.key.remoteJid === 'status@broadcast') {
      return
    }

    const body = extractText(message).trim()
    if (!body.startsWith(config.prefix)) {
      return
    }

    const sender = message.key.participant || message.key.remoteJid || ''
    const owner = isOwner(sender, config) || message.key.fromMe

    if (config.botMode === 'private' && !owner) {
      return
    }

    const commandLine = body.slice(config.prefix.length).trim()
    if (!commandLine) {
      return
    }

    const [rawName, ...args] = commandLine.split(/\s+/)
    const command = registry.get(rawName.toLowerCase())
    if (!command) {
      return
    }

    const reply = async (text) =>
      sock.sendMessage(message.key.remoteJid, { text }, { quoted: message })

    if (command.ownerOnly && !owner) {
      await reply('This command is owner-only.')
      return
    }

    try {
      await command.execute({
        args,
        config,
        message,
        registry,
        reply,
        sock,
        state,
      })
    } catch (error) {
      logger.error(`Command ${command.name} failed: ${error.message}`)
      await reply(`Command failed: ${error.message}`)
    }
  })
}

startHealthServer(config, state, runtime, {
  requestPairingCode,
  resetSession,
  getCommands: () =>
    registry.list().map((entry) => ({
      name: entry.name,
      aliases: entry.aliases,
      category: entry.category,
      description: entry.description,
      ownerOnly: entry.ownerOnly,
    })),
})

boot().catch((error) => {
  logger.error(`Boot failed: ${error.message}`)
  process.exitCode = 1
})
