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
import { generateAiReply, aiIsConfigured } from './lib/ai-client.js'
import { config } from './config.js'
import { CommandRegistry } from './lib/command-registry.js'
import {
  getChatJid,
  getSenderJid,
  normalizeJid,
  toMention,
} from './lib/group-utils.js'
import { startHealthServer } from './lib/health-server.js'
import { logger } from './lib/logger.js'
import { cleanNumber, extractText, isOwner } from './lib/message-utils.js'
import { GroupSettingsStore } from './lib/settings-store.js'
import { SystemSettingsStore } from './lib/system-settings-store.js'
import { UserStore } from './lib/user-store.js'
import { renderWelcomeCard } from './lib/welcome-card.js'

const registry = new CommandRegistry()
const groupSettings = new GroupSettingsStore(new URL('../data/group-settings.json', import.meta.url))
const systemSettings = new SystemSettingsStore(
  new URL('../data/system-settings.json', import.meta.url),
)
const userStore = new UserStore(new URL('../data/users.json', import.meta.url))
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
const antiSpamState = new Map()

function extractContextInfo(payload) {
  if (!payload) {
    return null
  }

  if (payload.message) {
    return extractContextInfo(payload.message)
  }

  if (payload.ephemeralMessage?.message) {
    return extractContextInfo(payload.ephemeralMessage.message)
  }

  if (payload.viewOnceMessage?.message) {
    return extractContextInfo(payload.viewOnceMessage.message)
  }

  return (
    payload.extendedTextMessage?.contextInfo ||
    payload.imageMessage?.contextInfo ||
    payload.videoMessage?.contextInfo ||
    payload.documentMessage?.contextInfo ||
    null
  )
}

function containsLink(text) {
  return /(?:https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|instagram\.com\/|youtu(?:\.be|be\.com)\/)/i.test(
    text,
  )
}

function shouldTriggerAutoAi(message, body, sock) {
  const chatJid = getChatJid(message)
  if (!chatJid.endsWith('@g.us')) {
    return false
  }

  const contextInfo = extractContextInfo(message)
  const mentioned = contextInfo?.mentionedJid || []
  if (mentioned.some((jid) => normalizeJid(jid) === normalizeJid(sock.user?.id))) {
    return true
  }

  const lowered = body.toLowerCase()
  const botName = config.botName.toLowerCase()
  return (
    lowered.startsWith(`${botName} `) ||
    lowered.startsWith(`${botName},`) ||
    lowered.startsWith('bot ') ||
    lowered.startsWith('bot,')
  )
}

function buildAiPrompt(body) {
  return body
    .replace(new RegExp(`^${config.botName}\\s*[:,-]?\\s*`, 'i'), '')
    .replace(/^bot\s*[:,-]?\s*/i, '')
    .trim()
}

function containsBadWord(text, badWords = []) {
  const normalized = String(text || '').toLowerCase()
  return badWords.find((word) => normalized.includes(word)) || null
}

function trackSpamActivity(chatJid, sender, isCommand) {
  const key = `${chatJid}:${normalizeJid(sender)}`
  const now = Date.now()
  const existing = antiSpamState.get(key) || {
    messages: [],
    commands: [],
    mutedUntil: 0,
    lastNoticeAt: 0,
  }

  existing.messages = existing.messages.filter((stamp) => now - stamp < 10000)
  existing.commands = existing.commands.filter((stamp) => now - stamp < 10000)

  existing.messages.push(now)
  if (isCommand) {
    existing.commands.push(now)
  }

  antiSpamState.set(key, existing)
  return existing
}

async function ensurePairingCode(sock) {
  if (!config.usePairingCode || sock.authState.creds.registered) {
    return
  }

  const phoneNumber = cleanNumber(config.pairingNumber)
  if (!phoneNumber) {
    logger.warn(
      `PAIRING_NUMBER belum diisi. Minta kode lokal lewat http://127.0.0.1:${config.healthPort}/pairing?phone=628...`,
    )
    return
  }

  const pairingCode = await requestPairingCode(phoneNumber)
  logger.success(`Kode pairing: ${pairingCode}`)
}

