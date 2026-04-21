import { cleanNumber } from './message-utils.js'

export function getChatJid(message) {
  return message?.key?.remoteJid || ''
}

export function getSenderJid(message) {
  return message?.key?.participant || message?.key?.remoteJid || ''
}

export function isGroupChat(message) {
  return getChatJid(message).endsWith('@g.us')
}

export function toMention(id) {
  return `@${String(id || '').split('@')[0]}`
}

export function normalizeJid(id) {
  return String(id || '').replace(/:\d+@/, '@')
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
    payload.stickerMessage?.contextInfo ||
    null
  )
}

export function getTargetJids(message, args = []) {
  const contextInfo = extractContextInfo(message)
  const targets = new Set()

  for (const jid of contextInfo?.mentionedJid || []) {
    targets.add(normalizeJid(jid))
  }

  if (contextInfo?.participant) {
    targets.add(normalizeJid(contextInfo.participant))
  }

  const rawNumbers = args.join(' ').match(/\d{5,}/g) || []
  for (const number of rawNumbers) {
    targets.add(`${cleanNumber(number)}@s.whatsapp.net`)
  }

  return [...targets].filter((jid) => jid.endsWith('@s.whatsapp.net'))
}

export function parseToggle(value) {
  const normalized = String(value || '').trim().toLowerCase()

  if (['on', 'true', '1', 'yes', 'enable', 'enabled', 'aktif', 'nyala'].includes(normalized)) {
    return true
  }

  if (['off', 'false', '0', 'no', 'disable', 'disabled', 'mati'].includes(normalized)) {
    return false
  }

  return null
}

export async function getGroupContext(sock, message) {
  const jid = getChatJid(message)
  if (!jid.endsWith('@g.us')) {
    throw new Error('Perintah ini hanya bisa dipakai di grup.')
  }

  const metadata = await sock.groupMetadata(jid)
  return {
    jid,
    metadata,
    participants: metadata.participants || [],
  }
}

export function isConfiguredOwner(sender, config) {
  return config.ownerNumbers.some((owner) => sender.includes(cleanNumber(owner)))
}

export async function ensureGroupAdmin(sock, message, config) {
  const { jid, metadata, participants } = await getGroupContext(sock, message)
  const sender = getSenderJid(message)
  const participant = participants.find((entry) => entry.id === sender)
  const owner = isConfiguredOwner(sender, config) || Boolean(message?.key?.fromMe)
  const admin = owner || Boolean(participant?.admin)
  const botParticipant = participants.find(
    (entry) => normalizeJid(entry.id) === normalizeJid(sock.user?.id),
  )
  const botAdmin = Boolean(botParticipant?.admin)

  if (!admin) {
    throw new Error('Perintah ini khusus admin grup atau owner bot.')
  }

  return {
    jid,
    metadata,
    participants,
    sender,
    owner,
    admin,
    botAdmin,
  }
}
