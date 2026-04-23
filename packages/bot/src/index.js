import process from 'node:process'
import { readFile, readdir, rm } from 'node:fs/promises'
import qrcode from 'qrcode-terminal'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import { resolveAssistantReply } from './lib/assistant-reply.js'
import { AppDatabase } from './lib/app-database.js'
import { parseCommand } from './lib/command-parser.js'
import { config } from './config.js'
import { CommandRegistry } from './lib/command-registry.js'
import {
  getChatJid,
  getSenderJid,
  getSenderJids,
  isGroupJid,
  normalizeJid,
  resolveSenderJids,
  toMention,
} from './lib/group-utils.js'
import { startHealthServer } from './lib/health-server.js'
import { logger } from './lib/logger.js'
import { cleanNumber, extractText } from './lib/message-utils.js'
import { canManageSettings, getRole } from './lib/permissions.js'
import { SettingsService } from './lib/settings-service.js'
import { ToolRegistry } from './lib/tool-registry.js'
import { UserStore } from './lib/user-store.js'
import { renderWelcomeCard } from './lib/welcome-card.js'
import { buildWorkflowTrace, isInsideActiveHours } from './lib/workflow-engine.js'

const registry = new CommandRegistry()
const appDatabase = new AppDatabase(new URL('../data/app-database.json', import.meta.url))
const settingsService = new SettingsService(appDatabase, config)
const groupSettings = settingsService.createGroupSettingsAdapter()
const systemSettings = settingsService.createSystemSettingsAdapter()
const toolRegistry = new ToolRegistry(settingsService)
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

function resolveRegistered(sock) {
  return Boolean(
    sock?.authState?.creds?.registered ||
      sock?.user?.id ||
      sock?.authState?.creds?.me?.id,
  )
}

function buildRuntimeConfig() {
  const settings = settingsService.getSettings()

  return {
    ...config,
    prefix: settings.commandPrefixes?.[0] || config.prefix,
  }
}

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

