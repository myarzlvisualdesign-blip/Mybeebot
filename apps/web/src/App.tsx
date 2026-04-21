import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

type LiveStatus = {
  name: string
  status: string
  domain: string
  runtime: string
  edgeServedAt: string
  commands: string[]
}

type BotStatus = {
  ok: boolean
  bot: string
  mode: string
  prefix: string
  connection: string
  commandCount: number
  lastConnectedAt: string | null
  lastDisconnectReason: string | null
  uptimeSeconds: number
  registered: boolean
  lastPairingRequestAt: string | null
  qrAvailable?: boolean
  lastQrAt?: string | null
}

type LiveMeta = {
  name: string
  repoUrl: string
  upstreamUrl: string
  deployment: string
  botHealthProxy: string
  botMetaProxy: string
  botTunnelConfigured: boolean
  note: string
}

type BotCommandMeta = {
  name: string
  aliases: string[]
  category: string
  description: string
  ownerOnly: boolean
}

type BotMeta = {
  ok: boolean
  bot: string
  repoUrl: string
  websiteUrl: string
  healthUrl: string
  localPairingUrl: string
  commands?: BotCommandMeta[]
}

type PairingResult = {
  ok: boolean
  phone?: string
  code?: string
  requestedAt?: string
  message?: string
}

type ResetResult = {
  ok: boolean
  message?: string
  restartScheduled?: boolean
  clearedSession?: boolean
}

type BotQrResult = {
  ok: boolean
  registered?: boolean
  connection?: string
  qr?: string | null
  generatedAt?: string | null
  message?: string
}

type ActivityEntry = {
  id: string
  text: string
  time: string
  tone: 'info' | 'success' | 'error'
}

type InspectorResult = {
  label: string
  payload: string
  tone: 'info' | 'success' | 'error'
}

const ADMIN_KEY_STORAGE = 'mybeebot-admin-key'
const MAX_ACTIVITY = 10

const commandDescriptions: Record<string, string> = {
  '.menu': 'Open the main control sheet.',
  '.help': 'Readable command summary.',
  '.ping': 'Latency and runtime check.',
  '.alive': 'Current identity and health.',
  '.owner': 'Show owner identity and contact.',
  '.repo': 'Jump to the repository.',
  '.uptime': 'Show bot runtime duration.',
  '.rules': 'Show the usage rules.',
  '.donate': 'Show support and donation info.',
  '.id': 'Show current chat and sender ID.',
  '.groupinfo': 'Show current group information.',
  '.admins': 'Mention the group admins.',
  '.tagall': 'Mention everyone in the group.',
  '.hidetag': 'Send a hidden mention to all members.',
  '.echo': 'Fast command response test.',
  '.reload': 'Reload modules for the owner.',
}

const commandExamples: Record<string, string> = {
  '.add': '.add 6281234567890',
  '.admins': '.admins',
  '.menu': '.menu',
  '.help': '.help',
  '.ping': '.ping',
  '.alive': '.alive',
  '.close': '.close',
  '.demote': '.demote @user',
  '.goodbye': '.goodbye on',
  '.groupconfig': '.groupconfig',
  '.groupinfo': '.groupinfo',
  '.hidetag': '.hidetag silent message here',
  '.owner': '.owner',
  '.kick': '.kick @user',
  '.linkgroup': '.linkgroup',
  '.open': '.open',
  '.promote': '.promote @user',
  '.repo': '.repo',
  '.uptime': '.uptime',
  '.rules': '.rules',
  '.setdesc': '.setdesc New group description',
  '.setsubject': '.setsubject New Group Name',
  '.welcome': '.welcome on',
  '.donate': '.donate',
  '.id': '.id',
  '.tagall': '.tagall Attention everyone',
  '.echo': '.echo halo',
  '.reload': '.reload',
}

const railItems = [
  { short: 'OV', label: 'Overview', section: 'overview' },
  { short: 'PR', label: 'Pairing', section: 'pairing' },
  { short: 'US', label: 'Use Bot', section: 'use' },
  { short: 'CM', label: 'Commands', section: 'commands' },
  { short: 'API', label: 'API', section: 'api' },
  { short: 'LG', label: 'Activity', section: 'activity' },
] as const

const endpointCatalog = [
  {
    key: 'status',
    label: 'Edge status',
    method: 'GET',
    path: '/api/status',
    description: 'Cloudflare route, runtime, and command registry.',
  },
  {
    key: 'meta',
    label: 'Edge meta',
    method: 'GET',
    path: '/api/meta',
    description: 'Deploy metadata and proxy configuration.',
  },
  {
    key: 'bot-health',
    label: 'Bot health',
    method: 'GET',
    path: '/api/bot-health',
    description: 'Current bot socket state and pairing readiness.',
  },
  {
    key: 'bot-meta',
    label: 'Bot meta',
    method: 'GET',
    path: '/api/bot-meta',
    description: 'Node runtime metadata behind the proxy.',
  },
] as const

