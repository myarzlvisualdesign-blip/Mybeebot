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

export async function getGroupContext(sock, message) {
  const jid = getChatJid(message)
  if (!jid.endsWith('@g.us')) {
    throw new Error('This command only works in groups.')
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

  if (!admin) {
    throw new Error('This command is only for group admins or the owner.')
  }

  return {
    jid,
    metadata,
    participants,
    sender,
    owner,
    admin,
  }
}
