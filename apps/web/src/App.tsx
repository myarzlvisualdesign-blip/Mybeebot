import { useEffect, useState } from 'react'

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

const ADMIN_KEY_STORAGE = 'mybeebot-admin-key'

const commandDescriptions: Record<string, string> = {
  '.menu': 'Open the main control sheet.',
  '.help': 'Readable command summary.',
  '.ping': 'Latency and runtime check.',
  '.alive': 'Current identity and health.',
  '.repo': 'Jump to the repository.',
  '.echo': 'Fast command response test.',
  '.reload': 'Reload modules for the owner.',
}

const sidebarItems = [
  { short: 'MB', label: 'Mybeebot', active: true },
  { short: 'OV', label: 'Overview' },
  { short: 'RT', label: 'Runtime' },
  { short: 'CM', label: 'Commands' },
  { short: 'PX', label: 'Proxy' },
  { short: 'LG', label: 'Logs' },
]

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
  const [statusError, setStatusError] = useState<string | null>(null)
  const [botStatusError, setBotStatusError] = useState<string | null>(null)
  const [pairPhone, setPairPhone] = useState('087830300031')
  const [adminKey, setAdminKey] = useState(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.localStorage.getItem(ADMIN_KEY_STORAGE) ?? ''
  })
  const [pairingResult, setPairingResult] = useState<PairingResult | null>(null)
  const [pairingError, setPairingError] = useState<string | null>(null)
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  async function loadStatus() {
    try {
      const response = await fetch('/api/status')
      if (!response.ok) {
        throw new Error(`Status request failed with ${response.status}`)
      }

      const payload = (await response.json()) as LiveStatus
      setStatus(payload)
      setStatusError(null)
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : 'Unable to reach live status endpoint.',
      )
    }
  }

  async function loadBotStatus() {
    try {
      const response = await fetch('/api/bot-health')
      if (!response.ok) {
        throw new Error(`Bot status request failed with ${response.status}`)
      }

      const payload = (await response.json()) as BotStatus
      setBotStatus(payload)
      setBotStatusError(null)
    } catch (error) {
      setBotStatusError(
        error instanceof Error ? error.message : 'Unable to reach bot health proxy.',
      )
    }
  }

  useEffect(() => {
    const refresh = () => {
      void loadStatus()
      void loadBotStatus()
    }

    const timeout = window.setTimeout(refresh, 0)

    const interval = window.setInterval(() => {
      refresh()
    }, 8000)

    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!adminKey) {
      window.localStorage.removeItem(ADMIN_KEY_STORAGE)
      return
    }

    window.localStorage.setItem(ADMIN_KEY_STORAGE, adminKey)
  }, [adminKey])

  const greeting = getGreeting()
  const edgeProgress = status?.status === 'live' ? 100 : 54
  const runtimeProgress = getProgress(botStatus?.connection)
  const pairingProgress = botStatus?.registered ? 100 : 34
  const commandProgress = botStatus?.commandCount
    ? Math.min(100, 44 + botStatus.commandCount * 8)
    : 52
  const overallReadiness = Math.round(
    (edgeProgress + runtimeProgress + pairingProgress + commandProgress) / 4,
  )
  const activeCommands = status?.commands?.length
    ? status.commands
    : Object.keys(commandDescriptions)

  const workflowRows = [
    {
      label: 'Edge worker bundle',
      detail: status?.domain ?? 'Waiting for route',
      percent: edgeProgress,
      state: status?.status ?? 'Syncing',
    },
    {
      label: 'Bot health proxy',
      detail: '/api/bot-health',
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
      label: 'Device pairing',
      detail: botStatus?.registered ? 'WhatsApp linked' : 'Awaiting pair code',
      percent: pairingProgress,
      state: botStatus?.registered ? 'Ready' : 'Manual step',
    },
  ]

  const systemFeed = [
    `Deploy state: ${status?.status ?? 'checking'}`,
    `Proxy health: ${botStatus ? 'reachable' : 'pending'}`,
    `Last disconnect: ${botStatus?.lastDisconnectReason ?? 'none'}`,
    `Pairing surface: website admin gate`,
  ]

  async function handleGeneratePairingCode() {
    setIsGenerating(true)
    setPairingError(null)
    setResetNotice(null)

    try {
      const response = await fetch('/api/bot-pairing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          phone: normalizePhone(pairPhone),
          adminKey,
        }),
      })

      const payload = (await response.json()) as PairingResult
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || `Pairing request failed with ${response.status}`)
      }

      setPairingResult(payload)
      await loadBotStatus()
    } catch (error) {
      setPairingResult(null)
      setPairingError(
        error instanceof Error ? error.message : 'Unable to generate a pairing code.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleResetSession() {
    setIsResetting(true)
    setPairingError(null)

    try {
      const response = await fetch('/api/bot-reset', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          adminKey,
        }),
      })

      const payload = (await response.json()) as ResetResult
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || `Reset request failed with ${response.status}`)
      }

      setPairingResult(null)
      setResetNotice(payload.message || 'Session cleared. Wait a few seconds, then generate a fresh code.')
      window.setTimeout(() => {
        void loadBotStatus()
      }, 3500)
    } catch (error) {
      setResetNotice(null)
      setPairingError(error instanceof Error ? error.message : 'Unable to reset bot session.')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="dashboard-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />

      <div className="dashboard-frame">
        <aside className="side-rail reveal">
          <div className="brand-chip">MB</div>

          <div className="rail-stack">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`rail-button${item.active ? ' active' : ''}`}
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
            </div>

            <div className="search-shell">
              <span className="search-icon" />
              <span className="search-copy">Search command, tunnel, pair code</span>
              <kbd>shift f</kbd>
            </div>
          </header>

          <div className="workspace-grid">
            <main className="main-column">
              <article className="panel hero-panel reveal reveal-delay-2">
                <div className="hero-copy">
                  <p className="eyebrow">Good {greeting},</p>
                  <h2>Mybeebot Control</h2>
                  <p className="hero-text">
                    Tool dashboard with live Cloudflare edge status, bot proxy health,
                    command matrix, and pairing readiness in one glass workspace.
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

                <article className="panel pairing-panel reveal reveal-delay-4">
                  <div className="panel-head">
                    <div>
                      <p className="tiny-label">Pair device</p>
                      <h3>Website pairing panel</h3>
                    </div>
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
                        disabled={isGenerating || isResetting}
                      >
                        {isGenerating ? 'Generating...' : 'Generate Pairing Code'}
                      </button>

                      <button
                        type="button"
                        className="reset-button"
                        onClick={handleResetSession}
                        disabled={isGenerating || isResetting}
                      >
                        {isResetting ? 'Resetting...' : 'Reset Session'}
                      </button>
                    </div>
                  </div>

                  <div className="pairing-command">
                    <span>Phone format</span>
                    <code>{normalizePhone(pairPhone) || '62xxxxxxxxxxx'}</code>
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
                      <strong>Cloudflare</strong>
                    </div>
                    <div className="mini-stat">
                      <span>Device</span>
                      <strong>{botStatus?.registered ? 'Linked' : 'Pending'}</strong>
                    </div>
                  </div>

                  <div className="pairing-result">
                    <span>Latest code</span>
                    <strong>{pairingResult?.code ?? '--------'}</strong>
                    <small>
                      {pairingResult?.requestedAt
                        ? `Generated ${new Date(pairingResult.requestedAt).toLocaleTimeString()}`
                        : 'Generate a fresh code, then enter it in WhatsApp Linked Devices.'}
                    </small>
                  </div>

                  <div className="pairing-note">
                    {pairingError || botStatusError
                      ? pairingError || botStatusError
                      : resetNotice
                        ? resetNotice
                      : pairingResult?.code
                        ? `Use code ${pairingResult.code} immediately in WhatsApp Linked Devices.`
                        : 'This panel can generate a fresh code from the website, but only after you unlock it with the admin key.'}
                  </div>
                </article>
              </div>

              <article className="panel command-panel reveal reveal-delay-4">
                <div className="panel-head">
                  <div>
                    <p className="tiny-label">Command matrix</p>
                    <h3>Loaded command deck</h3>
                  </div>
                  <a
                    className="ghost-link"
                    href="https://github.com/myarzlvisualdesign-blip/Mybeebot"
                    target="_blank"
                    rel="noreferrer"
                  >
                    open repo
                  </a>
                </div>

                <div className="command-grid">
                  {activeCommands.map((command) => (
                    <article key={command} className="command-tile">
                      <strong>{command}</strong>
                      <p>{commandDescriptions[command] ?? 'Core command loaded in runtime.'}</p>
                    </article>
                  ))}
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
                  <li>
                    {status?.edgeServedAt
                      ? `Updated ${new Date(status.edgeServedAt).toLocaleTimeString()}`
                      : 'Waiting for edge ping'}
                  </li>
                </ul>
              </article>

              <article className="panel side-card reveal reveal-delay-4">
                <p className="tiny-label">Runtime feed</p>
                <h3>System notes</h3>
                <ul className="feed-list">
                  {systemFeed.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </article>

              <article className="panel side-card reveal reveal-delay-4">
                <p className="tiny-label">Direct links</p>
                <h3>Control paths</h3>
                <a
                  className="endpoint-link"
                  href="https://mybeebot.myarzl-visualdesign.my.id/api/bot-health"
                  target="_blank"
                  rel="noreferrer"
                >
                  /api/bot-health
                </a>
                <a
                  className="endpoint-link"
                  href="https://mybeebot.myarzl-visualdesign.my.id/api/bot-meta"
                  target="_blank"
                  rel="noreferrer"
                >
                  /api/bot-meta
                </a>
              </article>

              <article className="panel status-strip reveal reveal-delay-4">
                <span className="status-led" />
                <div>
                  <strong>Live proxy online</strong>
                  <p>
                    {statusError
                      ? statusError
                      : 'Cloudflare edge and runtime proxy are responding from the same domain.'}
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
