import { normalizeJid } from './group-utils.js'
import { cleanNumber } from './message-utils.js'

function numberFromJid(jid) {
  return cleanNumber(String(jid || '').split('@')[0])
}

function matchesNumber(jid, number) {
  const senderNumber = numberFromJid(jid)
  const normalized = cleanNumber(number)
  const localFormat = normalized.startsWith('62') ? `0${normalized.slice(2)}` : ''
  const intlFormat = normalized.startsWith('0') ? `62${normalized.slice(1)}` : ''
  const candidates = [normalized, localFormat, intlFormat].filter(Boolean)

  return Boolean(
    senderNumber &&
      candidates.length &&
      candidates.some(
        (candidate) => senderNumber === candidate || senderNumber.endsWith(candidate),
      ),
  )
}

function matchesRoleEntry(jid, entry) {
  const normalizedJid = normalizeJid(jid)
  const normalizedEntry = normalizeJid(entry).toLowerCase()

  if (!normalizedJid || !normalizedEntry) {
    return false
  }

  if (normalizedEntry.includes('@') && normalizedJid.toLowerCase() === normalizedEntry) {
    return true
  }

  return matchesNumber(normalizedJid, normalizedEntry)
}

function hasRoleEntry(jids, entries = []) {
  return jids.some((jid) => entries.some((entry) => matchesRoleEntry(jid, entry)))
}

export function getRole(senderJids = [], config, settingsService) {
  const roles = settingsService.getRoles()
  const jids = senderJids.map((jid) => normalizeJid(jid)).filter(Boolean)

  if (hasRoleEntry(jids, roles.owners) || hasRoleEntry(jids, config.ownerNumbers || [])) {
    return 'owner'
  }

  if (hasRoleEntry(jids, roles.admins)) {
    return 'admin'
  }

  return 'user'
}

export function canManageSettings(role) {
  return role === 'owner' || role === 'admin'
}

export function actorFromMessage({ role, sender, source = 'whatsapp' }) {
  return {
    jid: sender,
    role,
    source,
  }
}
