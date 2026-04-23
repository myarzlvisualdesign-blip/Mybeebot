import fs from 'node:fs/promises'
import path from 'node:path'

const defaults = {
  antiCall: true,
  botEnabled: true,
}

export class SystemSettingsStore {
  constructor(fileUrlOrPath) {
    this.filePath = String(fileUrlOrPath).startsWith('file:')
      ? new URL(fileUrlOrPath)
      : path.resolve(fileUrlOrPath)
    this.state = {
      ...defaults,
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
        ...defaults,
        ...(parsed || {}),
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

  get() {
    return {
      ...defaults,
      ...this.state,
    }
  }

  async set(patch) {
    await this.load()
    this.state = {
      ...this.get(),
      ...patch,
    }
    await this.save()
    return this.get()
  }
}
