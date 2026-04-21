import readline from 'node:readline/promises'
import process from 'node:process'
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

function ask(question) {
  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return terminal.question(question).finally(() => terminal.close())
}

async function ensurePairingCode(sock) {
  if (!config.usePairingCode || sock.authState.creds.registered) {
    return
  }

  let phoneNumber = cleanNumber(config.pairingNumber)
  if (!phoneNumber) {
    phoneNumber = cleanNumber(await ask('Enter WhatsApp number for pairing: '))
  }

  if (!phoneNumber) {
    throw new Error('PAIRING_NUMBER is missing.')
  }

  const pairingCode = await sock.requestPairingCode(phoneNumber)
  logger.success(`Pairing code: ${pairingCode}`)
}

async function boot() {
  await registry.load()
  state.commandCount = registry.count()

  const { state: authState, saveCreds } = await useMultiFileAuthState(config.sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    auth: authState,
    browser: Browsers.macOS('Desktop'),
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    version,
  })

  await ensurePairingCode(sock)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && !config.usePairingCode) {
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'connecting') {
      state.connection = 'connecting'
      logger.info('Connecting to WhatsApp...')
    }

    if (connection === 'open') {
      state.connection = 'open'
      state.lastConnectedAt = new Date().toISOString()
      state.lastDisconnectReason = null
      logger.success(`${config.botName} is connected.`)
    }

    if (connection === 'close') {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.statusCode ||
        'unknown'

      state.connection = 'closed'
      state.lastDisconnectReason = String(statusCode)

      if (statusCode === DisconnectReason.loggedOut) {
        logger.error('Session logged out. Remove the session files and pair again.')
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

startHealthServer(config, state)

boot().catch((error) => {
  logger.error(`Boot failed: ${error.message}`)
  process.exitCode = 1
})
