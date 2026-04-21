import fs from 'node:fs/promises'
import path from 'node:path'

const defaults = {
  xp: 0,
  level: 1,
  premium: false,
  messageCount: 0,
  commandCount: 0,
  warningCount: 0,
  joinedAt: null,
  lastSeenAt: null,
}

function normalizeUser(value = {}) {
  return {
    ...defaults,
    ...value,
    xp: Number(value.xp || 0),
    level: Math.max(1, Number(value.level || 1)),
    premium: Boolean(value.premium),
    messageCount: Number(value.messageCount || 0),
    commandCount: Number(value.commandCount || 0),
    warningCount: Number(value.warningCount || 0),
    joinedAt: value.joinedAt || null,
    lastSeenAt: value.lastSeenAt || null,
  }
}

export function levelThreshold(level) {
  return 80 + level * level * 35
}

export function resolveLevelFromXp(xp) {
  let level = 1
  let currentXp = Number(xp || 0)

  while (currentXp >= levelThreshold(level)) {
    currentXp -= levelThreshold(level)
    level += 1
  }

  return level
}

export class UserStore {
  constructor(fileUrlOrPath) {
    this.filePath = String(fileUrlOrPath).startsWith('file:')
      ? new URL(fileUrlOrPath)
      : path.resolve(fileUrlOrPath)
    this.state = {
      users: {},
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
        users: parsed?.users || {},
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
    return normalizeUser(this.state.users[jid] || {})
  }

  async set(jid, patch) {
    await this.load()
    this.state.users[jid] = normalizeUser({
      ...this.get(jid),
      ...patch,
    })
    await this.save()
    return this.get(jid)
  }

  async touch(jid, options = {}) {
    const user = this.get(jid)
    const joinedAt = user.joinedAt || new Date().toISOString()
    const lastSeenAt = new Date().toISOString()
    const xpGain = Number(options.xpGain || 0)
    const nextXp = user.xp + xpGain
    const nextLevel = resolveLevelFromXp(nextXp)
    const leveledUp = nextLevel > user.level

    const saved = await this.set(jid, {
      xp: nextXp,
      level: nextLevel,
      joinedAt,
      lastSeenAt,
      messageCount: user.messageCount + (options.message ? 1 : 0),
      commandCount: user.commandCount + (options.command ? 1 : 0),
      warningCount: user.warningCount + (options.warning ? 1 : 0),
      premium: options.premium ?? user.premium,
    })

    return {
      ...saved,
      leveledUp,
    }
  }

  async setPremium(jid, premium) {
    return this.set(jid, {
      premium: Boolean(premium),
    })
  }

  listUsers() {
    return Object.entries(this.state.users || {}).map(([jid, user]) => ({
      jid,
      ...normalizeUser(user),
    }))
  }

  listPremium() {
    return this.listUsers().filter((user) => user.premium)
  }
}