function shouldTriggerSmartReply(message, body, sock) {
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

function buildSmartReplyPrompt(body) {
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

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function typingDelayForPayload(payload, settings) {
  const configuredDelay = Number(settings?.replyTiming?.delaySeconds || 0)
  if (settings?.replyTiming?.enabled) {
    return Math.max(0, configuredDelay) * 1000
  }

  const text = String(payload.text || payload.caption || '')
  if (!text) {
    return 600
  }

  return Math.min(2200, Math.max(700, text.length * 18))
}

async function showTyping(sock, chatJid, payload) {
  const delay = typingDelayForPayload(payload, settingsService.getSettings())
  await sock.presenceSubscribe?.(chatJid).catch(() => {})
  await sock.sendPresenceUpdate?.('composing', chatJid).catch(() => {})
  await wait(delay)
}

function createReply(sock, message, chatJid, senderJids) {
  return async (content) => {
    const payload = typeof content === 'string' ? { text: content } : { ...content }
    const mentions = new Set(payload.mentions || [])

    if (isGroupJid(chatJid) && !message.key.fromMe) {
      for (const jid of senderJids) {
        mentions.add(jid)
      }
    }

    await showTyping(sock, chatJid, payload)
    let sent
    try {
      sent = await sock.sendMessage(
        chatJid,
        {
          ...payload,
          ...(mentions.size ? { mentions: [...mentions] } : {}),
        },
        { quoted: message },
      )
    } finally {
      await sock.sendPresenceUpdate?.('paused', chatJid).catch(() => {})
    }

    await settingsService
      .logMessage({
        direction: 'out',
        chatJid,
        sender: 'bot',
        body: payload.text || payload.caption || '[media]',
        mode: 'reply',
        status: 'sent',
      })
      .catch((error) => logger.warn(`Log pesan keluar gagal: ${error.message}`))

    return sent
  }
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
    runtime.registered = resolveRegistered(sock)
    return 'sudah-terdaftar'
  }

  const lastRequestAt = runtime.lastPairingRequestAt
    ? new Date(runtime.lastPairingRequestAt).getTime()
    : 0
  if (runtime.lastPairingCode && Date.now() - lastRequestAt < 60000) {
    return runtime.lastPairingCode
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

async function logoutDevice() {
  const sock = runtime.sock
  let logoutSucceeded = false
  let logoutMessage = ''

  if (sock?.logout) {
    try {
      await sock.logout()
      logoutSucceeded = true
    } catch (error) {
      logoutMessage = error instanceof Error ? error.message : String(error)
      logger.warn(`Logout device gagal, sesi tetap akan dihapus: ${logoutMessage}`)
    }
  }

  await clearSessionFiles()
  const result = scheduleRestart(
    'Logout device diminta. Sesi WhatsApp dibersihkan lalu bot restart untuk pairing ulang.',
    'manual-logout',
  )

  return {
    ...result,
    loggedOut: logoutSucceeded,
    message: logoutSucceeded
      ? 'Device WhatsApp logout dan sesi dihapus. Bot akan restart sebentar lagi.'
      : 'Sesi dihapus. Bot akan restart sebentar lagi.',
    warning: logoutMessage || undefined,
  }
}

async function setBotEnabled(enabled) {
  const settings = await systemSettings.set(
    { botEnabled: Boolean(enabled) },
    { source: 'dashboard', role: 'admin', jid: 'dashboard' },
  )
  logger.warn(`Bot ${settings.botEnabled ? 'diaktifkan' : 'dinonaktifkan'} dari dashboard.`)

  return {
    botEnabled: settings.botEnabled,
    message: settings.botEnabled
      ? 'Bot aktif lagi dan akan merespons pesan.'
      : 'Bot dinonaktifkan. Device tetap tertaut, tetapi bot tidak akan merespons pesan.',
  }
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

async function getParticipantState(sock, chatJid, senderJids) {
  const metadata = await sock.groupMetadata(chatJid)
  const participants = metadata.participants || []
  const aliases = Array.isArray(senderJids) ? senderJids.map((jid) => normalizeJid(jid)) : []
  const member = participants.find((entry) =>
    [entry.id, entry.jid, entry.lid, entry.phoneNumber].some((jid) =>
      aliases.includes(normalizeJid(jid)),
    ),
  )
  const botMember = participants.find(
    (entry) => normalizeJid(entry.id) === normalizeJid(sock.user?.id),
  )

  return {
    metadata,
    senderJid: member?.id || aliases[0] || '',
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

  const senderJids = getSenderJids(message)
  const sender = senderJids[0] || ''
  const { senderAdmin, botAdmin, senderJid } = await getParticipantState(sock, chatJid, senderJids)

  if (owner || senderAdmin) {
    return false
  }

  if (settings.antiLink === 'kick' && botAdmin) {
    await sock.groupParticipantsUpdate(chatJid, [senderJid || sender], 'remove')
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

async function handleSmartReply({ body, message, reply, sock }) {
  const chatJid = getChatJid(message)
  const globalSettings = settingsService.getSettings()
  const groupMode = chatJid.endsWith('@g.us')
  const settings = groupMode ? groupSettings.get(chatJid) : null
  const groupTriggered =
    groupMode && settings?.smartReply && shouldTriggerSmartReply(message, body, sock)
  const privateTriggered =
    !groupMode && globalSettings.autoReply.enabled && globalSettings.autoReply.mode !== 'off'

  if (!groupTriggered && !privateTriggered) {
    return false
  }

  const prompt = buildSmartReplyPrompt(body)
  if (!prompt || prompt.length < 3) {
    return false
  }

  const result = await resolveAssistantReply({
    settingsService,
    prompt,
  })

  if (!result.text) {
    return false
  }

  await reply(result.text)
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

  const senderJids = getSenderJids(message)
  const sender = senderJids[0] || ''
  const { senderAdmin } = await getParticipantState(sock, chatJid, senderJids)
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

  const senderJids = getSenderJids(message)
  const sender = senderJids[0] || ''
  const { senderAdmin } = await getParticipantState(sock, chatJid, senderJids)
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

async function readLegacyJson(fileName) {
  const fileUrl = new URL(`../data/${fileName}`, import.meta.url)
  const raw = await readFile(fileUrl, 'utf8').catch(() => '')
  if (!raw) {
    return {}
  }

  return JSON.parse(raw)
}

async function migrateLegacySettings() {
  const [legacySystem, legacyGroups] = await Promise.all([
    readLegacyJson('system-settings.json'),
    readLegacyJson('group-settings.json'),
  ])
  const imported = await settingsService.importLegacySettings({
    system: legacySystem,
    groups: legacyGroups,
  })

  if (imported) {
    logger.info('Legacy settings berhasil dimigrasikan ke app-database.json.')
  }
}

async function boot() {
  await settingsService.load()
  await migrateLegacySettings()
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
  runtime.registered = resolveRegistered(sock)

  sock.ev.on('creds.update', (...args) => {
    runtime.registered = resolveRegistered(sock)
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
      runtime.registered = resolveRegistered(sock)
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
      runtime.registered = resolveRegistered(sock)

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
    const chatJid = getChatJid(message)
    if (!message?.message || chatJid === 'status@broadcast') {
      return
    }

    if (message.key.fromMe) {
      return
    }

    const body = extractText(message).trim()
    const senderJids = await resolveSenderJids(sock, getSenderJids(message))
    const sender = senderJids[0] || ''
    if (!chatJid || !sender) {
      logger.warn('Pesan masuk diabaikan karena chatJid atau sender kosong.')
      return
    }

    const runtimeConfig = buildRuntimeConfig()
    const settings = settingsService.getSettings()
    const parsedCommand = parseCommand(body, runtimeConfig, settings)
    const role = getRole(senderJids, config, settingsService)
    const owner = role === 'owner'
    const system = systemSettings.get()

    if (config.botMode === 'private' && !owner) {
      return
    }

    await settingsService
      .logMessage({
        direction: 'in',
        chatJid,
        sender,
        body,
        role,
        isCommand: parsedCommand.isCommand,
        commandName: parsedCommand.name || null,
        workflow: buildWorkflowTrace({
          isCommand: parsedCommand.isCommand,
          role,
          mode: parsedCommand.isCommand ? 'command_mode' : 'workflow_router',
          commandName: parsedCommand.name || null,
        }),
      })
      .catch((error) => logger.warn(`Log pesan masuk gagal: ${error.message}`))

    if (!system.botEnabled && !(parsedCommand.isCommand && canManageSettings(role))) {
      return
    }

    const reply = createReply(sock, message, chatJid, senderJids)

    if (
      !isInsideActiveHours(settings) &&
      !parsedCommand.isCommand &&
      !canManageSettings(role)
    ) {
      await reply(settings.handoffMessage)
      return
    }

    try {
      await trackUserProgress({
        isCommand: parsedCommand.isCommand,
        message,
        reply,
      })
    } catch (error) {
      logger.warn(`Tracking user gagal: ${error.message}`)
    }

    try {
      const blockedBySpam = await handleAntiSpam({
        body,
        isCommand: parsedCommand.isCommand,
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

    if (parsedCommand.isCommand) {
      if (!parsedCommand.commandLine) {
        return
      }

      const resolvedName = settingsService.resolveCommandName(parsedCommand.name)
      const command = registry.get(resolvedName)
      if (!command) {
        await reply(settings.fallbackMessage)
        return
      }

      if (!toolRegistry.isEnabled(command)) {
        await reply(`Tool ${command.name} sedang nonaktif. Admin bisa mengaktifkan via /tool on ${command.name}.`)
        return
      }

      if (command.ownerOnly && !owner) {
        await reply('Perintah ini khusus owner.')
        return
      }

      if (command.adminOnly && !canManageSettings(role)) {
        await reply('Perintah ini khusus owner/admin bot.')
        return
      }

      try {
        await command.execute({
          args: parsedCommand.args,
          body,
          chatJid,
          config: runtimeConfig,
          groupSettings,
          message,
          owner,
          registry,
          reply,
          role,
          sender,
          senderJids,
          settingsService,
          sock,
          state,
          systemSettings,
          toolRegistry,
          userStore,
        })
        await toolRegistry.markUsed(command, true)
        state.commandCount = registry.count()
      } catch (error) {
        await toolRegistry.markUsed(command, false).catch(() => {})
        logger.error(`Command ${command.name} gagal: ${error.message}`)
        await reply(`Perintah gagal: ${error.message}`)
      }
      return
    }

    if (!body) {
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

      if (settings.autoReply.enabled && settings.autoReply.mode !== 'off') {
        const faq = settingsService.findFaqAnswer(body)
        if (faq) {
          await reply(faq.answer)
          return
        }
      }

      const smartReplied = await handleSmartReply({
        body,
        message,
        reply,
        sock,
      })
      if (
        !smartReplied &&
        !chatJid.endsWith('@g.us') &&
        settings.autoReply.enabled &&
        settings.autoReply.mode !== 'off'
      ) {
        await reply(settings.fallbackMessage)
      }
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

  if (!sock.authState.creds.registered) {
    logger.info(
      `Device belum tertaut. Ambil QR dari dashboard atau minta kode pairing lewat tombol Pairing Console.`,
    )
  }
}

startHealthServer(config, state, runtime, {
  requestPairingCode,
  resetSession,
  logoutDevice,
  setBotEnabled,
  settingsService,
  toolRegistry,
  registry,
  getSystemSettings: () => systemSettings.get(),
  getCommands: () =>
    registry.list().map((entry) => ({
      name: entry.name,
      aliases: entry.aliases,
      category: entry.category,
      description: entry.description,
      ownerOnly: entry.ownerOnly,
      adminOnly: entry.adminOnly,
    })),
  getTools: () => toolRegistry.list(registry),
})

function bootWithRetry() {
  boot().catch((error) => {
    state.connection = 'boot-failed'
    state.lastDisconnectReason = error instanceof Error ? error.message : String(error)
    logger.error(`Boot gagal: ${state.lastDisconnectReason}`)

    setTimeout(() => {
      bootWithRetry()
    }, 3000)
  })
}

bootWithRetry()
