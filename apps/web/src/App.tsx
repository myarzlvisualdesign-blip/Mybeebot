import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'

type AuthSession = {
  authenticated: boolean
  configured: boolean
  expiresAt?: string
}

type Settings = {
  botEnabled: boolean
  antiCall: boolean
  commandPrefixes: string[]
  activeHours: {
    enabled: boolean
    timezone: string
    start: string
    end: string
  }
  autoReply: {
    enabled: boolean
    mode: string
  }
  replyTiming: {
    enabled: boolean
    delaySeconds: number
  }
  improvement: {
    enabled: boolean
    minRepeats: number
    suggestionLimit: number
  }
  ai: {
    enabled: boolean
    systemPrompt: string
    tone: string
    replyStyle: string
    maxResponseLength: number
    fallbackMode: string
    allowedFeatures: string[]
    escalationRules: string
  }
  welcomeMessage: string
  fallbackMessage: string
  handoffMessage: string
  commandKeywords: Record<string, string>
  integrations: {
    webhook: {
      enabled: boolean
      url: string
      secret?: string
    }
    apiBaseUrl: string
  }
}

type Tool = {
  id: string
  name: string
  description: string
  enabled: boolean
  protected: boolean
  category: string
  input_schema: unknown
  output_schema: unknown
  last_used: string | null
  error_count: number
}

type FaqItem = {
  id: string
  question: string
  answer: string
  enabled: boolean
}

type TemplateItem = {
  name: string
  body: string
}

type ImprovementSuggestion = {
  id: string
  question: string
  normalized: string
  count: number
  lastSeenAt: string
  suggestedAnswer: string
}

type Roles = {
  owners: string[]
  admins: string[]
}

type Workflow = {
  id: string
  name: string
  enabled: boolean
  steps: string[]
}

type AuditLog = {
  id: string
  at: string
  action: string
  target: string
  actor?: {
    jid: string
    role: string
    source: string
  }
}

type MessageLog = {
  id: string
  at: string
  direction: 'in' | 'out'
  chatJid: string
  sender: string
  body: string
  mode?: string
  role?: string
  commandName?: string | null
}

type Snapshot = {
  ok: boolean
  settings: Settings
  roles: Roles
  tools: Tool[]
  faq: FaqItem[]
  improvementSuggestions: ImprovementSuggestion[]
  templates: Record<string, TemplateItem>
  workflows: Workflow[]
  auditLogs: AuditLog[]
  messageLogs: MessageLog[]
}

type BotStatus = {
  ok: boolean
  bot: string
  mode: string
  prefix: string
  connection: string
  commandCount: number
  uptimeSeconds: number
  registered: boolean
  botEnabled?: boolean
  lastDisconnectReason: string | null
}

type TestReply = {
  ok: boolean
  mode: string
  reply: string
}

type PairingResult = {
  ok: boolean
  phone?: string
  code?: string
  requestedAt?: string
  message?: string
}

type BotControlResult = {
  ok: boolean
  message?: string
  restartScheduled?: boolean
  clearedSession?: boolean
  loggedOut?: boolean
  warning?: string
}

type BotQrResult = {
  ok: boolean
  registered?: boolean
  connection?: string
  qr?: string | null
  generatedAt?: string | null
  message?: string
}

type TabKey =
  | 'overview'
  | 'whatsapp'
  | 'settings'
  | 'tools'
  | 'knowledge'
  | 'roles'
  | 'logs'
  | 'integrations'

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Ringkasan' },
  { key: 'whatsapp', label: 'Hubungkan WA' },
  { key: 'settings', label: 'Pengaturan' },
  { key: 'tools', label: 'Peralatan' },
  { key: 'knowledge', label: 'FAQ & Template' },
  { key: 'roles', label: 'Peran' },
  { key: 'logs', label: 'Log' },
  { key: 'integrations', label: 'Integrasi' },
]

const adminToolSuites = [
  {
    name: 'Pengelola Peralatan',
    channel: 'Web + WhatsApp',
    detail: 'Daftar perintah, metadata, aktif/nonaktif, terakhir dipakai, dan jumlah galat.',
  },
  {
    name: 'Pengelola Pengaturan',
    channel: 'Web + WhatsApp',
    detail: 'Status bot, prefix, jam aktif, delay balasan, improve mode, balasan otomatis, dan oper ke admin.',
  },
  {
    name: 'Router Smart Reply',
    channel: 'Rule dulu',
    detail: 'FAQ, template, dan handoff menjadi jalur utama balasan yang konsisten.',
  },
  {
    name: 'FAQ / Basis Pengetahuan',
    channel: 'Web + /faq',
    detail: 'Tambah/hapus FAQ, pencocokan kata kunci, dan tes balasan dari dashboard.',
  },
  {
    name: 'Pusat Template',
    channel: 'Web + /template',
    detail: 'Template welcome, handoff, dan pesan operasional yang bisa diedit.',
  },
  {
    name: 'Mesin Workflow',
    channel: 'Mesin berjalan',
    detail: 'pesan masuk -> intent -> perintah/FAQ/template -> izin -> eksekusi -> log -> balasan.',
  },
  {
    name: 'Jejak Audit',
    channel: 'Mesin berjalan',
    detail: 'Semua perubahan pengaturan, role, peralatan, FAQ, dan template masuk log audit.',
  },
  {
    name: 'Lab Integrasi',
    channel: 'Web',
    detail: 'URL dasar API, URL webhook, secret webhook, dan flag integrasi fitur.',
  },
  {
    name: 'Perintah Admin WhatsApp',
    channel: '/settings',
    detail: '/tool, /set, /faq, /template, /addadmin, /deladmin, /statusbot, /reload.',
  },
]