async function requestPairingCode(phoneNumber) {
  const sock = runtime.sock
  if (!sock) {
    throw new Error('Socket belum siap.')
  }

  const sanitized = cleanNumber(phoneNumber || config.pairingNumber)
  if (!sanitized) {
    throw new Error('Nomor telepon wajib diisi.')
  }

  if (sock.authState.creds.registered) {
    runtime.registered = true
    return 'sudah-terdaftar'
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
      message: 'Reset sudah dijadwalkan.',
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
    message: 'Sesi dihapus. Bot akan restart sebentar lagi.',
    restartScheduled: true,
    clearedSession: true,
  }
}

async function resetSession() {
  await clearSessionFiles()

  return scheduleRestart('Reset sesi diminta. Bot sedang restart...', 'manual-reset')
}

async function handleGroupParticipantsUpdate(sock, event) {
  const settings = groupSettings.get(event.id)
  const shouldWelcome = event.action === 'add' && settings.welcome
  const shouldGoodbye = event.action === 'remove' && settings.goodbye

  if (!shouldWelcome && !shouldGoodbye) {
    return
  }

  try {
    const metadata = await sock.groupMetadata(event.id)
    const mentions = event.participants || []
    const names = mentions.map((jid) => toMention(jid)).join(', ')
    const subject = metadata.subject || 'Grup WhatsApp'
    const lead = mentions[0] || ''
    const avatarUrl =
      mentions.length === 1
        ? await sock.profilePictureUrl(lead, 'image').catch(() => null)
        : null

    const card = await renderWelcomeCard({
      avatarUrl,
      handle: mentions.length === 1 ? toMention(lead) : `${mentions.length} anggota`,
      kind: shouldWelcome ? 'welcome' : 'goodbye',
      subject,
      title: shouldWelcome
        ? mentions.length === 1
          ? 'Masuk dan langsung siap ngobrol'
          : `${mentions.length} anggota baru bergabung`
        : mentions.length === 1
          ? 'Terima kasih sudah pernah mampir'
          : `${mentions.length} anggota keluar`,
    })

    await sock.sendMessage(event.id, {
      image: card,
      caption: shouldWelcome
        ? `Halo ${names}\nSelamat datang di *${subject}*.`
        : `Sampai jumpa ${names}\nTerima kasih sudah pernah jadi bagian dari *${subject}*.`,
      mentions,
    })
  } catch (error) {
    logger.warn(`Hook peserta grup gagal: ${error.message}`)
  }
}

async function getParticipantState(sock, chatJid, sender) {
  const metadata = await sock.groupMetadata(chatJid)
  const participants = metadata.participants || []
  const member = participants.find((entry) => normalizeJid(entry.id) === normalizeJid(sender))
  const botMember = participants.find(
    (entry) => normalizeJid(entry.id) === normalizeJid(sock.user?.id),
  )

  return {
    metadata,
    senderAdmin: Boolean(member?.admin),
    botAdmin: Boolean(botMember?.admin),
  }
}

async function handleAntiLink({ body, message, owner, reply, sock }) {
  const chatJid = getChatJid(message)
  if (!chatJid.endsWith('@g.us')) {
    return false
  }

  const settings = groupSettings.get(chatJid)
  if (settings.antiLink === 'off' || !containsLink(body)) {
    return false
  }

  const sender = getSenderJid(message)
  const { senderAdmin, botAdmin } = await getParticipantState(sock, chatJid, sender)

  if (owner || senderAdmin) {
    return false
  }

  if (settings.antiLink === 'kick' && botAdmin) {
    await sock.groupParticipantsUpdate(chatJid, [sender], 'remove')
    await reply(`Link terdeteksi. ${toMention(sender)} dikeluarkan karena anti-link aktif.`)
    return true
  }

  await reply(
    `Link terdeteksi dari ${toMention(sender)}. Anti-link aktif di grup ini${botAdmin ? '.' : ', tapi bot belum jadi admin jadi hanya bisa kasih peringatan.'}`,
  )
  return true
}

