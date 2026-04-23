import { cleanNumber } from './message-utils.js'

function uniqueNormalizedJids(values) {
  return [
    ...new Set(
      values
        .map((value) => normalizeJid(value))
        .filter(Boolean),
    ),
  ]
}

export function getChatJid(message) {
  return normalizeJid(message?.key?.remoteJid || message?.key?.remoteJidAlt || '')
}

export function getSenderJid(message) {
  return getSenderJids(message)[0] || ''
}

export function getSenderJids(message) {
  const key = message?.key || {}
  const participantJids = uniqueNormalizedJids([
    key.participant,
    key.participantAlt,
    key.participantPn,
    key.participantLid,
    key.senderJid,
    key.senderPn,
    key.senderLid,
    message?.participant,
    message?.participantAlt,
    message?.participantPn,
    message?.participantLid,
  ])

  if (participantJids.length) {
    return participantJids
  }

  return uniqueNormalizedJids([
    key.remoteJid,
    key.remoteJidAlt,
    key.remoteJidPn,
    key.remoteJidLid,
    key.pnJid,
    key.lidJid,
  ])
}

export async function resolveSenderJids(sock, senderJids = []) {
  const resolvedJids = [...senderJids]
  const lidMapping = sock?.signalRepository?.lidMapping

  if (!lidMapping?.getPNForLID) {
    return uniqueNormalizedJids(resolvedJids)
  }

  for (const jid of senderJids) {
    const normalized = normalizeJid(jid)
    if (!normalized.endsWith('@lid')) {
      continue
    }

    const phoneJid = await lidMapping.getPNForLID(normalized).catch(() => null)
    if (phoneJid) {
      resolvedJids.push(phoneJid)
    }
  }

  return uniqueNormalizedJids(resolvedJids)
}

export function isGroupChat(message) {
  return isGroupJid(getChatJid(message))
}

export function isGroupJid(jid) {
  return String(jid || '').endsWith('@g.us')
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
  const senderJids = getSenderJids(message)
  const sender = senderJids[0] || ''
  const participant = participants.find((entry) =>
    [entry.id, entry.jid, entry.lid, entry.phoneNumber].some((jid) =>
      senderJids.includes(normalizeJid(jid)),
    ),
  )
  const owner = senderJids.some((jid) => isConfiguredOwner(jid, config)) || Boolean(message?.key?.fromMe)
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
