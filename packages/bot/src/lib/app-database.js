import fs from 'node:fs/promises'
import path from 'node:path'

const schemaVersion = 1
const maxMessageLogs = 500
const maxAuditLogs = 500

function nowIso() {
  return new Date().toISOString()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isUrl(value) {
  return value instanceof URL
}

function fileDirectory(filePath) {
  return isUrl(filePath) ? new URL('.', filePath) : path.dirname(filePath)
}

function tempFilePath(filePath) {
  if (isUrl(filePath)) {
    return new URL(`.${path.basename(filePath.pathname)}.${process.pid}.tmp`, new URL('.', filePath))
  }

  return `${filePath}.${process.pid}.tmp`
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function normalizeAutoReplyMode(value, fallback = 'faq-first') {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'ai-first' || normalized === 'template-first') {
    return 'smart-reply'
  }

  return ['faq-first', 'smart-reply', 'off'].includes(normalized) ? normalized : fallback
}

function normalizeSmartReplySettings(value = {}, fallback = {}) {
  const fallbackMode = String(value?.fallbackMode || '').trim().toLowerCase()
  const handoffRules = String(
    value?.handoffRules || value?.escalationRules || fallback.handoffRules || '',
  ).trim()

  return {
    fallbackMode: ['handoff', 'template', 'silent'].includes(fallbackMode)
      ? fallbackMode
      : fallback.fallbackMode || 'handoff',
    handoffRules,
  }
}

function defaultState() {
  return {
    schemaVersion,
    users: {},
    admins: {
      owners: [],
      admins: [],
    },
    settings: {
      botEnabled: true,
      antiCall: true,
      commandPrefixes: ['.', '/'],
      activeHours: {
        enabled: false,
        timezone: 'Asia/Jakarta',
        start: '08:00',
        end: '21:00',
      },
      autoReply: {
        enabled: true,
        mode: 'faq-first',
      },
      replyTiming: {
        enabled: true,
        delaySeconds: 2,
      },
      improvement: {
        enabled: true,
        minRepeats: 2,
        suggestionLimit: 5,
      },
      smartReply: {
        fallbackMode: 'handoff',
        handoffRules:
          'Alihkan ke admin jika user meminta transaksi, komplain sensitif, data pribadi, atau bot tidak yakin.',
      },
      welcomeMessage: 'Halo, selamat datang. Ada yang bisa Mybeebot bantu?',
      fallbackMessage:
        'Maaf, perintah belum dikenali. Ketik /menu untuk melihat fitur yang tersedia.',
      handoffMessage: 'Saya teruskan ke admin supaya bisa dibantu lebih tepat.',
      commandKeywords: {},
      integrations: {
        webhook: {
          enabled: false,
          url: '',
          secret: '',
        },
        apiBaseUrl: '',
      },
    },
    tools: {},
    groupSettings: {},
    conversations: {},
    messageLogs: [],
    faq: [
      {
        id: 'faq-jam-operasional',
        question: 'Jam operasional?',
        answer: 'Jam operasional admin bisa diatur dari dashboard.',
        keywords: ['jam', 'operasional', 'buka'],
        enabled: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ],
    templates: {
      welcome: {
        name: 'welcome',
        body: 'Halo, selamat datang. Ada yang bisa Mybeebot bantu?',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      handoff: {
        name: 'handoff',
        body: 'Saya teruskan ke admin supaya bisa dibantu lebih tepat.',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    },
    workflows: [
      {
        id: 'incoming-message-default',
        name: 'Incoming Message Router',
        enabled: true,
        steps: [
          'incoming_message',
          'parse_command',
          'role_check',
          'settings_check',
          'tool_or_reply_mode',
          'execute',
          'log_result',
          'send_response',
        ],
        updatedAt: nowIso(),
      },
    ],
    auditLogs: [],
  }
}

function mergeDefaults(input = {}) {
  const defaults = defaultState()
  const inputSettings = input.settings || {}
  const {
    ai: legacyAi = {},
    smartReply: incomingSmartReply = {},
    ...restInputSettings
  } = inputSettings

  const state = {
    ...defaults,
    ...input,
    admins: {
      ...defaults.admins,
      ...(input.admins || {}),
    },
    settings: {
      ...defaults.settings,
      ...restInputSettings,
      activeHours: {
        ...defaults.settings.activeHours,
        ...(inputSettings.activeHours || {}),
      },
      autoReply: {
        ...defaults.settings.autoReply,
        ...(inputSettings.autoReply || {}),
        mode: normalizeAutoReplyMode(
          inputSettings.autoReply?.mode,
          defaults.settings.autoReply.mode,
        ),
      },
      replyTiming: {
        ...defaults.settings.replyTiming,
        ...(inputSettings.replyTiming || {}),
      },
      improvement: {
        ...defaults.settings.improvement,
        ...(inputSettings.improvement || {}),
      },
      smartReply: {
        ...normalizeSmartReplySettings(
          {
            ...(legacyAi || {}),
            ...(incomingSmartReply || {}),
          },
          defaults.settings.smartReply,
        ),
      },
      integrations: {
        ...defaults.settings.integrations,
        ...(inputSettings.integrations || {}),
        webhook: {
          ...defaults.settings.integrations.webhook,
          ...(inputSettings.integrations?.webhook || {}),
        },
      },
    },
    tools: input.tools || {},
    groupSettings: input.groupSettings || {},
    users: input.users || {},
    conversations: input.conversations || {},
    messageLogs: Array.isArray(input.messageLogs) ? input.messageLogs : [],
    faq: Array.isArray(input.faq) ? input.faq : defaults.faq,
    templates: input.templates || defaults.templates,
    workflows: Array.isArray(input.workflows) ? input.workflows : defaults.workflows,
    auditLogs: Array.isArray(input.auditLogs) ? input.auditLogs : [],
  }

  state.schemaVersion = schemaVersion
  state.admins.owners = uniqueStrings(state.admins.owners)
  state.admins.admins = uniqueStrings(state.admins.admins)
  state.settings.commandPrefixes = uniqueStrings(state.settings.commandPrefixes)
  if (!state.settings.commandPrefixes.length) {
    state.settings.commandPrefixes = defaults.settings.commandPrefixes
  }
  state.messageLogs = state.messageLogs.slice(-maxMessageLogs)
  state.auditLogs = state.auditLogs.slice(-maxAuditLogs)

  return state
}

export class AppDatabase {
  constructor(fileUrlOrPath) {
    this.filePath = String(fileUrlOrPath).startsWith('file:')
      ? new URL(fileUrlOrPath)
      : path.resolve(fileUrlOrPath)
    this.state = defaultState()
    this.loaded = false
    this.mutationQueue = Promise.resolve()
  }

  async load() {
    if (this.loaded) {
      return this.state
    }

    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      this.state = mergeDefaults(JSON.parse(raw))
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error
      }

      this.state = defaultState()
      await this.save()
    }

    this.loaded = true
    return this.state
  }

  async save() {
    const filePath = isUrl(this.filePath) ? this.filePath : path.resolve(this.filePath)
    const directory = fileDirectory(filePath)
    const normalized = mergeDefaults(this.state)
    const tempPath = tempFilePath(filePath)

    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(tempPath, JSON.stringify(normalized, null, 2))
    await fs.rename(tempPath, filePath)
    this.state = normalized
  }

  snapshot() {
    return clone(mergeDefaults(this.state))
  }

  async read() {
    await this.load()
    return this.snapshot()
  }

  async mutate(mutator) {
    const runMutation = async () => {
      await this.load()
      const result = await mutator(this.state)
      this.state = mergeDefaults(this.state)
      await this.save()
      return result
    }

    const queued = this.mutationQueue.then(runMutation, runMutation)
    this.mutationQueue = queued.catch(() => {})

    return queued
  }
}
