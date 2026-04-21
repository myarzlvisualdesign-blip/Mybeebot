import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const commandsDir = fileURLToPath(new URL('../commands', import.meta.url))

export class CommandRegistry {
  constructor() {
    this.commands = new Map()
    this.entries = []
  }

  async load() {
    const commandFiles = fs
      .readdirSync(commandsDir)
      .filter((file) => file.endsWith('.js'))
      .sort()

    this.commands.clear()
    this.entries = []

    for (const file of commandFiles) {
      const moduleUrl = `${pathToFileURL(path.join(commandsDir, file)).href}?v=${Date.now()}`
      const imported = await import(moduleUrl)
      const command = imported.default

      if (!command?.name || typeof command.execute !== 'function') {
        continue
      }

      const normalized = {
        aliases: [],
        category: 'core',
        ownerOnly: false,
        ...command,
      }

      this.entries.push(normalized)
      this.commands.set(normalized.name, normalized)

      for (const alias of normalized.aliases) {
        this.commands.set(alias, normalized)
      }
    }

    this.entries.sort((left, right) => left.name.localeCompare(right.name))
    return this.entries
  }

  get(name) {
    return this.commands.get(name)
  }

  list() {
    return this.entries
  }

  count() {
    return this.entries.length
  }

  grouped() {
    const groups = new Map()

    for (const entry of this.entries) {
      if (!groups.has(entry.category)) {
        groups.set(entry.category, [])
      }

      groups.get(entry.category).push(entry)
    }

    return groups
  }
}