async function handleAutoResponder({ body, message, reply }) {
  const chatJid = getChatJid(message)
  if (!chatJid.endsWith('@g.us')) {
    return false
  }

  const settings = groupSettings.get(chatJid)
  if (!settings.autoResponder) {
    return false
  }

  const normalized = body.trim().toLowerCase()
  const matched = settings.autoReplies[normalized]
  if (!matched) {
    return false
  }

  await reply(matched)
  return true
}

async function handleAutoAi({ body, message, reply, sock }) {
  const chatJid = getChatJid(message)
  if (!chatJid.endsWith('@g.us')) {
    return false
  }

  const settings = groupSettings.get(chatJid)
  if (!settings.aiReply || !aiIsConfigured(config) || !shouldTriggerAutoAi(message, body, sock)) {
    return false
  }

  const prompt = buildAiPrompt(body)
  if (!prompt || prompt.length < 3) {
    return false
  }

  const metadata = await sock.groupMetadata(chatJid).catch(() => null)
  const sender = getSenderJid(message)
  const result = await generateAiReply({
    config,
    prompt,
    context: [
      `Grup: ${metadata?.subject || chatJid}`,
      `Pengirim: ${toMention(sender)}`,
      `Balas dalam bahasa Indonesia.`,
    ].join('\n'),
  })

  await reply(result)
  return true
}

async function handleAntiBadword({ body, message, owner, reply, sock }) {
  const chatJid = getChatJid(message)
  if (!chatJid.endsWith('@g.us')) {
    return false
  }

  const settings = groupSettings.get(chatJid)
  if (!settings.antiBadword || !settings.badWords.length) {
    return false
  }

  const sender = getSenderJid(message)
  const { senderAdmin } = await getParticipantState(sock, chatJid, sender)
  if (owner || senderAdmin) {
    return false
  }

  const matched = containsBadWord(body, settings.badWords)
  if (!matched) {
    return false
  }

  await userStore.touch(sender, {
    warning: true,
  })

  await reply(`🚫 Kata *${matched}* terdeteksi. Jaga obrolan tetap rapi ya ${toMention(sender)}.`)
  return true
}

async function handleAntiSpam({ body, isCommand, message, owner, reply, sock }) {
  const chatJid = getChatJid(message)
  if (!chatJid.endsWith('@g.us') || !body) {
    return false
  }

  const settings = groupSettings.get(chatJid)
  if (!settings.antiSpam) {
    return false
  }

  const sender = getSenderJid(message)
  const { senderAdmin } = await getParticipantState(sock, chatJid, sender)
  if (owner || senderAdmin) {
    return false
  }

  const record = trackSpamActivity(chatJid, sender, isCommand)
  const now = Date.now()

  if (record.mutedUntil > now) {
    if (now - record.lastNoticeAt > 10000) {
      record.lastNoticeAt = now
      await reply(`🚦 ${toMention(sender)} terlalu cepat kirim pesan. Coba lagi beberapa saat ya.`)
    }
    return true
  }

  if (record.messages.length >= 7 || record.commands.length >= 4) {
    record.mutedUntil = now + 30000
    record.lastNoticeAt = now
    await reply(
      `🚦 Anti-spam aktif. ${toMention(sender)} kena cooldown 30 detik karena kirim terlalu cepat.`,
    )
    return true
  }

  return false
}

async function trackUserProgress({ isCommand, message, reply }) {
  const sender = getSenderJid(message)
  if (!sender || message.key.fromMe || sender === 'status@broadcast') {
    return
  }

  const user = userStore.get(sender)
  const xpGain = (isCommand ? 8 : 3) + (user.premium ? 4 : 0)
  const updated = await userStore.touch(sender, {
    message: true,
    command: isCommand,
    xpGain,
  })

  if (updated.leveledUp) {
    await reply(
      `🎉 Selamat ${toMention(sender)}! Level kamu naik ke *${updated.level}*${updated.premium ? ' dengan bonus premium ⭐' : ''}.`,
    )
  }
}

