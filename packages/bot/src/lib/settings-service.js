const groupDefaults = {
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

function nowIso() {
  return new Date().toISOString()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeNumber(value) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeRoleIdentifier(value) {
  const text = safeString(value, 140).toLowerCase()
  if (!text) {
    return ''
  }

  if (text.endsWith('@lid') || text.endsWith('@s.whatsapp.net')) {
    return text.replace(/:\d+@/, '@')
  }

  return normalizeNumber(text)
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function asBoolean(value) {
  if (typeof value === 'boolean') {
    return value
  }

  return ['1', 'true', 'yes', 'on', 'aktif', 'nyala'].includes(
    String(value || '').trim().toLowerCase(),
  )
}

function safeString(value, maxLength = 4000) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function normalizeTime(value, fallback) {
  const text = safeString(value, 5)
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback
}

function normalizeInteger(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.round(number)))
}

function normalizeAutoReplyMode(value, fallback = 'faq-first') {
  const normalized = safeString(value, 32).toLowerCase()
  if (normalized === 'ai-first' || normalized === 'template-first') {
    return 'smart-reply'
  }

  return ['faq-first', 'smart-reply', 'off'].includes(normalized) ? normalized : fallback
}

function normalizeSmartReplySettings(current = {}, patch = null) {
  const source = patch && typeof patch === 'object' ? { ...current, ...patch } : current
  const fallbackMode = safeString(source?.fallbackMode, 32).toLowerCase()

  return {
    fallbackMode: ['handoff', 'template', 'silent'].includes(fallbackMode)
      ? fallbackMode
      : 'handoff',
    handoffRules: safeString(
      source?.handoffRules ?? source?.escalationRules ?? current?.handoffRules,
      2000,
    ),
  }
}

function normalizeGroupSettings(value = {}) {
  const autoReplies =
    value.autoReplies && typeof value.autoReplies === 'object' ? value.autoReplies : {}
  const badWords = Array.isArray(value.badWords) ? value.badWords : []
  const legacySmartReply = 'smartReply' in value ? value.smartReply : value.aiReply

  return {
    ...groupDefaults,
    ...value,
    antiLink: ['off', 'warn', 'kick'].includes(value.antiLink) ? value.antiLink : 'off',
    antiSpam: Boolean(value.antiSpam),
    antiBadword: Boolean(value.antiBadword),
    badWords: [
      ...new Set(badWords.map((word) => String(word).trim().toLowerCase()).filter(Boolean)),
    ],
    smartReply: Boolean(legacySmartReply),
    autoResponder: Boolean(value.autoResponder),
    autoReplies: Object.fromEntries(
      Object.entries(autoReplies)
        .map(([key, response]) => [String(key).trim().toLowerCase(), String(response).trim()])
        .filter(([key, response]) => key && response),
    ),
  }
}

function normalizeSettings(current, patch) {
  if (!isPlainObject(patch)) {
    throw new Error('Patch settings harus berupa object.')
  }

  const next = clone(current)

  if ('botEnabled' in patch) {
    next.botEnabled = Boolean(patch.botEnabled)
  }

  if ('antiCall' in patch) {
    next.antiCall = Boolean(patch.antiCall)
  }

  if ('commandPrefixes' in patch) {
    const prefixes = Array.isArray(patch.commandPrefixes)
      ? patch.commandPrefixes
      : String(patch.commandPrefixes || '')
          .split(',')
          .map((item) => item.trim())
    next.commandPrefixes = uniqueStrings(prefixes).slice(0, 5)
    if (!next.commandPrefixes.length) {
      next.commandPrefixes = ['.', '/']
    }
  }

  if (patch.activeHours && typeof patch.activeHours === 'object') {
    next.activeHours = {
      ...next.activeHours,
      enabled:
        'enabled' in patch.activeHours
          ? Boolean(patch.activeHours.enabled)
          : Boolean(next.activeHours.enabled),
      timezone: safeString(patch.activeHours.timezone || next.activeHours.timezone, 64),
      start: normalizeTime(patch.activeHours.start, next.activeHours.start),
      end: normalizeTime(patch.activeHours.end, next.activeHours.end),
    }
  }

  if (patch.autoReply && typeof patch.autoReply === 'object') {
    next.autoReply = {
      ...next.autoReply,
      enabled:
        'enabled' in patch.autoReply
          ? Boolean(patch.autoReply.enabled)
          : Boolean(next.autoReply.enabled),
      mode: normalizeAutoReplyMode(patch.autoReply.mode, next.autoReply.mode),
    }
  }

  if (patch.replyTiming && typeof patch.replyTiming === 'object') {
    next.replyTiming = {
      ...next.replyTiming,
      enabled:
        'enabled' in patch.replyTiming
          ? Boolean(patch.replyTiming.enabled)
          : Boolean(next.replyTiming.enabled),
      delaySeconds:
        'delaySeconds' in patch.replyTiming
          ? normalizeInteger(patch.replyTiming.delaySeconds, next.replyTiming.delaySeconds, 0, 30)
          : normalizeInteger(next.replyTiming.delaySeconds, 2, 0, 30),
    }
  }

  if (patch.improvement && typeof patch.improvement === 'object') {
    next.improvement = {
      ...next.improvement,
      enabled:
        'enabled' in patch.improvement
          ? Boolean(patch.improvement.enabled)
          : Boolean(next.improvement.enabled),
      minRepeats:
        'minRepeats' in patch.improvement
          ? normalizeInteger(patch.improvement.minRepeats, next.improvement.minRepeats, 2, 10)
          : normalizeInteger(next.improvement.minRepeats, 2, 2, 10),
      suggestionLimit:
        'suggestionLimit' in patch.improvement
          ? normalizeInteger(
              patch.improvement.suggestionLimit,
              next.improvement.suggestionLimit,
              3,
              20,
            )
          : normalizeInteger(next.improvement.suggestionLimit, 5, 3, 20),
    }
  }

  const smartReplyPatch =
    patch.smartReply && typeof patch.smartReply === 'object'
      ? patch.smartReply
      : patch.ai && typeof patch.ai === 'object'
        ? patch.ai
        : null

  if (smartReplyPatch) {
    next.smartReply = normalizeSmartReplySettings(next.smartReply, smartReplyPatch)
  }

  next.smartReply = normalizeSmartReplySettings(next.smartReply)
  delete next.ai

  if ('welcomeMessage' in patch) {
    next.welcomeMessage = safeString(patch.welcomeMessage, 2000)
  }

  if ('fallbackMessage' in patch) {
    next.fallbackMessage = safeString(patch.fallbackMessage, 2000)
  }

  if ('handoffMessage' in patch) {
    next.handoffMessage = safeString(patch.handoffMessage, 2000)
  }

  if (patch.commandKeywords && typeof patch.commandKeywords === 'object') {
    next.commandKeywords = Object.fromEntries(
      Object.entries({
        ...next.commandKeywords,
        ...patch.commandKeywords,
      })
        .map(([command, keyword]) => [
          safeString(command, 64).toLowerCase(),
          safeString(keyword, 64).toLowerCase(),
        ])
        .filter(([command, keyword]) => command && keyword),
    )
  }

  if (patch.integrations && typeof patch.integrations === 'object') {
    next.integrations = {
      ...next.integrations,
      apiBaseUrl:
        'apiBaseUrl' in patch.integrations
          ? safeString(patch.integrations.apiBaseUrl, 500)
          : next.integrations.apiBaseUrl,
      webhook: {
        ...next.integrations.webhook,
        ...(patch.integrations.webhook || {}),
      },
    }
    next.integrations.webhook = {
      enabled: Boolean(next.integrations.webhook.enabled),
      url: safeString(next.integrations.webhook.url, 500),
      secret: safeString(next.integrations.webhook.secret, 500),
    }
  }

  return next
}

function buildActor(actor = {}) {
  return {
    jid: actor.jid || actor.sender || 'system',
    role: actor.role || 'system',
    source: actor.source || 'runtime',
  }
}

export class SettingsService {
  constructor(database, config) {
    this.database = database
    this.config = config
  }

  async load() {
    await this.database.load()
    await this.bootstrapOwners(this.config.ownerNumbers || [])
    return this.database.snapshot()
  }

  snapshot() {
    return this.database.snapshot()
  }

  getSettings() {
    return this.snapshot().settings
  }

  getSetting(key) {
    const settings = this.getSettings()
    return clone(settings[key])
  }

  getSystemSettings() {
    const settings = this.getSettings()
    return {
      antiCall: settings.antiCall,
      botEnabled: settings.botEnabled,
      activeHours: settings.activeHours,
      autoReply: settings.autoReply,
      replyTiming: settings.replyTiming,
      improvement: settings.improvement,
      smartReply: settings.smartReply,
    }
  }

  async setSystemSettings(patch, actor = {}) {
    return this.updateSettings(patch, actor, 'settings.system.update')
  }

  async updateSettings(patch, actor = {}, action = 'settings.update') {
    if (!isPlainObject(patch)) {
      throw new Error('Patch settings harus berupa object.')
    }

    const acting = buildActor(actor)
    let updated

    await this.database.mutate((state) => {
      const before = clone(state.settings)
      state.settings = normalizeSettings(state.settings, patch)
      updated = clone(state.settings)
      this.writeAuditIfChanged(state, {
        actor: acting,
        action,
        target: 'settings',
        before,
        after: updated,
      })
    })

    return updated
  }

  async updateSetting(key, value, actor = {}) {
    const settingKey = safeString(key, 80)
    if (!settingKey) {
      throw new Error('Key setting wajib diisi.')
    }

    return this.updateSettings(
      {
        [settingKey]: value,
      },
      actor,
      `settings.${settingKey}.update`,
    )
  }

  async bootstrapOwners(ownerNumbers = []) {
    const normalized = uniqueStrings(ownerNumbers.map(normalizeRoleIdentifier)).filter(Boolean)
    if (!normalized.length) {
      return
    }

    await this.database.mutate((state) => {
      const before = clone(state.admins)
      state.admins.owners = uniqueStrings([...(state.admins.owners || []), ...normalized])
      this.writeAuditIfChanged(state, {
        actor: {
          jid: 'system',
          role: 'system',
          source: 'env-bootstrap',
        },
        action: 'owners.bootstrap',
        target: 'admins.owners',
        before,
        after: clone(state.admins),
      })
    })
  }

  async importLegacySettings({ system = {}, groups = {} } = {}) {
    await this.database.load()
    if (this.snapshot().migrations?.legacySettingsV1) {
      return false
    }

    await this.database.mutate((state) => {
      const systemPatch = {}
      if ('botEnabled' in system) {
        systemPatch.botEnabled = system.botEnabled
      }
      if ('antiCall' in system) {
        systemPatch.antiCall = system.antiCall
      }
      state.settings = normalizeSettings(state.settings, systemPatch)
      state.groupSettings = {
        ...state.groupSettings,
        ...(groups.groups || groups || {}),
      }
      state.migrations = {
        ...(state.migrations || {}),
        legacySettingsV1: nowIso(),
      }
      this.writeAudit(state, {
        actor: {
          jid: 'system',
          role: 'system',
          source: 'migration',
        },
        action: 'legacy_settings.import',
        target: 'app-database',
        before: null,
        after: {
          systemImported: Boolean(system && Object.keys(system).length),
          groupCount: Object.keys(groups.groups || groups || {}).length,
        },
      })
    })

    return true
  }

  getRoles() {
    const state = this.snapshot()
    return {
      owners: uniqueStrings(state.admins.owners || []),
      admins: uniqueStrings(state.admins.admins || []),
    }
  }

  async addRole(role, value, actor = {}) {
    const normalized = normalizeRoleIdentifier(value)
    if (!normalized) {
      throw new Error('Identifier WhatsApp tidak valid.')
    }

    if (!['owners', 'admins'].includes(role)) {
      throw new Error('Role tidak valid.')
    }

    await this.database.mutate((state) => {
      const before = clone(state.admins)
      state.admins[role] = uniqueStrings([...(state.admins[role] || []), normalized])
      this.writeAuditIfChanged(state, {
        actor: buildActor(actor),
        action: `${role}.add`,
        target: normalized,
        before,
        after: clone(state.admins),
      })
    })

    return this.getRoles()
  }

  async removeRole(role, value, actor = {}) {
    const normalized = normalizeRoleIdentifier(value)
    if (!normalized) {
      throw new Error('Identifier WhatsApp tidak valid.')
    }

    if (!['owners', 'admins'].includes(role)) {
      throw new Error('Role tidak valid.')
    }

    await this.database.mutate((state) => {
      const before = clone(state.admins)
      state.admins[role] = (state.admins[role] || []).filter((entry) => entry !== normalized)
      this.writeAuditIfChanged(state, {
        actor: buildActor(actor),
        action: `${role}.remove`,
        target: normalized,
        before,
        after: clone(state.admins),
      })
    })

    return this.getRoles()
  }

  resolveCommandName(input) {
    const name = safeString(input, 64).toLowerCase()
    const entries = Object.entries(this.getSettings().commandKeywords || {})
    const matched = entries.find(([, keyword]) => keyword === name)

    return matched ? matched[0] : name
  }

  async setCommandKeyword(commandName, keyword, actor = {}) {
    const command = safeString(commandName, 64).toLowerCase()
    const normalizedKeyword = safeString(keyword, 64).toLowerCase()
    if (!command || !normalizedKeyword) {
      throw new Error('Nama command dan keyword wajib diisi.')
    }

    return this.updateSettings(
      {
        commandKeywords: {
          [command]: normalizedKeyword,
        },
      },
      actor,
      'settings.command_keyword.update',
    )
  }

  getGroupSettings(jid) {
    const state = this.snapshot()
    return normalizeGroupSettings(state.groupSettings[jid] || {})
  }

  async setGroupSettings(jid, patch, actor = {}) {
    const groupJid = safeString(jid, 140)
    if (!groupJid) {
      throw new Error('JID grup wajib diisi.')
    }
    if (!isPlainObject(patch)) {
      throw new Error('Patch group settings harus berupa object.')
    }

    let settings
    await this.database.mutate((state) => {
      const before = normalizeGroupSettings(state.groupSettings[groupJid] || {})
      state.groupSettings[groupJid] = normalizeGroupSettings({
        ...before,
        ...patch,
      })
      settings = clone(state.groupSettings[groupJid])
      this.writeAuditIfChanged(state, {
        actor: buildActor(actor),
        action: 'group_settings.update',
        target: groupJid,
        before,
        after: settings,
      })
    })

    return settings
  }

  async setAutoReply(jid, trigger, response, actor = {}) {
    const normalizedTrigger = safeString(trigger, 120).toLowerCase()
    const normalizedResponse = safeString(response, 3000)

    if (!normalizedTrigger || !normalizedResponse) {
      throw new Error('Pemicu dan balasan tidak boleh kosong.')
    }

    const current = this.getGroupSettings(jid)
    return this.setGroupSettings(
      jid,
      {
        autoReplies: {
          ...current.autoReplies,
          [normalizedTrigger]: normalizedResponse,
        },
      },
      actor,
    )
  }

  async removeAutoReply(jid, trigger, actor = {}) {
    const normalizedTrigger = safeString(trigger, 120).toLowerCase()
    const current = this.getGroupSettings(jid)
    const autoReplies = { ...current.autoReplies }

    delete autoReplies[normalizedTrigger]
    return this.setGroupSettings(jid, { autoReplies }, actor)
  }

  async addBadWord(jid, word, actor = {}) {
    const normalizedWord = safeString(word, 120).toLowerCase()
    if (!normalizedWord) {
      throw new Error('Kata yang mau diblokir tidak boleh kosong.')
    }

    const current = this.getGroupSettings(jid)
    return this.setGroupSettings(
      jid,
      {
        badWords: [...new Set([...(current.badWords || []), normalizedWord])],
      },
      actor,
    )
  }

  async removeBadWord(jid, word, actor = {}) {
    const normalizedWord = safeString(word, 120).toLowerCase()
    const current = this.getGroupSettings(jid)
    return this.setGroupSettings(
      jid,
      {
        badWords: (current.badWords || []).filter((entry) => entry !== normalizedWord),
      },
      actor,
    )
  }

  listGroupSettings() {
    return Object.entries(this.snapshot().groupSettings || {})
  }

  getToolState(id) {
    return this.snapshot().tools[id] || {}
  }

  async setToolEnabled(id, enabled, actor = {}) {
    const toolId = safeString(id, 140)
    if (!toolId) {
      throw new Error('Tool id wajib diisi.')
    }

    let toolState
    await this.database.mutate((state) => {
      const before = clone(state.tools[toolId] || {})
      state.tools[toolId] = {
        ...before,
        enabled: Boolean(enabled),
        updatedAt: nowIso(),
      }
      toolState = clone(state.tools[toolId])
      this.writeAuditIfChanged(state, {
        actor: buildActor(actor),
        action: enabled ? 'tool.enable' : 'tool.disable',
        target: toolId,
        before,
        after: toolState,
      })
    })

    return toolState
  }

  async recordToolUsage(id, success = true) {
    const toolId = safeString(id, 140)
    if (!toolId) {
      return
    }

    await this.database.mutate((state) => {
      const current = state.tools[toolId] || {}
      state.tools[toolId] = {
        ...current,
        last_used: nowIso(),
        error_count: Number(current.error_count || 0) + (success ? 0 : 1),
      }
    })
  }

  listFaq() {
    return this.snapshot().faq
  }

  listImprovementSuggestions(limit) {
    const settings = this.getSettings()
    if (!settings.improvement?.enabled) {
      return []
    }

    const minimumRepeats = normalizeInteger(settings.improvement.minRepeats, 2, 2, 10)
    const maxItems = normalizeInteger(
      limit ?? settings.improvement.suggestionLimit,
      settings.improvement.suggestionLimit || 5,
      3,
      20,
    )
    const counts = new Map()
    const prefixes = Array.isArray(settings.commandPrefixes) ? settings.commandPrefixes : ['.', '/']

    for (const entry of this.listMessageLogs(400)) {
      if (
        entry.direction !== 'in' ||
        entry.isCommand ||
        !entry.body ||
        String(entry.sender || '').toLowerCase() === 'bot'
      ) {
        continue
      }

      const rawBody = safeString(entry.body, 240)
      if (!rawBody || prefixes.some((prefix) => rawBody.startsWith(prefix))) {
        continue
      }

      const normalized = rawBody
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s?!]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (normalized.length < 4 || this.findFaqAnswer(normalized)) {
        continue
      }

      const existing = counts.get(normalized) || {
        id: `suggest-${normalized.replace(/\s+/g, '-').slice(0, 48)}`,
        question: rawBody,
        normalized,
        count: 0,
        lastSeenAt: entry.at,
        suggestedAnswer: settings.handoffMessage || settings.fallbackMessage,
      }

      existing.count += 1
      if ((entry.at || '') >= (existing.lastSeenAt || '')) {
        existing.lastSeenAt = entry.at
        existing.question = rawBody
      }

      counts.set(normalized, existing)
    }

    return [...counts.values()]
      .filter((entry) => entry.count >= minimumRepeats)
      .sort((left, right) =>
        right.count !== left.count
          ? right.count - left.count
          : String(right.lastSeenAt || '').localeCompare(String(left.lastSeenAt || '')),
      )
      .slice(0, maxItems)
  }

  async addFaq(question, answer, actor = {}) {
    const normalizedQuestion = safeString(question, 500)
    const normalizedAnswer = safeString(answer, 4000)

    if (!normalizedQuestion || !normalizedAnswer) {
      throw new Error('Pertanyaan dan jawaban FAQ wajib diisi.')
    }

    const faq = {
      id: `faq-${Date.now().toString(36)}`,
      question: normalizedQuestion,
      answer: normalizedAnswer,
      keywords: uniqueStrings(normalizedQuestion.toLowerCase().split(/\s+/)).slice(0, 8),
      enabled: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    await this.database.mutate((state) => {
      state.faq.push(faq)
      this.writeAudit(state, {
        actor: buildActor(actor),
        action: 'faq.add',
        target: faq.id,
        before: null,
        after: faq,
      })
    })

    return faq
  }

  async updateFaq(id, question, answer, actor = {}) {
    const faqId = safeString(id, 140)
    const normalizedQuestion = safeString(question, 500)
    const normalizedAnswer = safeString(answer, 4000)

    if (!faqId) {
      throw new Error('ID FAQ wajib diisi.')
    }

    if (!normalizedQuestion || !normalizedAnswer) {
      throw new Error('Pertanyaan dan jawaban FAQ wajib diisi.')
    }

    let faq
    await this.database.mutate((state) => {
      const index = state.faq.findIndex((entry) => entry.id === faqId)
      if (index === -1) {
        throw new Error('FAQ tidak ditemukan.')
      }

      const before = clone(state.faq[index])
      faq = {
        ...before,
        question: normalizedQuestion,
        answer: normalizedAnswer,
        keywords: uniqueStrings(normalizedQuestion.toLowerCase().split(/\s+/)).slice(0, 8),
        updatedAt: nowIso(),
      }
      state.faq[index] = faq
      this.writeAuditIfChanged(state, {
        actor: buildActor(actor),
        action: 'faq.update',
        target: faqId,
        before,
        after: faq,
      })
    })

    return faq
  }

  async removeFaq(id, actor = {}) {
    const faqId = safeString(id, 140)
    await this.database.mutate((state) => {
      const before = state.faq.find((entry) => entry.id === faqId) || null
      state.faq = state.faq.filter((entry) => entry.id !== faqId)
      this.writeAuditIfChanged(state, {
        actor: buildActor(actor),
        action: 'faq.remove',
        target: faqId,
        before,
        after: null,
      })
    })

    return this.listFaq()
  }

  findFaqAnswer(text) {
    const normalized = safeString(text, 1000).toLowerCase()
    if (!normalized) {
      return null
    }

    return (
      this.listFaq().find((entry) => {
        if (entry.enabled === false) {
          return false
        }

        const question = String(entry.question || '').toLowerCase()
        const keywords = Array.isArray(entry.keywords) ? entry.keywords : []
        return question && (normalized.includes(question) || keywords.some((key) => normalized.includes(key)))
      }) || null
    )
  }

  listTemplates() {
    return this.snapshot().templates
  }

  async setTemplate(name, body, actor = {}) {
    const templateName = safeString(name, 80).toLowerCase()
    const templateBody = safeString(body, 4000)

    if (!templateName || !templateBody) {
      throw new Error('Nama dan isi template wajib diisi.')
    }

    let template
    await this.database.mutate((state) => {
      const before = clone(state.templates[templateName] || null)
      template = {
        name: templateName,
        body: templateBody,
        createdAt: before?.createdAt || nowIso(),
        updatedAt: nowIso(),
      }
      state.templates[templateName] = template
      this.writeAuditIfChanged(state, {
        actor: buildActor(actor),
        action: 'template.upsert',
        target: templateName,
        before,
        after: template,
      })
    })

    return template
  }

  async removeTemplate(name, actor = {}) {
    const templateName = safeString(name, 80).toLowerCase()
    await this.database.mutate((state) => {
      const before = clone(state.templates[templateName] || null)
      delete state.templates[templateName]
      this.writeAuditIfChanged(state, {
        actor: buildActor(actor),
        action: 'template.remove',
        target: templateName,
        before,
        after: null,
      })
    })

    return this.listTemplates()
  }

  listWorkflows() {
    return this.snapshot().workflows
  }

  listAuditLogs(limit = 100) {
    return this.snapshot().auditLogs.slice(-limit).reverse()
  }

  listMessageLogs(limit = 100) {
    return this.snapshot().messageLogs.slice(-limit).reverse()
  }

  async logMessage(entry) {
    await this.database.mutate((state) => {
      state.messageLogs.push({
        id: `msg-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
        at: nowIso(),
        ...entry,
      })
      state.messageLogs = state.messageLogs.slice(-500)
    })
  }

  writeAudit(state, entry) {
    state.auditLogs.push({
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
      at: nowIso(),
      ...entry,
    })
    state.auditLogs = state.auditLogs.slice(-500)
  }

  writeAuditIfChanged(state, entry) {
    if (isEqual(entry.before, entry.after)) {
      return
    }

    this.writeAudit(state, entry)
  }

  createSystemSettingsAdapter() {
    return {
      get: () => this.getSystemSettings(),
      set: (patch, actor = {}) => this.setSystemSettings(patch, actor),
    }
  }

  createGroupSettingsAdapter() {
    return {
      get: (jid) => this.getGroupSettings(jid),
      set: (jid, patch, actor = {}) => this.setGroupSettings(jid, patch, actor),
      setAutoReply: (jid, trigger, response, actor = {}) =>
        this.setAutoReply(jid, trigger, response, actor),
      removeAutoReply: (jid, trigger, actor = {}) => this.removeAutoReply(jid, trigger, actor),
      addBadWord: (jid, word, actor = {}) => this.addBadWord(jid, word, actor),
      removeBadWord: (jid, word, actor = {}) => this.removeBadWord(jid, word, actor),
      list: () => this.listGroupSettings(),
    }
  }
}

export { asBoolean, normalizeNumber, safeString }