const emptySettings: Settings = {
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
  ai: {
    enabled: false,
    systemPrompt: '',
    tone: '',
    replyStyle: '',
    maxResponseLength: 400,
    fallbackMode: 'handoff',
    allowedFeatures: ['faq', 'template', 'summary'],
    escalationRules: '',
  },
  welcomeMessage: '',
  fallbackMessage: '',
  handoffMessage: '',
  commandKeywords: {},
  integrations: {
    webhook: {
      enabled: false,
      url: '',
      secret: '',
    },
    apiBaseUrl: '',
  },
}

function secondsToRuntime(seconds?: number) {
  const total = Number(seconds || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours ? `${hours}j ${minutes}m` : `${minutes}m`
}

function formatDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('id-ID')
}

function formatConnection(value?: string | null) {
  const labels: Record<string, string> = {
    open: 'terhubung',
    connecting: 'menghubungkan',
    closed: 'terputus',
    resetting: 'reset',
    booting: 'memulai',
    'boot-failed': 'gagal mulai',
  }

  return labels[String(value || '')] || 'tidak diketahui'
}

function formatWorkflowStep(step: string) {
  const labels: Record<string, string> = {
    incoming_message: 'pesan masuk',
    parse_command: 'parsing perintah',
    intent_detection: 'deteksi intent',
    command_mode: 'mode perintah',
    role_check: 'cek role',
    settings_check: 'cek pengaturan',
    workflow_router: 'router workflow',
    tool_or_reply_mode: 'pilih peralatan/balasan',
    reply_execute: 'eksekusi balasan',
    execute: 'eksekusi',
    log_result: 'catat hasil',
    send_response: 'kirim respons',
  }

  return labels[step] || step.replaceAll('_', ' ')
}