async function handleCallProtection(sock, calls = []) {
  const settings = systemSettings.get()
  if (!settings.antiCall) {
    return
  }

  for (const call of calls) {
    if (!call || call.status !== 'offer' || call.isGroup) {
      continue
    }

    try {
      await sock.rejectCall(call.id, call.from)
      await userStore.touch(call.from, {
        warning: true,
      })
      await sock.sendMessage(call.from, {
        text: [
          '📵 *ANTI-CALL AKTIF*',
          '',
          'Bot ini tidak menerima telepon suara/video.',
          `Silakan pakai chat biasa dengan prefix *${config.prefix}* ya.`,
        ].join('\n'),
      })
    } catch (error) {
      logger.warn(`Anti-call gagal untuk ${call.from}: ${error.message}`)
    }
  }
}

async function boot() {
  await groupSettings.load()
  await systemSettings.load()
  await userStore.load()
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
      logger.info('Menghubungkan ke WhatsApp...')
    }

    if (connection === 'open') {
      state.connection = 'open'
      state.lastConnectedAt = new Date().toISOString()
      state.lastDisconnectReason = null
      runtime.registered = true
      runtime.latestQr = null
      runtime.latestQrAt = null
      logger.success(`${config.botName} berhasil terhubung.`)
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
          'Sesi logout terdeteksi. File sesi dibersihkan lalu bot restart untuk pairing ulang.',
          'logged-out',
        )
        return
      }

      logger.warn('Koneksi tertutup. Coba sambung ulang dalam 3 detik...')
      setTimeout(() => {
        boot().catch((error) => {
          logger.error(`Reconnect gagal: ${error.message}`)
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
    const sender = message.key.participant || message.key.remoteJid || ''
    const owner = isOwner(sender, config) || message.key.fromMe

    if (config.botMode === 'private' && !owner) {
      return
    }

    const reply = async (text) =>
      sock.sendMessage(message.key.remoteJid, { text }, { quoted: message })

    try {
      await trackUserProgress({
        isCommand: body.startsWith(config.prefix),
        message,
        reply,
      })
    } catch (error) {
      logger.warn(`Tracking user gagal: ${error.message}`)
    }

    try {
      const blockedBySpam = await handleAntiSpam({
        body,
        isCommand: body.startsWith(config.prefix),
        message,
        owner,
        reply,
        sock,
      })
      if (blockedBySpam) {
        return
      }
    } catch (error) {
      logger.warn(`Anti-spam gagal: ${error.message}`)
    }

    if (body.startsWith(config.prefix)) {
      const commandLine = body.slice(config.prefix.length).trim()
      if (!commandLine) {
        return
      }

      const [rawName, ...args] = commandLine.split(/\s+/)
      const command = registry.get(rawName.toLowerCase())
      if (!command) {
        return
      }

      if (command.ownerOnly && !owner) {
        await reply('Perintah ini khusus owner.')
        return
      }

      try {
        await command.execute({
          args,
          body,
          config,
          groupSettings,
        message,
        owner,
        registry,
        reply,
        sock,
        state,
        systemSettings,
        userStore,
      })
      state.commandCount = registry.count()
      } catch (error) {
        logger.error(`Command ${command.name} gagal: ${error.message}`)
        await reply(`Perintah gagal: ${error.message}`)
      }
      return
    }

    if (!body || message.key.fromMe) {
      return
    }

    try {
      const stoppedByAntiLink = await handleAntiLink({
        body,
        message,
        owner,
        reply,
        sock,
      })
      if (stoppedByAntiLink) {
        return
      }

      const stoppedByBadword = await handleAntiBadword({
        body,
        message,
        owner,
        reply,
        sock,
      })
      if (stoppedByBadword) {
        return
      }

      const autoReplied = await handleAutoResponder({
        body,
        message,
        reply,
      })
      if (autoReplied) {
        return
      }

      await handleAutoAi({
        body,
        message,
        reply,
        sock,
      })
    } catch (error) {
      logger.warn(`Otomasi pesan gagal: ${error.message}`)
    }
  })

  sock.ev.on('group-participants.update', async (event) => {
    await handleGroupParticipantsUpdate(sock, event)
  })

  sock.ev.on('call', async (calls) => {
    await handleCallProtection(sock, calls)
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
  logger.error(`Boot gagal: ${error.message}`)
  process.exitCode = 1
})
