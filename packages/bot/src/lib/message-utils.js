export function extractText(payload) {
  if (!payload) {
    return ''
  }

  if (payload.message) {
    return extractText(payload.message)
  }

  if (payload.ephemeralMessage?.message) {
    return extractText(payload.ephemeralMessage.message)
  }

  if (payload.viewOnceMessage?.message) {
    return extractText(payload.viewOnceMessage.message)
  }

  if (payload.conversation) {
    return payload.conversation
  }

  if (payload.extendedTextMessage?.text) {
    return payload.extendedTextMessage.text
  }

  if (payload.imageMessage?.caption) {
    return payload.imageMessage.caption
  }

  if (payload.videoMessage?.caption) {
    return payload.videoMessage.caption
  }

  if (payload.buttonsResponseMessage?.selectedButtonId) {
    return payload.buttonsResponseMessage.selectedButtonId
  }

  if (payload.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return payload.listResponseMessage.singleSelectReply.selectedRowId
  }

  if (payload.templateButtonReplyMessage?.selectedId) {
    return payload.templateButtonReplyMessage.selectedId
  }

  return ''
}

export function formatRuntime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)

  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, `${seconds}s`]
    .filter(Boolean)
    .join(' ')
}

export function cleanNumber(number) {
  return String(number || '').replace(/\D/g, '')
}

export function isOwner(sender, config) {
  return config.ownerNumbers.some((owner) => sender.includes(cleanNumber(owner)))
}
