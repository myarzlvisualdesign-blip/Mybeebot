import fs from 'node:fs/promises'
import path from 'node:path'

const defaults = {
  welcome: false,
  goodbye: false,
  antiLink: 'off',
  antiSpam: false,
  antiBadword: false,
  badWords: [],
  smartReply: false,
  autoResponder: false,
  autoReplies: {},
}

function normalizeSettings(value = {}) {
  const autoReplies =
    value.autoReplies && typeof value.autoReplies === 'object' ? value.autoReplies : {}
  const badWords = Array.isArray(value.badWords) ? value.badWords : []
  const legacySmartReply = 'smartReply' in value ? value.smartReply : value.aiReply

  return {
    ...defaults,
    ...value,
    antiLink: ['off', 'warn', 'kick'].includes(value.antiLink) ? value.antiLink : 'off',
    antiSpam: Boolean(value.antiSpam),
    antiBadword: Boolean(value.antiBadword),
    badWords: [...new Set(badWords.map((word) => String(word).trim().toLowerCase()).filter(Boolean))],
    smartReply: Boolean(legacySmartReply),
    autoResponder: Boolean(value.autoResponder),
    autoReplies: Object.fromEntries(
      Object.entries(autoReplies)
        .map(([key, response]) => [String(key).trim().toLowerCase(), String(response).trim()])
        .filter(([key, response]) => key && response),
    ),
  }
}

export class GroupSettingsStore {
  constructor(fileUrlOrPath) {
    this.filePath = String(fileUrlOrPath).startsWith('file:')
      ? new URL(fileUrlOrPath)
      : path.resolve(fileUrlOrPath)
    this.state = {
      groups: {},
    }
    this.loaded = false
  }

  async load() {
    if (this.loaded) {
      return this.state
    }

    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw)
      this.state = {
        groups: parsed?.groups || {},
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error
      }

      await this.save()
    }

    this.loaded = true
    return this.state
  }

  async save() {
    const filePath =
      this.filePath instanceof URL ? this.filePath : path.resolve(this.filePath)
    const directory =
      filePath instanceof URL
        ? new URL('.', filePath)
        : path.dirname(filePath)

    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(this.state, null, 2))
  }

  get(jid) {
    return normalizeSettings(this.state.groups[jid] || {})
  }

  async set(jid, patch) {
    await this.load()
    this.state.groups[jid] = normalizeSettings({
      ...this.get(jid),
      ...patch,
    })
    await this.save()
    return this.get(jid)
  }

  async setAutoReply(jid, trigger, response) {
    const normalizedTrigger = String(trigger || '').trim().toLowerCase()
    const normalizedResponse = String(response || '').trim()

    if (!normalizedTrigger || !normalizedResponse) {
      throw new Error('Pemicu dan balasan tidak boleh kosong.')
    }

    const current = this.get(jid)
    const autoReplies = {
      ...current.autoReplies,
      [normalizedTrigger]: normalizedResponse,
    }

    return this.set(jid, { autoReplies })
  }

  async removeAutoReply(jid, trigger) {
    const normalizedTrigger = String(trigger || '').trim().toLowerCase()
    const current = this.get(jid)
    const autoReplies = { ...current.autoReplies }

    delete autoReplies[normalizedTrigger]
    return this.set(jid, { autoReplies })
  }

  async addBadWord(jid, word) {
    const normalizedWord = String(word || '').trim().toLowerCase()
    if (!normalizedWord) {
      throw new Error('Kata yang mau diblokir tidak boleh kosong.')
    }

    const current = this.get(jid)
    return this.set(jid, {
      badWords: [...new Set([...(current.badWords || []), normalizedWord])],
    })
  }

  async removeBadWord(jid, word) {
    const normalizedWord = String(word || '').trim().toLowerCase()
    const current = this.get(jid)

    return this.set(jid, {
      badWords: (current.badWords || []).filter((entry) => entry !== normalizedWord),
    })
  }

  list() {
    return Object.entries(this.state.groups || {})
  }
}
