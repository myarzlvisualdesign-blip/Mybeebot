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

const featureCards = [
  {
    title: 'Fresh core, not a raw clone',
    text: 'Mybeebot takes inspiration from WA-BASE-BOT, but the project is rebuilt with a cleaner structure, safer config flow, and simpler command ownership.',
  },
  {
    title: 'Bot runtime that stays practical',
    text: 'The WhatsApp engine lives in a dedicated Node.js package using Baileys, pairing code login, persistent sessions, and a small local health endpoint.',
  },
  {
    title: 'Cloudflare live surface',
    text: 'The public-facing deploy runs on Cloudflare and exposes a branded launch page plus lightweight JSON endpoints for status and project metadata.',
  },
  {
    title: 'Ready to extend',
    text: 'Commands are loaded from a command directory so you can keep growing the bot without turning the codebase into one giant file.',
  },
]

const commandDeck = [
  { name: '.menu', detail: 'Full command overview grouped by category.' },
  { name: '.help', detail: 'Readable command summary with aliases and notes.' },
  { name: '.ping', detail: 'Latency and runtime check for quick diagnostics.' },
  { name: '.alive', detail: 'System identity, owner metadata, mode, and health.' },
  { name: '.repo', detail: 'Fast link back to the Mybeebot repository.' },
  { name: '.echo', detail: 'Simple response testing while wiring new features.' },
  { name: '.reload', detail: 'Owner-only command refresh without a full rewrite.' },
]

const launchSteps = [
  'Clone the repo and install workspace dependencies once from the root.',
  'Copy `packages/bot/.env.example` to `.env` and set owner, prefix, and pairing number.',
  'Run `npm run bot:start` to generate the pairing code and connect the WhatsApp session.',
  'Run `npm run deploy` to publish the Cloudflare companion site and edge APIs.',
]

const envSnippet = `BOT_NAME=Mybeebot
BOT_PREFIX=.
BOT_MODE=public
OWNER_NAME=Myarzl
OWNER_NUMBERS=6281234567890
PAIRING_NUMBER=6281234567890
REPO_URL=https://github.com/myarzlvisualdesign-blip/Mybeebot
WEBSITE_URL=https://mybeebot.myarzl-visualdesign.my.id`

function App() {
  const [status, setStatus] = useState<LiveStatus | null>(null)
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [botStatusError, setBotStatusError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadStatus() {
      try {
        const response = await fetch('/api/status')
        if (!response.ok) {
          throw new Error(`Status request failed with ${response.status}`)
        }

        const payload = (await response.json()) as LiveStatus
        if (active) {
          setStatus(payload)
        }
      } catch (error) {
        if (active) {
          setStatusError(
            error instanceof Error ? error.message : 'Unable to reach live status endpoint.',
          )
        }
      }
    }

    loadStatus()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadBotStatus() {
      try {
        const response = await fetch('/api/bot-health')
        if (!response.ok) {
          throw new Error(`Bot status request failed with ${response.status}`)
        }

        const payload = (await response.json()) as BotStatus
        if (active) {
          setBotStatus(payload)
        }
      } catch (error) {
        if (active) {
          setBotStatusError(
            error instanceof Error ? error.message : 'Unable to reach bot health proxy.',
          )
        }
      }
    }

    loadBotStatus()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="shell">
      <header className="hero-panel">
        <div className="hero-copy reveal">
          <p className="eyebrow">Cloudflare Live Companion</p>
          <h1>Mybeebot</h1>
          <p className="lede">
            A cleaner WhatsApp bot starter built for real extension work, with a fresh
            command system, a dedicated Node.js runtime, and a branded Cloudflare deploy.
          </p>
          <div className="cta-row">
            <a
              className="primary-link"
              href="https://github.com/myarzlvisualdesign-blip/Mybeebot"
              target="_blank"
              rel="noreferrer"
            >
              Open GitHub Repo
            </a>
            <a className="secondary-link" href="#launch-map">
              Launch Checklist
            </a>
          </div>
        </div>

        <aside className="status-card reveal reveal-delay-1">
          <div className="status-pill">
            <span className="status-dot" />
            Edge status
          </div>
          <dl className="status-grid">
            <div>
              <dt>Deploy</dt>
              <dd>{status?.status ?? 'checking'}</dd>
            </div>
            <div>
              <dt>Domain</dt>
              <dd>{status?.domain ?? 'mybeebot.myarzl-visualdesign.my.id'}</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>{status?.runtime ?? 'Cloudflare Worker + static assets'}</dd>
            </div>
            <div>
              <dt>Edge served</dt>
              <dd>
                {status?.edgeServedAt
                  ? new Date(status.edgeServedAt).toLocaleString()
                  : 'waiting'}
              </dd>
            </div>
            <div>
              <dt>Bot runtime</dt>
              <dd>{botStatus?.connection ?? 'waiting'}</dd>
            </div>
            <div>
              <dt>Bot pairing</dt>
              <dd>{botStatus?.registered ? 'registered' : 'not paired yet'}</dd>
            </div>
          </dl>
          <div className="status-note">
            {statusError || botStatusError
              ? statusError || botStatusError
              : botStatus?.lastDisconnectReason
                ? `Bot runtime is reachable. Last disconnect reason: ${botStatus.lastDisconnectReason}.`
                : 'The public site and the bot runtime health proxy are both live on Cloudflare.'}
          </div>
        </aside>
      </header>

      <main>
        <section className="section reveal reveal-delay-1">
          <div className="section-heading">
            <p className="section-label">Why this build</p>
            <h2>Base bot, rebuilt with better boundaries</h2>
          </div>
          <div className="feature-grid">
            {featureCards.map((item) => (
              <article key={item.title} className="card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section split-section reveal reveal-delay-2">
          <div className="stack-card">
            <p className="section-label">Command deck</p>
            <h2>Included bot commands</h2>
            <div className="command-grid">
              {commandDeck.map((command) => (
                <article key={command.name} className="command-card">
                  <strong>{command.name}</strong>
                  <p>{command.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="stack-card">
            <p className="section-label">Starter env</p>
            <h2>Fast configuration shape</h2>
            <pre>{envSnippet}</pre>
          </div>
        </section>

        <section className="section architecture reveal reveal-delay-3">
          <div className="section-heading">
            <p className="section-label">Architecture</p>
            <h2>Two surfaces, one repo</h2>
          </div>
          <div className="architecture-grid">
            <article className="architecture-card">
              <span>01</span>
              <h3>Node bot package</h3>
              <p>
                The WhatsApp engine handles pairing, sessions, reconnect logic, and command
                execution with a structure that is easier to maintain than the original single-file flow.
              </p>
            </article>
            <article className="architecture-card">
              <span>02</span>
              <h3>Cloudflare worker</h3>
              <p>
                The edge layer serves the public site and lightweight JSON endpoints so the project has a clean live presence and a verifiable status surface.
              </p>
            </article>
            <article className="architecture-card">
              <span>03</span>
              <h3>Workspace root</h3>
              <p>
                Root scripts keep install, lint, build, bot startup, and Cloudflare deployment all under one command map.
              </p>
            </article>
          </div>
        </section>

        <section id="launch-map" className="section launch-strip reveal reveal-delay-4">
          <div className="section-heading">
            <p className="section-label">Launch map</p>
            <h2>How this repo goes live</h2>
          </div>
          <ol className="launch-list">
            {launchSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  )
}

export default App