function formatUptime(seconds: number | undefined) {
  if (!seconds) {
    return '0m'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

function formatClock(value: string | null | undefined) {
  if (!value) {
    return 'pending'
  }

  return new Date(value).toLocaleTimeString()
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'not yet'
  }

  return new Date(value).toLocaleString()
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Morning'
  }

  if (hour < 18) {
    return 'Afternoon'
  }

  return 'Evening'
}

function getProgress(connection?: string) {
  if (connection === 'open') {
    return 100
  }

  if (connection === 'connecting') {
    return 68
  }

  if (connection === 'closed') {
    return 26
  }

  if (connection === 'resetting') {
    return 14
  }

  return 18
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')

  if (!digits) {
    return ''
  }

  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`
  }

  return digits
}

function App() {
  const [status, setStatus] = useState<LiveStatus | null>(null)
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [liveMeta, setLiveMeta] = useState<LiveMeta | null>(null)
  const [botMeta, setBotMeta] = useState<BotMeta | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [botStatusError, setBotStatusError] = useState<string | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [pairPhone, setPairPhone] = useState('087830300031')
  const [adminKey, setAdminKey] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem(ADMIN_KEY_STORAGE) ?? ''
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState('overview')
  const [pairingResult, setPairingResult] = useState<PairingResult | null>(null)
  const [pairingError, setPairingError] = useState<string | null>(null)
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [qrMeta, setQrMeta] = useState<BotQrResult | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isLoadingQr, setIsLoadingQr] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [inspector, setInspector] = useState<InspectorResult | null>(null)
  const [inspectingKey, setInspectingKey] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const previousSnapshot = useRef<string>('')

  const addActivity = useCallback((text: string, tone: ActivityEntry['tone']) => {
    setActivity((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
        text,
        time: new Date().toISOString(),
        tone,
      },
      ...current,
    ].slice(0, MAX_ACTIVITY))
  }, [])

  async function copyText(value: string, label: string) {
    if (!value) {
      addActivity(`${label} is empty.`, 'error')
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setCopyNotice(`${label} copied`)
      addActivity(`${label} copied to clipboard.`, 'success')
      window.setTimeout(() => {
        setCopyNotice((current) => (current === `${label} copied` ? null : current))
      }, 2200)
    } catch {
      setCopyNotice(null)
      addActivity(`Unable to copy ${label}.`, 'error')
    }
  }

  function jumpToSection(section: string) {
    setActiveSection(section)
    document.getElementById(`section-${section}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  async function readJson<T>(url: string, init?: RequestInit) {
    const response = await fetch(url, init)
    const text = await response.text()
    const payload = text ? (JSON.parse(text) as T & { message?: string }) : ({} as T)

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'message' in payload
          ? String(payload.message || '')
          : ''

      throw new Error(message || `${url} failed with ${response.status}`)
    }

    return payload as T
  }

  const refreshAll = useCallback(async (options?: { announce?: boolean }) => {
    setIsRefreshing(true)

    const [statusResult, botStatusResult, liveMetaResult, botMetaResult] =
      await Promise.allSettled([
        readJson<LiveStatus>('/api/status'),
        readJson<BotStatus>('/api/bot-health'),
        readJson<LiveMeta>('/api/meta'),
        readJson<BotMeta>('/api/bot-meta'),
      ])

    if (statusResult.status === 'fulfilled') {
      setStatus(statusResult.value)
      setStatusError(null)
    } else {
      setStatusError(statusResult.reason instanceof Error ? statusResult.reason.message : 'Unable to reach live status endpoint.')
    }

    if (botStatusResult.status === 'fulfilled') {
      setBotStatus(botStatusResult.value)
      setBotStatusError(null)
    } else {
      setBotStatusError(botStatusResult.reason instanceof Error ? botStatusResult.reason.message : 'Unable to reach bot health proxy.')
    }

    if (liveMetaResult.status === 'fulfilled') {
      setLiveMeta(liveMetaResult.value)
      setMetaError(null)
    } else {
      setMetaError(liveMetaResult.reason instanceof Error ? liveMetaResult.reason.message : 'Unable to reach edge metadata.')
    }

    if (botMetaResult.status === 'fulfilled') {
      setBotMeta(botMetaResult.value)
      setMetaError(null)
    } else if (liveMetaResult.status !== 'rejected') {
      setMetaError(botMetaResult.reason instanceof Error ? botMetaResult.reason.message : 'Unable to reach bot metadata.')
    }

    setLastSyncedAt(new Date().toISOString())

    if (options?.announce) {
      addActivity('Dashboard synced from live endpoints.', 'info')
    }

    setIsRefreshing(false)
  }, [addActivity])

  useEffect(() => {
    const refresh = () => {
      void refreshAll()
    }

    const timeout = window.setTimeout(refresh, 0)
    const interval = window.setInterval(refresh, 8000)

    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [refreshAll])

  useEffect(() => {
    if (!adminKey) {
      window.localStorage.removeItem(ADMIN_KEY_STORAGE)
      return
    }

    window.localStorage.setItem(ADMIN_KEY_STORAGE, adminKey)
  }, [adminKey])

  useEffect(() => {
    if (!status || !botStatus) {
      return
    }

    const snapshot = [
      status.status,
      botStatus.connection,
      botStatus.registered ? 'registered' : 'unregistered',
      botStatus.lastDisconnectReason ?? 'none',
    ].join('|')

    if (!previousSnapshot.current) {
      previousSnapshot.current = snapshot
      addActivity('Dashboard connected to live bot runtime.', 'success')
      return
    }

    if (previousSnapshot.current !== snapshot) {
      previousSnapshot.current = snapshot
      addActivity(
        `Runtime changed to ${botStatus.connection}. Registered: ${botStatus.registered ? 'yes' : 'no'}.`,
        botStatus.connection === 'open' ? 'success' : 'info',
      )
    }
  }, [status, botStatus, addActivity])

  const greeting = getGreeting()
  const searchNeedle = searchQuery.trim().toLowerCase()
  const edgeProgress = status?.status === 'live' ? 100 : 54
  const runtimeProgress = getProgress(botStatus?.connection)
  const pairingProgress = botStatus?.registered ? 100 : botStatus?.qrAvailable ? 62 : 34
  const commandProgress = botStatus?.commandCount
    ? Math.min(100, 44 + botStatus.commandCount * 8)
    : 52
  const overallReadiness = Math.round(
    (edgeProgress + runtimeProgress + pairingProgress + commandProgress) / 4,
  )
  const activeCommands = botMeta?.commands?.length
    ? botMeta.commands.map((command) => `.${command.name}`)
    : status?.commands?.length
      ? status.commands
      : Object.keys(commandDescriptions)
  const normalizedPhone = normalizePhone(pairPhone)
  const isLinked = Boolean(botStatus?.registered)
  const isBotReady = isLinked && botStatus?.connection === 'open'
  const starterCommands = ['.menu', '.ping', '.alive', '.owner']

  const filteredCommands = activeCommands.filter((command) => {
    if (!searchNeedle) {
      return true
    }

    return (
      command.toLowerCase().includes(searchNeedle) ||
      String(commandDescriptions[command] || '').toLowerCase().includes(searchNeedle) ||
      String(commandExamples[command] || '').toLowerCase().includes(searchNeedle)
    )
  })

  const filteredEndpoints = endpointCatalog.filter((endpoint) => {
    if (!searchNeedle) {
      return true
    }

    return (
      endpoint.label.toLowerCase().includes(searchNeedle) ||
      endpoint.path.toLowerCase().includes(searchNeedle) ||
      endpoint.description.toLowerCase().includes(searchNeedle)
    )
  })

  const workflowRows = [
    {
      label: 'Edge worker bundle',
      detail: status?.domain ?? 'Waiting for route',
      percent: edgeProgress,
      state: status?.status ?? 'Syncing',
    },
    {
      label: 'Bot health proxy',
      detail: liveMeta?.botHealthProxy ?? '/api/bot-health',
      percent: botStatus ? 100 : 40,
      state: botStatus ? 'Live' : 'Pending',
    },
    {
      label: 'Runtime socket',
      detail: botStatus?.connection ?? 'Booting',
      percent: runtimeProgress,
      state: botStatus?.connection ?? 'Queueing',
    },
    {
      label: 'Pairing surfaces',
      detail: botStatus?.qrAvailable ? 'Code + QR ready' : 'Awaiting pair surface',
      percent: pairingProgress,
      state: botStatus?.registered ? 'Ready' : 'Action needed',
    },
  ]

  const pairingChecklist = [
    {
      label: 'Unlock dashboard with admin key',
      done: Boolean(adminKey),
    },
    {
      label: 'Runtime proxy is reachable',
      done: Boolean(botStatus && botStatus.connection !== 'booting'),
    },
    {
      label: 'Generate code or load QR',
      done: Boolean(pairingResult?.code || botStatus?.qrAvailable || qrImage),
    },
    {
      label: 'WhatsApp linked',
      done: Boolean(botStatus?.registered),
    },
  ]

  const runtimeFeed = [
    `Edge route: ${status?.status ?? 'checking'}`,
    `Socket: ${botStatus?.connection ?? 'booting'}`,
    `Registered: ${botStatus?.registered ? 'yes' : 'no'}`,
    `QR available: ${botStatus?.qrAvailable ? 'yes' : 'no'}`,
    `Last pairing request: ${formatClock(botStatus?.lastPairingRequestAt)}`,
    `Last disconnect: ${botStatus?.lastDisconnectReason ?? 'none'}`,
  ].filter((entry) => !searchNeedle || entry.toLowerCase().includes(searchNeedle))

  const controlLinks = [
    {
      label: 'Website',
      href: botMeta?.websiteUrl ?? 'https://mybeebot.myarzl-visualdesign.my.id',
    },
    {
      label: 'Repo',
      href: liveMeta?.repoUrl ?? 'https://github.com/myarzlvisualdesign-blip/Mybeebot',
    },
    {
      label: 'Bot health',
      href: liveMeta?.botHealthProxy ?? 'https://mybeebot.myarzl-visualdesign.my.id/api/bot-health',
    },
    {
      label: 'Bot meta',
      href: liveMeta?.botMetaProxy ?? 'https://mybeebot.myarzl-visualdesign.my.id/api/bot-meta',
    },
  ].filter((link) => !searchNeedle || `${link.label} ${link.href}`.toLowerCase().includes(searchNeedle))

  const totalMatches = filteredCommands.length + filteredEndpoints.length + runtimeFeed.length + controlLinks.length

  function getCommandDescription(command: string) {
    const runtimeDescription = botMeta?.commands?.find(
      (entry) => `.${entry.name}` === command,
    )?.description

    return runtimeDescription || commandDescriptions[command] || 'Core command loaded in runtime.'
  }

  function getCommandExample(command: string) {
    return commandExamples[command] || command
  }

  const nextAction = (() => {
    if (!adminKey) {
      return {
        title: 'Paste the admin key first',
        body: 'The dashboard controls stay locked until you fill the admin key in the pairing panel.',
        primaryLabel: 'Go to Pairing Panel',
        primaryAction: () => jumpToSection('pairing'),
        secondaryLabel: 'Refresh Status',
        secondaryAction: () => void refreshAll({ announce: true }),
      }
    }

    if (isBotReady) {
      return {
        title: 'Bot already connected',
        body: 'Open WhatsApp and send .menu, .ping, or .alive to start using the bot immediately.',
        primaryLabel: 'Copy .menu',
        primaryAction: () => void copyText('.menu', '.menu starter'),
        secondaryLabel: 'Jump to Use Bot',
        secondaryAction: () => jumpToSection('use'),
      }
    }

    if (botStatus?.qrAvailable) {
      return {
        title: 'Connect WhatsApp now',
        body: 'For the same phone, use Get Pairing Code. On laptop or desktop, use Show QR to scan from Linked Devices.',
        primaryLabel: 'Get Pairing Code',
        primaryAction: () => void handleGeneratePairingCode(),
        secondaryLabel: 'Show QR',
        secondaryAction: () => void handleLoadQr(),
      }
    }

    return {
      title: 'Repair the session first',
      body: 'If the runtime is stuck or no QR is available yet, reset the session once and wait a few seconds for a clean reconnect.',
      primaryLabel: 'Reset Session',
      primaryAction: () => void handleResetSession(),
      secondaryLabel: 'Refresh Status',
      secondaryAction: () => void refreshAll({ announce: true }),
    }
  })()

  async function inspectEndpoint(
    key: string,
    label: string,
    path: string,
    init?: RequestInit,
  ) {
    setInspectingKey(key)

    try {
      const payload = await readJson<Record<string, unknown>>(path, init)
      setInspector({
        label,
        payload: JSON.stringify(payload, null, 2),
        tone: 'success',
      })
      addActivity(`${label} inspected from dashboard.`, 'info')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Endpoint inspection failed.'
      setInspector({
        label,
        payload: message,
        tone: 'error',
      })
      addActivity(`${label} inspection failed.`, 'error')
    } finally {
      setInspectingKey(null)
    }
  }

  async function handleGeneratePairingCode() {
    const phone = normalizePhone(pairPhone)
    if (!phone) {
      setPairingError('Phone number is required.')
      return
    }

    if (!adminKey) {
      setPairingError('Admin key is required.')
      return
    }

    setIsGenerating(true)
    setPairingError(null)
    setQrError(null)
    setResetNotice(null)
    setActiveSection('pairing')

    try {
      const payload = await readJson<PairingResult>('/api/bot-pairing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          adminKey,
        }),
      })

      setPairingResult(payload)
      setInspector({
        label: 'POST /api/bot-pairing',
        payload: JSON.stringify(payload, null, 2),
        tone: 'success',
      })
      addActivity(`Pairing code generated for ${payload.phone || phone}.`, 'success')
      await refreshAll()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to generate a pairing code.'

      setPairingResult(null)
      setPairingError(message)
      setInspector({
        label: 'POST /api/bot-pairing',
        payload: message,
        tone: 'error',
      })
      addActivity('Pairing code generation failed.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleResetSession() {
    if (!adminKey) {
      setPairingError('Admin key is required.')
      return
    }

    setIsResetting(true)
    setPairingError(null)
    setQrError(null)

    try {
      const payload = await readJson<ResetResult>('/api/bot-reset', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          adminKey,
        }),
      })

      setPairingResult(null)
      setQrImage(null)
      setQrMeta(null)
      setResetNotice(payload.message || 'Session cleared. Wait a few seconds, then try again.')
      setInspector({
        label: 'POST /api/bot-reset',
        payload: JSON.stringify(payload, null, 2),
        tone: 'success',
      })
      addActivity('Bot session reset from dashboard.', 'success')
      window.setTimeout(() => {
        void refreshAll({ announce: true })
      }, 3500)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reset bot session.'

      setResetNotice(null)
      setPairingError(message)
      setInspector({
        label: 'POST /api/bot-reset',
        payload: message,
        tone: 'error',
      })
      addActivity('Bot session reset failed.', 'error')
    } finally {
      setIsResetting(false)
    }
  }

  async function handleLoadQr() {
    if (!adminKey) {
      setQrError('Admin key is required.')
      return
    }

    setIsLoadingQr(true)
    setPairingError(null)
    setQrError(null)
    setResetNotice(null)
    setActiveSection('pairing')

    try {
      const payload = await readJson<BotQrResult>('/api/bot-qr', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          adminKey,
        }),
      })

      if (!payload.qr) {
        throw new Error(payload.message || 'QR is not available yet.')
      }

      const image = await QRCode.toDataURL(payload.qr, {
        width: 280,
        margin: 1,
        color: {
          dark: '#edf4ff',
          light: '#0000',
        },
      })

      setQrImage(image)
      setQrMeta(payload)
      setInspector({
        label: 'POST /api/bot-qr',
        payload: JSON.stringify(payload, null, 2),
        tone: 'success',
      })
      addActivity('Desktop QR loaded from dashboard.', 'success')
      await refreshAll()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load QR.'

      setQrImage(null)
      setQrMeta(null)
      setQrError(message)
      setInspector({
        label: 'POST /api/bot-qr',
        payload: message,
        tone: 'error',
      })
      addActivity('Desktop QR load failed.', 'error')
    } finally {
      setIsLoadingQr(false)
    }
  }

  const pairingMessage =
    pairingError || botStatusError || qrError
      ? pairingError || botStatusError || qrError
      : resetNotice
        ? resetNotice
      : pairingResult?.code
        ? `Use code ${pairingResult.code} immediately in WhatsApp Linked Devices.`
        : 'Use Generate Pairing Code for phone-number linking, or Load QR if desktop scan is easier.'

  return (
    <div className="dashboard-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />

      <div className="dashboard-frame">
        <aside className="side-rail reveal">
          <button type="button" className="brand-chip" onClick={() => jumpToSection('overview')}>
            MB
          </button>

          <div className="rail-stack">
            {railItems.map((item) => (
              <button
                key={item.section}
                type="button"
                className={`rail-button${activeSection === item.section ? ' active' : ''}`}
                onClick={() => jumpToSection(item.section)}
                title={item.label}
              >
                <span>{item.short}</span>
              </button>
            ))}
          </div>

          <div className="rail-glow" />
        </aside>

        <section className="workspace">
          <header className="topbar reveal reveal-delay-1">
            <div>
              <p className="topbar-label">Dashboard</p>
              <h1>Mybeebot Tools</h1>
              <p className="search-meta">
                {totalMatches} live matches
                {lastSyncedAt ? ` • synced ${formatClock(lastSyncedAt)}` : ''}
                {copyNotice ? ` • ${copyNotice}` : ''}
              </p>
            </div>

            <div className="search-shell">
              <span className="search-icon" />
              <input
                className="search-input"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search command, endpoint, runtime state"
              />
              <button
                type="button"
                className="sync-button"
                onClick={() => void refreshAll({ announce: true })}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Syncing...' : 'Refresh'}
              </button>
            </div>
          </header>

          <div className="workspace-grid">
            <main className="main-column">
              <article id="section-overview" className="panel hero-panel reveal reveal-delay-2">
                <div className="hero-copy">
                  <p className="eyebrow">Good {greeting},</p>
                  <h2>Mybeebot Control</h2>
                  <p className="hero-text">
                    Live dashboard for pairing, QR fallback, command lookup, endpoint
                    inspection, and runtime monitoring from the same Cloudflare domain.
                  </p>
                </div>

                <div className="hero-stat-bar">
                  <div>
                    <span className="muted-label">Launch score</span>
                    <strong>{overallReadiness}%</strong>
                  </div>
                  <div className="hero-chip-row">
                    <span className="hero-chip">{status?.status ?? 'syncing edge'}</span>
                    <span className="hero-chip">
                      {botStatus?.registered ? 'device paired' : 'pairing pending'}
                    </span>
                    <span className="hero-chip">
                      {botStatus?.qrAvailable ? 'qr ready' : 'qr waiting'}
                    </span>
                  </div>
                </div>

                <div className="gradient-meter">
                  <span style={{ width: `${overallReadiness}%` }} />
                </div>

                <div className="hero-metrics">
                  <div className="metric-card large">
                    <span>Loaded modules</span>
                    <strong>{botStatus?.commandCount ?? activeCommands.length}</strong>
                    <small>runtime command deck</small>
                  </div>

                  <div className="metric-card">
                    <span>Runtime</span>
                    <strong>{botStatus?.connection ?? 'booting'}</strong>
                    <small>{formatUptime(botStatus?.uptimeSeconds)} uptime</small>
                  </div>

                  <div className="metric-card">
                    <span>Domain</span>
                    <strong>Live</strong>
                    <small>{status?.domain ?? 'attaching route'}</small>
                  </div>
                </div>
              </article>

              <article className="panel guide-panel reveal reveal-delay-2">
                <div className="guide-copy">
                  <p className="tiny-label">Start Here</p>
                  <h3>{nextAction.title}</h3>
                  <p>{nextAction.body}</p>
                </div>

                <div className="guide-actions">
                  <button
                    type="button"
                    className="guide-button primary"
                    onClick={nextAction.primaryAction}
                  >
                    {nextAction.primaryLabel}
                  </button>

                  <button
                    type="button"
                    className="guide-button"
                    onClick={nextAction.secondaryAction}
                  >
                    {nextAction.secondaryLabel}
                  </button>

                  <a
                    className="guide-button link"
                    href="https://web.whatsapp.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open WhatsApp Web
                  </a>
                </div>

                <div className="guide-grid">
                  <article className="guide-card">
                    <span>1. Unlock</span>
                    <strong>Paste admin key</strong>
                    <p>Fill the admin key once. The dashboard saves it in your browser.</p>
                  </article>

                  <article className="guide-card">
                    <span>2. Connect</span>
                    <strong>Code or QR</strong>
                    <p>Use code for phone-number linking, or use QR when scanning from desktop is easier.</p>
                  </article>

                  <article className="guide-card">
                    <span>3. Use bot</span>
                    <strong>Send a starter command</strong>
                    <p>After linked, copy `.menu`, open WhatsApp, and send it to your own chat or any allowed chat.</p>
                  </article>
                </div>
              </article>

              <div className="split-grid">
                <article className="panel queue-panel reveal reveal-delay-3">
                  <div className="panel-head">
                    <div>
                      <p className="tiny-label">Runtime queue</p>
                      <h3>Deployment flow</h3>
                    </div>
                    <span className="soft-pill">{overallReadiness}% synced</span>
                  </div>

                  <div className="workflow-list">
                    {workflowRows.map((row) => (
                      <div key={row.label} className="workflow-row">
                        <div className="workflow-copy">
                          <strong>{row.label}</strong>
                          <span>{row.detail}</span>
                        </div>

                        <div className="workflow-meter">
                          <div className="workflow-track">
                            <span style={{ width: `${row.percent}%` }} />
                          </div>
                          <small>{row.state}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article
                  id="section-pairing"
                  className="panel pairing-panel reveal reveal-delay-4"
                >
                  <div className="panel-head">
                    <div>
                      <p className="tiny-label">Pair device</p>
                      <h3>Website pairing panel</h3>
                    </div>
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => void copyText(normalizePhone(pairPhone), 'Normalized phone')}
                    >
                      Copy phone
                    </button>
                  </div>

                  <div className="pairing-form">
                    <label className="field-block">
                      <span>WhatsApp number</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={pairPhone}
                        onChange={(event) => setPairPhone(event.target.value)}
                        placeholder="0878..."
                      />
                    </label>

                    <label className="field-block">
                      <span>Admin key</span>
                      <input
                        type="password"
                        value={adminKey}
                        onChange={(event) => setAdminKey(event.target.value)}
                        placeholder="Enter dashboard admin key"
                      />
                    </label>

                    <div className="pairing-actions">
                      <button
                        type="button"
                        className="generate-button"
                        onClick={handleGeneratePairingCode}
                        disabled={isGenerating || isResetting || isLoadingQr}
                      >
                        {isGenerating ? 'Generating...' : 'Get Pairing Code'}
                      </button>

                      <button
                        type="button"
                        className="reset-button"
                        onClick={handleResetSession}
                        disabled={isGenerating || isResetting || isLoadingQr}
                      >
                        {isResetting ? 'Resetting...' : 'Reset Session'}
                      </button>

                      <button
                        type="button"
                        className="qr-button"
                        onClick={handleLoadQr}
                        disabled={isGenerating || isResetting || isLoadingQr}
                      >
                        {isLoadingQr ? 'Loading QR...' : 'Show QR to Scan'}
                      </button>
                    </div>
                  </div>

                  <div className="pairing-command">
                    <span>Phone format</span>
                    <code>{normalizedPhone || '62xxxxxxxxxxx'}</code>
                  </div>

                  <div className="pairing-grid">
                    <div className="mini-stat">
                      <span>Mode</span>
                      <strong>{botStatus?.mode ?? 'public'}</strong>
                    </div>
                    <div className="mini-stat">
                      <span>Prefix</span>
                      <strong>{botStatus?.prefix ?? '.'}</strong>
                    </div>
                    <div className="mini-stat">
                      <span>Proxy</span>
                      <strong>{liveMeta?.deployment ?? 'cloudflare'}</strong>
                    </div>
                    <div className="mini-stat">
                      <span>Device</span>
                      <strong>{botStatus?.registered ? 'Linked' : 'Pending'}</strong>
                    </div>
                  </div>

                  <div className="pairing-result">
                    <div className="result-head">
                      <span>Latest code</span>
                      {pairingResult?.code ? (
                        <button
                          type="button"
                          className="ghost-action"
                          onClick={() => void copyText(pairingResult.code || '', 'Pairing code')}
                        >
                          Copy code
                        </button>
                      ) : null}
                    </div>
                    <strong>{pairingResult?.code ?? '--------'}</strong>
                    <small>
                      {pairingResult?.requestedAt
                        ? `Generated ${formatDateTime(pairingResult.requestedAt)}`
                        : 'Generate a fresh code, then enter it in WhatsApp Linked Devices.'}
                    </small>
                  </div>

                  <div className="qr-result">
                    <div className="result-head">
                      <span>Desktop QR fallback</span>
                      {qrImage ? (
                        <button
                          type="button"
                          className="ghost-action"
                          onClick={handleLoadQr}
                          disabled={isLoadingQr}
                        >
                          Refresh QR
                        </button>
                      ) : null}
                    </div>
                    {qrImage ? (
                      <>
                        <div className="qr-frame">
                          <img src={qrImage} alt="Mybeebot WhatsApp QR" />
                        </div>
                        <small>
                          {qrMeta?.generatedAt
                            ? `QR updated ${formatDateTime(qrMeta.generatedAt)}`
                            : 'Open this dashboard on a laptop, then scan from Linked Devices on your phone.'}
                        </small>
                      </>
                    ) : (
                      <small>
                        {qrError ||
                          'If phone-number pairing keeps failing, open this dashboard on desktop and load the QR.'}
                      </small>
                    )}
                  </div>

                  <div className="checklist">
                    {pairingChecklist.map((item) => (
                      <div key={item.label} className={`check-item${item.done ? ' done' : ''}`}>
                        <span className="check-dot" />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pairing-note">{pairingMessage}</div>
                </article>
              </div>

              <article id="section-use" className="panel use-panel reveal reveal-delay-4">
                <div className="panel-head">
                  <div>
                    <p className="tiny-label">Use Bot</p>
                    <h3>What to do after linking</h3>
                  </div>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => void refreshAll({ announce: true })}
                  >
                    Check live status
                  </button>
                </div>

                <div className="use-grid">
                  <div className="use-card highlight">
                    <span>Current state</span>
                    <strong>{isBotReady ? 'Ready to use' : isLinked ? 'Linked, waiting for socket' : 'Not linked yet'}</strong>
                    <p>
                      {isBotReady
                        ? 'Open WhatsApp now and send one of the starter commands below.'
                        : isLinked
                          ? 'The device is linked, but the socket has not fully opened yet. Wait a moment and refresh.'
                          : 'Connect the device first from the pairing panel, then come back here to use the bot.'}
                    </p>
                  </div>

                  <div className="use-card">
                    <span>Open chat</span>
                    <strong>Use your own WhatsApp</strong>
                    <p>After linked, send commands from your own chat, message yourself, or any chat allowed by bot mode.</p>
                    <a
                      className="use-link"
                      href="https://web.whatsapp.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open WhatsApp Web
                    </a>
                  </div>
                </div>

                <div className="starter-grid">
                  {starterCommands.map((command) => (
                    <article key={command} className="starter-card">
                      <strong>{command}</strong>
                      <p>{commandDescriptions[command] ?? 'Starter command.'}</p>
                      <button
                        type="button"
                        className="command-action"
                        onClick={() =>
                          void copyText(commandExamples[command] ?? command, `${command} starter`)
                        }
                      >
                        Copy command
                      </button>
                    </article>
                  ))}
                </div>

                <div className="usage-steps">
                  <div className="usage-step">
                    <span>Step 1</span>
                    <p>Link the device from the pairing panel.</p>
                  </div>
                  <div className="usage-step">
                    <span>Step 2</span>
                    <p>Wait until `Registered: yes` and ideally `Runtime: open`.</p>
                  </div>
                  <div className="usage-step">
                    <span>Step 3</span>
                    <p>Copy `.menu` or `.ping`, open WhatsApp, then send it.</p>
                  </div>
                </div>
              </article>

              <article
                id="section-commands"
                className="panel command-panel reveal reveal-delay-4"
              >
                <div className="panel-head">
                  <div>
                    <p className="tiny-label">Command matrix</p>
                    <h3>Loaded command deck</h3>
                  </div>
                  <a
                    className="ghost-link"
                    href={liveMeta?.repoUrl ?? 'https://github.com/myarzlvisualdesign-blip/Mybeebot'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    open repo
                  </a>
                </div>

                <div className="command-grid">
                  {filteredCommands.length ? (
                    filteredCommands.map((command) => (
                      <article key={command} className="command-tile">
                        <div className="command-head">
                          <strong>{command}</strong>
                          <button
                            type="button"
                            className="command-action"
                            onClick={() =>
                              void copyText(
                                getCommandExample(command),
                                `${command} example`,
                              )
                            }
                          >
                            copy
                          </button>
                        </div>
                        <p>{getCommandDescription(command)}</p>
                        <code className="command-example">{getCommandExample(command)}</code>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      No command matches <strong>{searchQuery}</strong>.
                    </div>
                  )}
                </div>
              </article>

              <article id="section-api" className="panel api-panel reveal reveal-delay-4">
                <div className="panel-head">
                  <div>
                    <p className="tiny-label">API explorer</p>
                    <h3>Inspect live endpoints</h3>
                  </div>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => void inspectEndpoint('bot-qr', 'POST /api/bot-qr', '/api/bot-qr', {
                      method: 'POST',
                      headers: {
                        'content-type': 'application/json',
                      },
                      body: JSON.stringify({ adminKey }),
                    })}
                    disabled={!adminKey || inspectingKey === 'bot-qr'}
                  >
                    {inspectingKey === 'bot-qr' ? 'Inspecting...' : 'Inspect QR'}
                  </button>
                </div>

                <div className="api-grid">
                  {filteredEndpoints.length ? (
                    filteredEndpoints.map((endpoint) => (
                      <article key={endpoint.key} className="api-card">
                        <div className="api-head">
                          <strong>{endpoint.label}</strong>
                          <span className="api-method">{endpoint.method}</span>
                        </div>
                        <p>{endpoint.description}</p>
                        <code>{endpoint.path}</code>
                        <div className="api-actions">
                          <button
                            type="button"
                            className="command-action"
                            onClick={() =>
                              void inspectEndpoint(
                                endpoint.key,
                                `${endpoint.method} ${endpoint.path}`,
                                endpoint.path,
                              )
                            }
                            disabled={inspectingKey === endpoint.key}
                          >
                            {inspectingKey === endpoint.key ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            type="button"
                            className="command-action secondary"
                            onClick={() => void copyText(endpoint.path, `${endpoint.path} path`)}
                          >
                            copy path
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      No endpoint matches <strong>{searchQuery}</strong>.
                    </div>
                  )}
                </div>

                <div className={`json-panel${inspector?.tone === 'error' ? ' error' : ''}`}>
                  <div className="result-head">
                    <span>{inspector?.label ?? 'Latest endpoint response'}</span>
                    {inspector ? (
                      <button
                        type="button"
                        className="ghost-action"
                        onClick={() => void copyText(inspector.payload, 'Inspector payload')}
                      >
                        Copy JSON
                      </button>
                    ) : null}
                  </div>
                  <pre>{inspector?.payload ?? 'Run Test on any endpoint to inspect the live JSON response here.'}</pre>
                </div>
              </article>
            </main>

            <aside className="side-column">
              <article className="panel side-card accent reveal reveal-delay-2">
                <p className="tiny-label">Workspace score</p>
                <strong className="score-number">{overallReadiness}</strong>
                <span className="score-unit">percent ready</span>
                <div className="score-track">
                  <span style={{ width: `${overallReadiness}%` }} />
                </div>
              </article>

              <article className="panel side-card reveal reveal-delay-3">
                <p className="tiny-label">Edge surface</p>
                <h3>Live route</h3>
                <ul className="detail-list">
                  <li>{status?.domain ?? 'waiting for domain'}</li>
                  <li>{status?.runtime ?? 'Worker static assets'}</li>
                  <li>{lastSyncedAt ? `Synced ${formatDateTime(lastSyncedAt)}` : 'Waiting for edge ping'}</li>
                </ul>
              </article>

              <article className="panel side-card reveal reveal-delay-4">
                <p className="tiny-label">Runtime feed</p>
                <h3>System notes</h3>
                <ul className="feed-list">
                  {runtimeFeed.length ? (
                    runtimeFeed.map((entry) => <li key={entry}>{entry}</li>)
                  ) : (
                    <li>No runtime note matches the current search.</li>
                  )}
                </ul>
              </article>

              <article className="panel side-card reveal reveal-delay-4">
                <p className="tiny-label">Direct links</p>
                <h3>Control paths</h3>
                {controlLinks.length ? (
                  controlLinks.map((link) => (
                    <div key={link.href} className="endpoint-row">
                      <a className="endpoint-link" href={link.href} target="_blank" rel="noreferrer">
                        <span>{link.label}</span>
                        <small>{link.href}</small>
                      </a>
                      <button
                        type="button"
                        className="endpoint-copy"
                        onClick={() => void copyText(link.href, `${link.label} link`)}
                      >
                        copy
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state compact">No link matches the current search.</div>
                )}
              </article>

              <article
                id="section-activity"
                className="panel side-card reveal reveal-delay-4 activity-panel"
              >
                <p className="tiny-label">Activity log</p>
                <h3>Recent actions</h3>
                <div className="activity-list">
                  {activity.length ? (
                    activity.map((entry) => (
                      <div key={entry.id} className={`activity-item ${entry.tone}`}>
                        <span className="activity-time">{formatClock(entry.time)}</span>
                        <p>{entry.text}</p>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state compact">
                      No dashboard action yet. Try Refresh, Test endpoint, Generate Code, Load QR, or copy a command.
                    </div>
                  )}
                </div>
              </article>

              <article className="panel status-strip reveal reveal-delay-4">
                <span
                  className={`status-led${statusError || botStatusError || metaError ? ' offline' : ''}`}
                />
                <div>
                  <strong>
                    {statusError || botStatusError || metaError
                      ? 'Live surface needs attention'
                      : 'Live proxy online'}
                  </strong>
                  <p>
                    {statusError || botStatusError || metaError
                      ? statusError || botStatusError || metaError
                      : liveMeta?.note ||
                        'Cloudflare edge and runtime proxy are responding from the same domain.'}
                  </p>
                </div>
              </article>
            </aside>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