function cloneSettings(settings: Settings): Settings {
  return JSON.parse(JSON.stringify(settings)) as Settings
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (!digits) {
    return ''
  }

  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loginKey, setLoginKey] = useState('')
  const [authError, setAuthError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<Settings>(emptySettings)
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [faqQuestion, setFaqQuestion] = useState('')
  const [faqAnswer, setFaqAnswer] = useState('')
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [editingTemplateName, setEditingTemplateName] = useState<string | null>(null)
  const [roleNumber, setRoleNumber] = useState('')
  const [roleKind, setRoleKind] = useState<'admins' | 'owners'>('admins')
  const [testMessage, setTestMessage] = useState('halo, jam operasional?')
  const [testReplyResult, setTestReplyResult] = useState<TestReply | null>(null)
  const [keywordCommand, setKeywordCommand] = useState('menu')
  const [keywordValue, setKeywordValue] = useState('menu')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [pairPhone, setPairPhone] = useState('087830300031')
  const [pairingResult, setPairingResult] = useState<PairingResult | null>(null)
  const [pairingError, setPairingError] = useState('')
  const [qrImage, setQrImage] = useState('')
  const [qrMeta, setQrMeta] = useState<BotQrResult | null>(null)
  const [isGeneratingPairing, setIsGeneratingPairing] = useState(false)
  const [isLoadingQr, setIsLoadingQr] = useState(false)
  const [isResettingSession, setIsResettingSession] = useState(false)
  const [isLoggingOutDevice, setIsLoggingOutDevice] = useState(false)

  const isAuthenticated = Boolean(session?.authenticated)

  const readJson = useCallback(async <T,>(url: string, init?: RequestInit) => {
    const response = await fetch(url, init)
    const text = await response.text()
    let payload: (T & { message?: string }) | null = null

    if (text) {
      try {
        payload = JSON.parse(text) as T & { message?: string }
      } catch {
        payload = { message: text } as T & { message?: string }
      }
    }

    if (!response.ok) {
      throw new Error(payload?.message || `${url} gagal dengan status ${response.status}`)
    }

    return (payload || {}) as T
  }, [])

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      return
    }

    const [snapshotResult, healthResult] = await Promise.allSettled([
      readJson<Snapshot>('/api/admin/snapshot'),
      readJson<BotStatus>('/api/bot-health'),
    ])

    if (snapshotResult.status === 'fulfilled') {
      const nextSnapshot = snapshotResult.value
      const draft = cloneSettings(nextSnapshot.settings)
      draft.integrations.webhook.secret = ''
      setSnapshot(nextSnapshot)
      setSettingsDraft(draft)
      setError('')
    } else {
      setError(snapshotResult.reason instanceof Error ? snapshotResult.reason.message : 'Gagal memuat snapshot admin.')
    }

    if (healthResult.status === 'fulfilled') {
      setBotStatus(healthResult.value)
    }
  }, [isAuthenticated, readJson])

  const toolSummary = useMemo(() => {
    const tools = snapshot?.tools || []
    const enabled = tools.filter((tool) => tool.enabled).length
    const errors = tools.reduce((total, tool) => total + tool.error_count, 0)
    return { total: tools.length, enabled, errors }
  }, [snapshot])

  const toolCategories = useMemo(() => {
    const rows = new Map<string, { total: number; enabled: number }>()
    for (const tool of snapshot?.tools || []) {
      const row = rows.get(tool.category) || { total: 0, enabled: 0 }
      row.total += 1
      row.enabled += tool.enabled ? 1 : 0
      rows.set(tool.category, row)
    }

    return Array.from(rows.entries()).sort((left, right) => left[0].localeCompare(right[0]))
  }, [snapshot])

  useEffect(() => {
    async function checkSession() {
      try {
        const current = await readJson<AuthSession>('/api/auth/session')
        setSession(current)
      } catch {
        setSession({ authenticated: false, configured: true })
      } finally {
        setIsCheckingAuth(false)
      }
    }

    void checkSession()
  }, [readJson])

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    const timeout = window.setTimeout(() => {
      void refresh()
    }, 0)
    const interval = window.setInterval(() => {
      void refresh()
    }, 10000)

    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [isAuthenticated, refresh])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsBusy(true)
    setAuthError('')

    try {
      const nextSession = await readJson<AuthSession>('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adminKey: loginKey }),
      })
      setSession(nextSession)
      setLoginKey('')
      setNotice('Login berhasil.')
    } catch (loginError) {
      setAuthError(loginError instanceof Error ? loginError.message : 'Login gagal.')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleLogout() {
    await readJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }).catch(() => null)
    setSession({ authenticated: false, configured: true })
    setSnapshot(null)
    setBotStatus(null)
  }

  async function handleGeneratePairing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const phone = normalizePhone(pairPhone)
    if (!phone) {
      setPairingError('Nomor WhatsApp wajib diisi.')
      return
    }

    setIsGeneratingPairing(true)
    setPairingError('')
    setPairingResult(null)

    try {
      const result = await readJson<PairingResult>('/api/bot-pairing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      setPairingResult(result)
      setNotice('Kode pairing dibuat. Buka WhatsApp lalu masuk ke Perangkat tertaut.')
      await refresh()
    } catch (pairingErrorValue) {
      setPairingError(
        pairingErrorValue instanceof Error ? pairingErrorValue.message : 'Gagal membuat kode pairing.',
      )
    } finally {
      setIsGeneratingPairing(false)
    }
  }

  async function handleLoadQr() {
    setIsLoadingQr(true)
    setPairingError('')
    setQrImage('')
    setQrMeta(null)

    try {
      const result = await readJson<BotQrResult>('/api/bot-qr', { method: 'POST' })
      setQrMeta(result)
      if (result.qr) {
        setQrImage(await QRCode.toDataURL(result.qr, { margin: 2, width: 260 }))
      }
      await refresh()
    } catch (qrErrorValue) {
      setPairingError(qrErrorValue instanceof Error ? qrErrorValue.message : 'Gagal memuat QR.')
    } finally {
      setIsLoadingQr(false)
    }
  }

  async function handleResetSession() {
    if (!window.confirm('Reset sesi akan memutus pairing lokal dan bot restart. Lanjut?')) {
      return
    }

    setIsResettingSession(true)
    setPairingError('')

    try {
      const result = await readJson<BotControlResult>('/api/bot-reset', { method: 'POST' })
      setNotice(result.message || 'Session direset. Tunggu runtime restart.')
      await refresh()
    } catch (resetErrorValue) {
      setPairingError(
        resetErrorValue instanceof Error ? resetErrorValue.message : 'Gagal reset session.',
      )
    } finally {
      setIsResettingSession(false)
    }
  }

  async function handleLogoutDevice() {
    if (!window.confirm('Keluarkan perangkat akan melepas WhatsApp dari bot. Lanjut?')) {
      return
    }

    setIsLoggingOutDevice(true)
    setPairingError('')

    try {
      const result = await readJson<BotControlResult>('/api/bot-logout-device', { method: 'POST' })
      setNotice(result.message || 'Device logout. Pairing ulang setelah runtime restart.')
      await refresh()
    } catch (logoutErrorValue) {
      setPairingError(
        logoutErrorValue instanceof Error ? logoutErrorValue.message : 'Gagal logout device.',
      )
    } finally {
      setIsLoggingOutDevice(false)
    }
  }

  function updateSettings(mutator: (draft: Settings) => void) {
    setSettingsDraft((current) => {
      const next = cloneSettings(current)
      mutator(next)
      return next
    })
  }

  async function saveSettings() {
    setIsBusy(true)
    setError('')

    const payload = cloneSettings(settingsDraft)
    if (webhookSecret.trim()) {
      payload.integrations.webhook.secret = webhookSecret.trim()
    } else {
      delete payload.integrations.webhook.secret
    }

    try {
      await readJson<{ ok: boolean; settings: Settings }>('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      })
      setWebhookSecret('')
      setNotice('Pengaturan tersimpan dan langsung dipakai runtime WhatsApp.')
      await refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan pengaturan.')
    } finally {
      setIsBusy(false)
    }
  }

  async function toggleTool(tool: Tool) {
    setIsBusy(true)
    setError('')

    try {
      await readJson<{ ok: boolean; tools: Tool[] }>(`/api/admin/tools/${encodeURIComponent(tool.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: !tool.enabled }),
      })
      setNotice(`Peralatan ${tool.name} ${tool.enabled ? 'dinonaktifkan' : 'diaktifkan'}.`)
      await refresh()
    } catch (toolError) {
      setError(toolError instanceof Error ? toolError.message : 'Gagal mengubah peralatan.')
    } finally {
      setIsBusy(false)
    }
  }

  async function toggleToolCategory(category: string, enabled: boolean) {
    const tools = (snapshot?.tools || []).filter(
      (tool) => tool.category === category && !tool.protected && tool.enabled !== enabled,
    )

    if (!tools.length) {
      setNotice(`Tidak ada peralatan kategori ${category} yang perlu diubah.`)
      return
    }

    setIsBusy(true)
    setError('')

    try {
      await Promise.all(
        tools.map((tool) =>
          readJson<{ ok: boolean; tools: Tool[] }>(`/api/admin/tools/${encodeURIComponent(tool.id)}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ enabled }),
          }),
        ),
      )
      setNotice(`Kategori ${category} ${enabled ? 'diaktifkan' : 'dinonaktifkan'}.`)
      await refresh()
    } catch (toolError) {
      setError(toolError instanceof Error ? toolError.message : 'Gagal mengubah kategori peralatan.')
    } finally {
      setIsBusy(false)
    }
  }

  async function saveFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsBusy(true)
    setError('')

    try {
      await readJson(editingFaqId ? `/api/admin/faq/${encodeURIComponent(editingFaqId)}` : '/api/admin/faq', {
        method: editingFaqId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: faqQuestion, answer: faqAnswer }),
      })
      setFaqQuestion('')
      setFaqAnswer('')
      setEditingFaqId(null)
      setNotice(editingFaqId ? 'FAQ diperbarui.' : 'FAQ ditambahkan.')
      await refresh()
    } catch (faqError) {
      setError(faqError instanceof Error ? faqError.message : 'Gagal menyimpan FAQ.')
    } finally {
      setIsBusy(false)
    }
  }

  function editFaq(item: FaqItem) {
    setEditingFaqId(item.id)
    setFaqQuestion(item.question)
    setFaqAnswer(item.answer)
  }

  function cancelFaqEdit() {
    setEditingFaqId(null)
    setFaqQuestion('')
    setFaqAnswer('')
  }

  function applyImprovementSuggestion(item: ImprovementSuggestion) {
    setEditingFaqId(null)
    setFaqQuestion(item.question)
    setFaqAnswer(item.suggestedAnswer || settingsDraft.handoffMessage || settingsDraft.fallbackMessage)
    setActiveTab('knowledge')
    setNotice(`Saran improve "${item.question}" dimasukkan ke form FAQ.`)
  }

  async function deleteFaq(id: string) {
    await readJson(`/api/admin/faq/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (editingFaqId === id) {
      cancelFaqEdit()
    }
    setNotice('FAQ dihapus.')
    await refresh()
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsBusy(true)
    setError('')

    try {
      await readJson('/api/admin/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: templateName, body: templateBody }),
      })
      setTemplateName('')
      setTemplateBody('')
      setEditingTemplateName(null)
      setNotice(editingTemplateName ? 'Template diperbarui.' : 'Template disimpan.')
      await refresh()
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : 'Gagal menyimpan template.')
    } finally {
      setIsBusy(false)
    }
  }

  function editTemplate(template: TemplateItem) {
    setEditingTemplateName(template.name)
    setTemplateName(template.name)
    setTemplateBody(template.body)
  }

  function cancelTemplateEdit() {
    setEditingTemplateName(null)
    setTemplateName('')
    setTemplateBody('')
  }

  async function deleteTemplate(name: string) {
    await readJson(`/api/admin/templates/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (editingTemplateName === name) {
      cancelTemplateEdit()
    }
    setNotice('Template dihapus.')
    await refresh()
  }

  async function saveKeyword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const commandKeywords = {
      ...settingsDraft.commandKeywords,
      [keywordCommand.trim().toLowerCase()]: keywordValue.trim().toLowerCase(),
    }
    updateSettings((draft) => {
      draft.commandKeywords = commandKeywords
    })
    await readJson('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ settings: { commandKeywords } }),
    })
    setNotice('Kata kunci perintah disimpan.')
    await refresh()
  }

  async function addRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await readJson('/api/admin/roles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: roleKind, number: roleNumber }),
    })
    setRoleNumber('')
    setNotice('Role ditambahkan.')
    await refresh()
  }

  async function deleteRole(role: 'admins' | 'owners', number: string) {
    await readJson('/api/admin/roles', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role, number }),
    })
    setNotice('Role dihapus.')
    await refresh()
  }

  async function handleTestReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await readJson<TestReply>('/api/admin/test-reply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: testMessage }),
    })
    setTestReplyResult(result)
  }

  if (isCheckingAuth) {
    return <main className="center-shell">Memuat sesi admin...</main>
  }

  if (!isAuthenticated) {
    return (
      <main className="login-shell">
        <form className="login-panel" onSubmit={handleLogin}>
          <img src="/favicon.svg" alt="" className="brand-mark" />
          <h1>Mybeebot Admin</h1>
          <p>Masuk untuk mengelola pengaturan, registry peralatan, FAQ, template, peran, dan log mesin WhatsApp.</p>
          <label>
            Kunci admin
            <input
              type="password"
              value={loginKey}
              onChange={(event) => setLoginKey(event.target.value)}
              placeholder="BOT_ADMIN_KEY"
            />
          </label>
          {authError ? <p className="alert error">{authError}</p> : null}
          <button type="submit" disabled={isBusy}>
            Masuk
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand-button" type="button" onClick={() => setActiveTab('overview')}>
          <img src="/favicon.svg" alt="" className="brand-mark" />
          <span>
            <strong>Mybeebot</strong>
            <small>Dashboard admin</small>
          </span>
        </button>
        <nav className="tab-list" aria-label="Bagian dashboard">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'active' : ''}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <button className="secondary" type="button" onClick={() => void refresh()}>
          Segarkan
        </button>
        <button className="danger" type="button" onClick={() => void handleLogout()}>
          Keluar
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Satu sumber data</p>
            <h1>{tabs.find((tab) => tab.key === activeTab)?.label}</h1>
          </div>
          <div className="status-pill">
            <span className={botStatus?.connection === 'open' ? 'dot ok' : 'dot warn'} />
            {formatConnection(botStatus?.connection)}
          </div>
        </header>

        {notice ? <p className="alert success">{notice}</p> : null}
        {error ? <p className="alert error">{error}</p> : null}

        {activeTab === 'overview' && (
          <section className="section-grid">
            <div className="metric">
              <span>Bot</span>
              <strong>{settingsDraft.botEnabled ? 'Aktif' : 'Nonaktif'}</strong>
              <small>{botStatus?.registered ? 'WhatsApp tertaut' : 'Belum tertaut'}</small>
            </div>
            <div className="metric">
              <span>Command</span>
              <strong>{botStatus?.commandCount || snapshot?.tools.length || 0}</strong>
              <small>{toolSummary.enabled}/{toolSummary.total} peralatan aktif</small>
            </div>
            <div className="metric">
              <span>Waktu jalan</span>
              <strong>{secondsToRuntime(botStatus?.uptimeSeconds)}</strong>
              <small>{botStatus?.lastDisconnectReason || 'tanpa putus koneksi'}</small>
            </div>
            <div className="metric">
              <span>Improve</span>
              <strong>{settingsDraft.improvement.enabled ? 'Aktif' : 'Nonaktif'}</strong>
              <small>{snapshot?.improvementSuggestions?.length || 0} saran siap pakai</small>
            </div>
            <div className="metric">
              <span>Delay balas</span>
              <strong>
                {settingsDraft.replyTiming.enabled
                  ? `${settingsDraft.replyTiming.delaySeconds} dtk`
                  : 'otomatis'}
              </strong>
              <small>
                Improve {settingsDraft.improvement.enabled ? 'aktif' : 'mati'}
              </small>
            </div>

            <section className="panel wide">
              <h2>Workflow aktif</h2>
              <div className="workflow-row">
                {snapshot?.workflows[0]?.steps.map((step) => <span key={step}>{formatWorkflowStep(step)}</span>)}
              </div>
            </section>

            <section className="panel wide">
              <h2>Tes balasan</h2>
              <form className="inline-form" onSubmit={handleTestReply}>
                <input value={testMessage} onChange={(event) => setTestMessage(event.target.value)} />
                <button type="submit">Tes</button>
              </form>
              {testReplyResult ? (
                <pre className="reply-box">{JSON.stringify(testReplyResult, null, 2)}</pre>
              ) : null}
            </section>
          </section>
        )}

        {activeTab === 'whatsapp' && (
          <section className="section-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Kode pairing</p>
                  <h2>Masukkan nomor WhatsApp</h2>
                </div>
                <span className="status-pill">
                  {botStatus?.registered ? 'Sudah tertaut' : 'Belum tertaut'}
                </span>
              </div>
              <form className="stack" onSubmit={handleGeneratePairing}>
                <label>
                  Nomor WhatsApp
                  <input
                    value={pairPhone}
                    onChange={(event) => setPairPhone(event.target.value)}
                    placeholder="0878xxxx atau 62878xxxx"
                  />
                </label>
                <button type="submit" disabled={isGeneratingPairing || Boolean(botStatus?.registered)}>
                  {isGeneratingPairing ? 'Membuat kode...' : 'Buat kode pairing'}
                </button>
              </form>
              {pairingResult?.code ? (
                <div className="pairing-code-box">
                  <span>Kode pairing</span>
                  <strong>{pairingResult.code}</strong>
                  <p>Buka WhatsApp di HP, masuk Perangkat tertaut, lalu pilih Tautkan dengan nomor telepon.</p>
                </div>
              ) : null}
              {pairingResult?.message ? <p className="helper-text">{pairingResult.message}</p> : null}
              {pairingError ? <p className="alert error">{pairingError}</p> : null}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">QR cadangan</p>
                  <h2>Scan QR WhatsApp</h2>
                </div>
                <button type="button" onClick={() => void handleLoadQr()} disabled={isLoadingQr || Boolean(botStatus?.registered)}>
                  {isLoadingQr ? 'Memuat QR...' : 'Muat QR'}
                </button>
              </div>
              <div className="qr-box">
                {qrImage ? <img src={qrImage} alt="QR WhatsApp pairing" /> : <span>QR akan muncul di sini.</span>}
              </div>
              {qrMeta?.message ? <p className="helper-text">{qrMeta.message}</p> : null}
            </section>

            <section className="panel wide">
              <h2>Langkah pairing</h2>
              <div className="workflow-row">
                <span>1. Isi nomor WhatsApp</span>
                <span>2. Klik buat kode pairing</span>
                <span>3. Buka WhatsApp HP</span>
                <span>4. Perangkat tertaut</span>
                <span>5. Tautkan dengan nomor telepon</span>
                <span>6. Masukkan kode</span>
              </div>
            </section>

            <section className="panel wide">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Pemulihan</p>
                  <h2>Reset / keluarkan perangkat</h2>
                </div>
                <span className="status-pill">{formatConnection(botStatus?.connection)}</span>
              </div>
              <div className="action-grid">
                <button type="button" onClick={() => void handleResetSession()} disabled={isResettingSession}>
                  {isResettingSession ? 'Mereset...' : 'Reset sesi'}
                </button>
                <button type="button" onClick={() => void handleLogoutDevice()} disabled={isLoggingOutDevice}>
                  {isLoggingOutDevice ? 'Mengeluarkan...' : 'Keluarkan perangkat'}
                </button>
              </div>
            </section>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="panel stack">
            <div className="switch-grid">
              <label className="switch-line">
                <input
                  type="checkbox"
                  checked={settingsDraft.botEnabled}
                  onChange={(event) => updateSettings((draft) => { draft.botEnabled = event.target.checked })}
                />
                Bot aktif
              </label>
              <label className="switch-line">
                <input
                  type="checkbox"
                  checked={settingsDraft.antiCall}
                  onChange={(event) => updateSettings((draft) => { draft.antiCall = event.target.checked })}
                />
                Anti telepon
              </label>
              <label className="switch-line">
                <input
                  type="checkbox"
                  checked={settingsDraft.autoReply.enabled}
                  onChange={(event) => updateSettings((draft) => { draft.autoReply.enabled = event.target.checked })}
                />
                Balasan otomatis
              </label>
            </div>

            <div className="form-grid">
              <label>
                Mode balasan saat FAQ tidak cocok
                <select value={settingsDraft.ai.fallbackMode} onChange={(event) => updateSettings((draft) => { draft.ai.fallbackMode = event.target.value })}>
                  <option value="handoff">oper ke admin</option>
                  <option value="template">pakai template</option>
                  <option value="silent">diam</option>
                </select>
              </label>
            </div>

            <div className="form-grid">
              <label>
                Prefix perintah
                <input
                  value={settingsDraft.commandPrefixes.join(', ')}
                  onChange={(event) => updateSettings((draft) => { draft.commandPrefixes = event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                />
              </label>
              <label>
                Mode balasan otomatis
                <select value={settingsDraft.autoReply.mode} onChange={(event) => updateSettings((draft) => { draft.autoReply.mode = event.target.value })}>
                  <option value="faq-first">FAQ dulu</option>
                  <option value="ai-first">template lalu handoff</option>
                  <option value="off">mati</option>
                </select>
              </label>
              <label>
                Delay balasan (detik)
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={settingsDraft.replyTiming.delaySeconds}
                  onChange={(event) => updateSettings((draft) => { draft.replyTiming.delaySeconds = Number(event.target.value) })}
                />
              </label>
              <label>
                Mulai aktif
                <input value={settingsDraft.activeHours.start} onChange={(event) => updateSettings((draft) => { draft.activeHours.start = event.target.value })} />
              </label>
              <label>
                Selesai aktif
                <input value={settingsDraft.activeHours.end} onChange={(event) => updateSettings((draft) => { draft.activeHours.end = event.target.value })} />
              </label>
            </div>

            <label className="switch-line">
              <input
                type="checkbox"
                checked={settingsDraft.replyTiming.enabled}
                onChange={(event) => updateSettings((draft) => { draft.replyTiming.enabled = event.target.checked })}
              />
              Pakai delay balasan tetap
            </label>

            <label className="switch-line">
              <input
                type="checkbox"
                checked={settingsDraft.activeHours.enabled}
                onChange={(event) => updateSettings((draft) => { draft.activeHours.enabled = event.target.checked })}
              />
              Batasi jam aktif bot
            </label>

            <div className="form-grid">
              <label className="switch-line">
                <input
                  type="checkbox"
                  checked={settingsDraft.improvement.enabled}
                  onChange={(event) => updateSettings((draft) => { draft.improvement.enabled = event.target.checked })}
                />
                Mode improve aktif
              </label>
              <label>
                Minimal pengulangan
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={settingsDraft.improvement.minRepeats}
                  onChange={(event) => updateSettings((draft) => { draft.improvement.minRepeats = Number(event.target.value) })}
                />
              </label>
              <label>
                Batas saran improve
                <input
                  type="number"
                  min={3}
                  max={20}
                  value={settingsDraft.improvement.suggestionLimit}
                  onChange={(event) => updateSettings((draft) => { draft.improvement.suggestionLimit = Number(event.target.value) })}
                />
              </label>
            </div>

            <label>
              Pesan welcome
              <textarea rows={3} value={settingsDraft.welcomeMessage} onChange={(event) => updateSettings((draft) => { draft.welcomeMessage = event.target.value })} />
            </label>
            <label>
              Pesan cadangan
              <textarea rows={3} value={settingsDraft.fallbackMessage} onChange={(event) => updateSettings((draft) => { draft.fallbackMessage = event.target.value })} />
            </label>
            <label>
              Pesan oper ke admin
              <textarea rows={3} value={settingsDraft.handoffMessage} onChange={(event) => updateSettings((draft) => { draft.handoffMessage = event.target.value })} />
            </label>

            <form className="inline-form" onSubmit={saveKeyword}>
              <input value={keywordCommand} onChange={(event) => setKeywordCommand(event.target.value)} placeholder="perintah" />
              <input value={keywordValue} onChange={(event) => setKeywordValue(event.target.value)} placeholder="kata kunci baru" />
              <button type="submit">Simpan keyword</button>
            </form>

            <button className="primary" type="button" disabled={isBusy} onClick={() => void saveSettings()}>
              Simpan pengaturan
            </button>
          </section>
        )}

        {activeTab === 'tools' && (
          <section className="section-grid">
            <section className="panel wide">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Peralatan yang tersedia</p>
                  <h2>Suite peralatan admin</h2>
                </div>
                <span className="status-pill">{toolSummary.enabled}/{toolSummary.total} perintah aktif</span>
              </div>
              <div className="tool-suite-grid">
                {adminToolSuites.map((tool) => (
                  <article className="tool-suite" key={tool.name}>
                    <span>{tool.channel}</span>
                    <strong>{tool.name}</strong>
                    <p>{tool.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Kontrol grup peralatan</p>
                  <h2>Kategori peralatan</h2>
                </div>
              </div>
              <div className="tool-category-list">
                {toolCategories.map(([category, row]) => (
                  <article key={category}>
                    <div>
                      <strong>{category}</strong>
                      <span>{row.enabled}/{row.total} aktif</span>
                    </div>
                    <div className="button-row">
                      <button type="button" disabled={isBusy || row.enabled === row.total} onClick={() => void toggleToolCategory(category, true)}>
                        Aktifkan grup
                      </button>
                      <button type="button" className="danger" disabled={isBusy || row.enabled === 0} onClick={() => void toggleToolCategory(category, false)}>
                        Nonaktifkan grup
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2>Metadata wajib</h2>
              <div className="schema-list">
                {[
                  'id',
                  'nama',
                  'deskripsi',
                  'status aktif',
                  'kategori',
                  'skema input',
                  'skema output',
                  'terakhir dipakai',
                  'jumlah galat',
                ].map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </section>

            <section className="panel wide">
              <h2>Daftar perintah peralatan</h2>
              <div className="table">
                {snapshot?.tools.map((tool) => (
                  <div className="table-row" key={tool.id}>
                    <div>
                      <strong>{tool.name}</strong>
                      <small>{tool.description}</small>
                    </div>
                    <span>{tool.category}</span>
                    <span>{tool.error_count} galat</span>
                    <span>{tool.last_used ? formatDate(tool.last_used) : 'belum dipakai'}</span>
                    <button type="button" disabled={tool.protected || isBusy} onClick={() => void toggleTool(tool)}>
                      {tool.enabled ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </section>
        )}

        {activeTab === 'knowledge' && (
          <section className="section-grid">
            <section className="panel">
              <h2>Saran improve bot</h2>
              <div className="list">
                {(snapshot?.improvementSuggestions || []).length ? (
                  snapshot?.improvementSuggestions.map((item) => (
                    <article key={item.id}>
                      <strong>{item.question}</strong>
                      <p>
                        Dipakai {item.count}x, terakhir {formatDate(item.lastSeenAt)}
                      </p>
                      <div className="button-row">
                        <button type="button" onClick={() => applyImprovementSuggestion(item)}>
                          Jadikan FAQ
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <article>
                    <strong>Belum ada saran improve.</strong>
                    <p>Bot akan menampilkan saran dari pesan user yang sering berulang tetapi belum masuk FAQ.</p>
                  </article>
                )}
              </div>
            </section>

            <section className="panel">
              <h2>FAQ</h2>
              <form className="stack" onSubmit={saveFaq}>
                <input value={faqQuestion} onChange={(event) => setFaqQuestion(event.target.value)} placeholder="Pertanyaan" />
                <textarea rows={4} value={faqAnswer} onChange={(event) => setFaqAnswer(event.target.value)} placeholder="Jawaban" />
                <div className="button-row">
                  <button type="submit">{editingFaqId ? 'Simpan perubahan' : 'Tambah FAQ'}</button>
                  {editingFaqId ? (
                    <button type="button" className="secondary" onClick={cancelFaqEdit}>
                      Batal
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="list">
                {snapshot?.faq.map((item) => (
                  <article key={item.id}>
                    <strong>{item.question}</strong>
                    <p>{item.answer}</p>
                    <div className="button-row">
                      <button type="button" onClick={() => editFaq(item)}>Edit</button>
                      <button type="button" className="danger" onClick={() => void deleteFaq(item.id)}>Hapus</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2>Template</h2>
              <form className="stack" onSubmit={saveTemplate}>
                <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Nama template" readOnly={Boolean(editingTemplateName)} />
                <textarea rows={4} value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder="Isi template" />
                <div className="button-row">
                  <button type="submit">{editingTemplateName ? 'Simpan perubahan' : 'Simpan template'}</button>
                  {editingTemplateName ? (
                    <button type="button" className="secondary" onClick={cancelTemplateEdit}>
                      Batal
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="list">
                {Object.values(snapshot?.templates || {}).map((template) => (
                  <article key={template.name}>
                    <strong>{template.name}</strong>
                    <p>{template.body}</p>
                    <div className="button-row">
                      <button type="button" onClick={() => editTemplate(template)}>Edit</button>
                      <button type="button" className="danger" onClick={() => void deleteTemplate(template.name)}>Hapus</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {activeTab === 'roles' && (
          <section className="panel stack">
            <h2>Owner & admin</h2>
            <form className="inline-form" onSubmit={addRole}>
              <select value={roleKind} onChange={(event) => setRoleKind(event.target.value as 'admins' | 'owners')}>
                <option value="admins">Admin</option>
                <option value="owners">Owner</option>
              </select>
              <input value={roleNumber} onChange={(event) => setRoleNumber(event.target.value)} placeholder="6281234567890 atau 123@lid" />
              <button type="submit">Tambah role</button>
            </form>
            <div className="role-grid">
              <div>
                <h3>Owner</h3>
                {(snapshot?.roles.owners || []).map((number) => (
                  <p key={number}>
                    {number}
                    <button type="button" onClick={() => void deleteRole('owners', number)}>hapus</button>
                  </p>
                ))}
              </div>
              <div>
                <h3>Admin</h3>
                {(snapshot?.roles.admins || []).map((number) => (
                  <p key={number}>
                    {number}
                    <button type="button" onClick={() => void deleteRole('admins', number)}>hapus</button>
                  </p>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'logs' && (
          <section className="section-grid">
            <section className="panel">
              <h2>Log pesan</h2>
              <div className="log-list">
                {snapshot?.messageLogs.map((log) => (
                  <article key={log.id}>
                    <span>{formatDate(log.at)} - {log.direction}</span>
                    <strong>{log.sender}</strong>
                    <p>{log.body}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="panel">
              <h2>Jejak audit</h2>
              <div className="log-list">
                {snapshot?.auditLogs.map((log) => (
                  <article key={log.id}>
                    <span>{formatDate(log.at)}</span>
                    <strong>{log.action}</strong>
                    <p>{log.target} oleh {log.actor?.source || 'system'}</p>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {activeTab === 'integrations' && (
          <section className="panel stack">
            <h2>API & webhook</h2>
            <label>
              URL dasar API
              <input value={settingsDraft.integrations.apiBaseUrl} onChange={(event) => updateSettings((draft) => { draft.integrations.apiBaseUrl = event.target.value })} />
            </label>
            <label className="switch-line">
              <input
                type="checkbox"
                checked={settingsDraft.integrations.webhook.enabled}
                onChange={(event) => updateSettings((draft) => { draft.integrations.webhook.enabled = event.target.checked })}
              />
              Webhook aktif
            </label>
            <label>
              URL webhook
              <input value={settingsDraft.integrations.webhook.url} onChange={(event) => updateSettings((draft) => { draft.integrations.webhook.url = event.target.value })} />
            </label>
            <label>
              Kunci rahasia webhook
              <input type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="isi hanya jika ingin mengganti" />
            </label>
            <label>
              Aturan handoff
              <textarea rows={5} value={settingsDraft.ai.escalationRules} onChange={(event) => updateSettings((draft) => { draft.ai.escalationRules = event.target.value })} />
            </label>
            <button className="primary" type="button" disabled={isBusy} onClick={() => void saveSettings()}>
              Simpan integrasi
            </button>
          </section>
        )}
      </section>
    </main>
  )
}

export default App
