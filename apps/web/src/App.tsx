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
  '.menu': 'Buka daftar perintah utama.',
  '.help': 'Ringkasan perintah yang aktif.',
  '.ping': 'Cek latency dan respons bot.',
  '.alive': 'Lihat identitas dan status bot.',
  '.owner': 'Tampilkan info owner.',
  '.repo': 'Buka repository project.',
  '.uptime': 'Lihat lama bot berjalan.',
  '.rules': 'Tampilkan aturan pemakaian.',
  '.donate': 'Info dukungan dan donasi.',
  '.id': 'Lihat ID chat dan pengirim.',
  '.groupinfo': 'Info grup saat ini.',
  '.admins': 'Tandai admin grup.',
  '.tagall': 'Tandai semua anggota.',
  '.hidetag': 'Mention semua anggota secara tersembunyi.',
  '.echo': 'Tes balasan cepat.',
  '.reload': 'Muat ulang perintah untuk owner.',
  '.ai': 'Tanya AI langsung dari chat.',
  '.aireply': 'Aktifkan AI reply otomatis per grup.',
  '.ytmp3': 'Unduh audio dari link video.',
  '.ytmp4': 'Unduh video dari link.',
  '.sticker': 'Buat stiker dari gambar atau video.',
  '.antilink': 'Atur proteksi link per grup.',
  '.autoresponder': 'Atur auto-responder per grup.',
  '.setreply': 'Simpan balasan otomatis.',
  '.delreply': 'Hapus balasan otomatis.',
  '.listreply': 'Lihat daftar balasan otomatis.',
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
  '.hidetag': '.hidetag pesan diam-diam untuk semua',
  '.ai': '.ai bikinkan caption promo kopi susu',
  '.aireply': '.aireply on',
  '.antilink': '.antilink warn',
  '.autoresponder': '.autoresponder on',
  '.delreply': '.delreply halo',
  '.owner': '.owner',
  '.kick': '.kick @user',
  '.linkgroup': '.linkgroup',
  '.listreply': '.listreply',
  '.open': '.open',
  '.promote': '.promote @user',
  '.repo': '.repo',
  '.setreply': '.setreply halo|Halo juga, ada yang bisa dibantu?',
  '.sticker': '.sticker',
  '.uptime': '.uptime',
  '.rules': '.rules',
  '.setdesc': '.setdesc Deskripsi grup baru',
  '.setsubject': '.setsubject Nama Grup Baru',
  '.welcome': '.welcome on',
  '.donate': '.donate',
  '.id': '.id',
  '.tagall': '.tagall Perhatian semuanya',
  '.echo': '.echo halo',
  '.reload': '.reload',
  '.ytmp3': '.ytmp3 https://youtu.be/xxxx',
  '.ytmp4': '.ytmp4 https://youtu.be/xxxx',
}

const railItems = [
  { short: 'OV', label: 'Ringkasan', section: 'overview' },
  { short: 'PR', label: 'Hubungkan', section: 'pairing' },
  { short: 'US', label: 'Pakai Bot', section: 'use' },
  { short: 'CM', label: 'Perintah', section: 'commands' },
  { short: 'API', label: 'API', section: 'api' },
  { short: 'LG', label: 'Aktivitas', section: 'activity' },
] as const

const endpointCatalog = [
  {
    key: 'status',
    label: 'Status edge',
    method: 'GET',
    path: '/api/status',
    description: 'Rute Cloudflare, runtime, dan daftar perintah.',
  },
  {
    key: 'meta',
    label: 'Metadata edge',
    method: 'GET',
    path: '/api/meta',
    description: 'Metadata deploy dan konfigurasi proxy.',
  },
  {
    key: 'bot-health',
    label: 'Kesehatan bot',
    method: 'GET',
    path: '/api/bot-health',
    description: 'Status socket bot saat ini dan kesiapan pairing.',
  },
  {
    key: 'bot-meta',
    label: 'Metadata bot',
    method: 'GET',
    path: '/api/bot-meta',
    description: 'Metadata runtime Node di balik proxy.',
  },
] as const

function formatUptime(seconds: number | undefined) {
  if (!seconds) {
    return '0m'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}j ${minutes}m`
  }

  return `${minutes}m`
}

function formatClock(value: string | null | undefined) {
  if (!value) {
    return 'menunggu'
  }

  return new Date(value).toLocaleTimeString()
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'belum ada'
  }

  return new Date(value).toLocaleString()
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Pagi'
  }

  if (hour < 18) {
    return 'Siang'
  }

  return 'Malam'
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
      addActivity(`${label} kosong.`, 'error')
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setCopyNotice(`${label} disalin`)
      addActivity(`${label} berhasil disalin.`, 'success')
      window.setTimeout(() => {
        setCopyNotice((current) => (current === `${label} disalin` ? null : current))
      }, 2200)
    } catch {
      setCopyNotice(null)
      addActivity(`Gagal menyalin ${label}.`, 'error')
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

      throw new Error(message || `${url} gagal dengan status ${response.status}`)
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
      setStatusError(statusResult.reason instanceof Error ? statusResult.reason.message : 'Gagal menjangkau endpoint status live.')
    }

    if (botStatusResult.status === 'fulfilled') {
      setBotStatus(botStatusResult.value)
      setBotStatusError(null)
    } else {
      setBotStatusError(botStatusResult.reason instanceof Error ? botStatusResult.reason.message : 'Gagal menjangkau proxy kesehatan bot.')
    }

    if (liveMetaResult.status === 'fulfilled') {
      setLiveMeta(liveMetaResult.value)
      setMetaError(null)
    } else {
      setMetaError(liveMetaResult.reason instanceof Error ? liveMetaResult.reason.message : 'Gagal menjangkau metadata edge.')
    }

    if (botMetaResult.status === 'fulfilled') {
      setBotMeta(botMetaResult.value)
      setMetaError(null)
    } else if (liveMetaResult.status !== 'rejected') {
      setMetaError(botMetaResult.reason instanceof Error ? botMetaResult.reason.message : 'Gagal menjangkau metadata bot.')
    }

    setLastSyncedAt(new Date().toISOString())

    if (options?.announce) {
      addActivity('Dashboard berhasil sinkron dari endpoint live.', 'info')
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
      addActivity('Dashboard berhasil terhubung ke runtime bot live.', 'success')
      return
    }

    if (previousSnapshot.current !== snapshot) {
      previousSnapshot.current = snapshot
      addActivity(
        `Runtime berubah ke ${botStatus.connection}. Terdaftar: ${botStatus.registered ? 'ya' : 'tidak'}.`,
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
      detail: status?.domain ?? 'Menunggu rute',
      percent: edgeProgress,
      state: status?.status ?? 'Menyinkronkan',
    },
    {
      label: 'Bot health proxy',
      detail: liveMeta?.botHealthProxy ?? '/api/bot-health',
      percent: botStatus ? 100 : 40,
      state: botStatus ? 'Aktif' : 'Menunggu',
    },
    {
      label: 'Socket runtime',
      detail: botStatus?.connection ?? 'Booting',
      percent: runtimeProgress,
      state: botStatus?.connection ?? 'Mengantre',
    },
    {
      label: 'Permukaan pairing',
      detail: botStatus?.qrAvailable ? 'Kode + QR siap' : 'Menunggu panel pairing',
      percent: pairingProgress,
      state: botStatus?.registered ? 'Siap' : 'Perlu aksi',
    },
  ]

  const pairingChecklist = [
    {
      label: 'Buka dashboard dengan admin key',
      done: Boolean(adminKey),
    },
    {
      label: 'Proxy runtime bisa dijangkau',
      done: Boolean(botStatus && botStatus.connection !== 'booting'),
    },
    {
      label: 'Generate kode atau muat QR',
      done: Boolean(pairingResult?.code || botStatus?.qrAvailable || qrImage),
    },
    {
      label: 'WhatsApp sudah tertaut',
      done: Boolean(botStatus?.registered),
    },
  ]

  const runtimeFeed = [
    `Route edge: ${status?.status ?? 'mengecek'}`,
    `Socket: ${botStatus?.connection ?? 'booting'}`,
    `Terdaftar: ${botStatus?.registered ? 'ya' : 'tidak'}`,
    `QR tersedia: ${botStatus?.qrAvailable ? 'ya' : 'tidak'}`,
    `Permintaan pairing terakhir: ${formatClock(botStatus?.lastPairingRequestAt)}`,
    `Disconnect terakhir: ${botStatus?.lastDisconnectReason ?? 'tidak ada'}`,
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

    return runtimeDescription || commandDescriptions[command] || 'Perintah inti aktif di runtime.'
  }

  function getCommandExample(command: string) {
    return commandExamples[command] || command
  }

  const nextAction = (() => {
    if (!adminKey) {
      return {
        title: 'Tempel admin key dulu',
        body: 'Kontrol dashboard tetap terkunci sampai admin key diisi di panel pairing.',
        primaryLabel: 'Buka Panel Koneksi',
        primaryAction: () => jumpToSection('pairing'),
        secondaryLabel: 'Segarkan Status',
        secondaryAction: () => void refreshAll({ announce: true }),
      }
    }

    if (isBotReady) {
      return {
        title: 'Bot sudah terhubung',
        body: 'Buka WhatsApp lalu kirim .menu, .ping, atau .alive untuk mulai pakai bot sekarang juga.',
        primaryLabel: 'Salin .menu',
        primaryAction: () => void copyText('.menu', '.menu starter'),
        secondaryLabel: 'Ke Bagian Pakai Bot',
        secondaryAction: () => jumpToSection('use'),
      }
    }

    if (botStatus?.qrAvailable) {
      return {
        title: 'Hubungkan WhatsApp sekarang',
        body: 'Kalau pakai HP yang sama, pakai kode pairing. Kalau buka dashboard di laptop, pakai QR lalu scan dari Linked Devices.',
        primaryLabel: 'Ambil Kode Pairing',
        primaryAction: () => void handleGeneratePairingCode(),
        secondaryLabel: 'Tampilkan QR',
        secondaryAction: () => void handleLoadQr(),
      }
    }

    return {
      title: 'Perbaiki sesi dulu',
      body: 'Kalau runtime macet atau QR belum muncul, reset sesi sekali lalu tunggu beberapa detik sampai konek ulang dengan bersih.',
      primaryLabel: 'Reset Sesi',
      primaryAction: () => void handleResetSession(),
        secondaryLabel: 'Segarkan Status',
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
      addActivity(`${label} berhasil dicek dari dashboard.`, 'info')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pemeriksaan endpoint gagal.'
      setInspector({
        label,
        payload: message,
        tone: 'error',
      })
      addActivity(`${label} gagal dicek.`, 'error')
    } finally {
      setInspectingKey(null)
    }
  }

  async function handleGeneratePairingCode() {
    const phone = normalizePhone(pairPhone)
    if (!phone) {
      setPairingError('Nomor telepon wajib diisi.')
      return
    }

    if (!adminKey) {
      setPairingError('Admin key wajib diisi.')
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
      addActivity(`Kode pairing berhasil dibuat untuk ${payload.phone || phone}.`, 'success')
      await refreshAll()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal membuat kode pairing.'

      setPairingResult(null)
      setPairingError(message)
      setInspector({
        label: 'POST /api/bot-pairing',
        payload: message,
        tone: 'error',
      })
      addActivity('Pembuatan kode pairing gagal.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleResetSession() {
    if (!adminKey) {
      setPairingError('Admin key wajib diisi.')
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
      setResetNotice(payload.message || 'Sesi dibersihkan. Tunggu beberapa detik lalu coba lagi.')
      setInspector({
        label: 'POST /api/bot-reset',
        payload: JSON.stringify(payload, null, 2),
        tone: 'success',
      })
      addActivity('Sesi bot berhasil di-reset dari dashboard.', 'success')
      window.setTimeout(() => {
        void refreshAll({ announce: true })
      }, 3500)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mereset sesi bot.'

      setResetNotice(null)
      setPairingError(message)
      setInspector({
        label: 'POST /api/bot-reset',
        payload: message,
        tone: 'error',
      })
      addActivity('Reset sesi bot gagal.', 'error')
    } finally {
      setIsResetting(false)
    }
  }

  async function handleLoadQr() {
    if (!adminKey) {
      setQrError('Admin key wajib diisi.')
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
        throw new Error(payload.message || 'QR belum tersedia.')
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
      addActivity('QR desktop berhasil dimuat dari dashboard.', 'success')
      await refreshAll()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat QR.'

      setQrImage(null)
      setQrMeta(null)
      setQrError(message)
      setInspector({
        label: 'POST /api/bot-qr',
        payload: message,
        tone: 'error',
      })
      addActivity('Pemuatan QR desktop gagal.', 'error')
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
        ? `Masukkan kode ${pairingResult.code} sekarang juga di menu Linked Devices WhatsApp.`
        : 'Pakai tombol kode pairing untuk link via nomor, atau pakai QR kalau scan dari desktop lebih gampang.'

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
              <h1>Kontrol Mybeebot</h1>
              <p className="search-meta">
                {totalMatches} hasil live
                {lastSyncedAt ? ` • sinkron ${formatClock(lastSyncedAt)}` : ''}
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
                placeholder="Cari perintah, endpoint, atau status runtime"
              />
              <button
                type="button"
                className="sync-button"
                onClick={() => void refreshAll({ announce: true })}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Sinkron...' : 'Refresh'}
              </button>
            </div>
          </header>

          <div className="workspace-grid">
            <main className="main-column">
              <article id="section-overview" className="panel hero-panel reveal reveal-delay-2">
                <div className="hero-copy">
                  <p className="eyebrow">Selamat {greeting},</p>
                  <h2>Kontrol Penuh Mybeebot</h2>
                  <p className="hero-text">
                    Dashboard live untuk pairing, fallback QR, pencarian perintah, inspeksi
                    endpoint, dan monitoring runtime dari domain Cloudflare yang sama.
                  </p>
                </div>

                <div className="hero-stat-bar">
                  <div>
                    <span className="muted-label">Skor kesiapan</span>
                    <strong>{overallReadiness}%</strong>
                  </div>
                  <div className="hero-chip-row">
                    <span className="hero-chip">{status?.status ?? 'sinkron edge'}</span>
                    <span className="hero-chip">
                      {botStatus?.registered ? 'perangkat tertaut' : 'menunggu pairing'}
                    </span>
                    <span className="hero-chip">
                      {botStatus?.qrAvailable ? 'qr siap' : 'menunggu qr'}
                    </span>
                  </div>
                </div>

                <div className="gradient-meter">
                  <span style={{ width: `${overallReadiness}%` }} />
                </div>

                <div className="hero-metrics">
                  <div className="metric-card large">
                    <span>Module aktif</span>
                    <strong>{botStatus?.commandCount ?? activeCommands.length}</strong>
                    <small>daftar perintah runtime</small>
                  </div>

                  <div className="metric-card">
                    <span>Runtime</span>
                    <strong>{botStatus?.connection ?? 'booting'}</strong>
                    <small>uptime {formatUptime(botStatus?.uptimeSeconds)}</small>
                  </div>

                  <div className="metric-card">
                    <span>Domain</span>
                    <strong>Aktif</strong>
                    <small>{status?.domain ?? 'menempelkan rute'}</small>
                  </div>
                </div>
              </article>

              <article className="panel guide-panel reveal reveal-delay-2">
                <div className="guide-copy">
                  <p className="tiny-label">Mulai Dari Sini</p>
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
                    Buka WhatsApp Web
                  </a>
                </div>

                <div className="guide-grid">
                  <article className="guide-card">
                    <span>1. Buka Akses</span>
                    <strong>Isi admin key</strong>
                    <p>Isi admin key sekali. Dashboard akan menyimpannya di browser Anda.</p>
                  </article>

                  <article className="guide-card">
                    <span>2. Sambungkan</span>
                    <strong>Kode atau QR</strong>
                    <p>Pakai kode untuk link via nomor, atau QR kalau scan dari desktop lebih gampang.</p>
                  </article>

                  <article className="guide-card">
                    <span>3. Pakai Bot</span>
                    <strong>Kirim perintah awal</strong>
                    <p>Setelah tertaut, salin `.menu`, buka WhatsApp, lalu kirim ke chat sendiri atau chat yang diizinkan.</p>
                  </article>
                </div>
              </article>

              <div className="split-grid">
                <article className="panel queue-panel reveal reveal-delay-3">
                  <div className="panel-head">
                    <div>
                      <p className="tiny-label">Antrian runtime</p>
                      <h3>Alur deploy</h3>
                    </div>
                    <span className="soft-pill">{overallReadiness}% sinkron</span>
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
                      <p className="tiny-label">Hubungkan perangkat</p>
                      <h3>Panel koneksi website</h3>
                    </div>
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => void copyText(normalizePhone(pairPhone), 'Nomor ternormalisasi')}
                    >
                      Salin nomor
                    </button>
                  </div>

                  <div className="pairing-form">
                    <label className="field-block">
                      <span>Nomor WhatsApp</span>
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
                        placeholder="Masukkan admin key dashboard"
                      />
                    </label>

                    <div className="pairing-actions">
                      <button
                        type="button"
                        className="generate-button"
                        onClick={handleGeneratePairingCode}
                        disabled={isGenerating || isResetting || isLoadingQr}
                      >
                        {isGenerating ? 'Membuat...' : 'Ambil Kode Pairing'}
                      </button>

                      <button
                        type="button"
                        className="reset-button"
                        onClick={handleResetSession}
                        disabled={isGenerating || isResetting || isLoadingQr}
                      >
                        {isResetting ? 'Mereset...' : 'Reset Sesi'}
                      </button>

                      <button
                        type="button"
                        className="qr-button"
                        onClick={handleLoadQr}
                        disabled={isGenerating || isResetting || isLoadingQr}
                      >
                        {isLoadingQr ? 'Memuat QR...' : 'Tampilkan QR untuk Scan'}
                      </button>
                    </div>
                  </div>

                  <div className="pairing-command">
                    <span>Format nomor</span>
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
                      <strong>{botStatus?.registered ? 'Tertaut' : 'Menunggu'}</strong>
                    </div>
                  </div>

                  <div className="pairing-result">
                    <div className="result-head">
                      <span>Kode terbaru</span>
                      {pairingResult?.code ? (
                        <button
                          type="button"
                          className="ghost-action"
                          onClick={() => void copyText(pairingResult.code || '', 'Kode pairing')}
                        >
                          Salin kode
                        </button>
                      ) : null}
                    </div>
                    <strong>{pairingResult?.code ?? '--------'}</strong>
                    <small>
                      {pairingResult?.requestedAt
                        ? `Dibuat ${formatDateTime(pairingResult.requestedAt)}`
                        : 'Buat kode baru, lalu masukkan ke menu Linked Devices WhatsApp.'}
                    </small>
                  </div>

                  <div className="qr-result">
                    <div className="result-head">
                      <span>QR cadangan desktop</span>
                      {qrImage ? (
                        <button
                          type="button"
                          className="ghost-action"
                          onClick={handleLoadQr}
                          disabled={isLoadingQr}
                        >
                          Muat ulang QR
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
                            ? `QR diperbarui ${formatDateTime(qrMeta.generatedAt)}`
                            : 'Buka dashboard ini di laptop, lalu scan dari menu Linked Devices di HP Anda.'}
                        </small>
                      </>
                    ) : (
                      <small>
                        {qrError ||
                          'Kalau pairing via nomor terus gagal, buka dashboard ini di desktop lalu muat QR.'}
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
                    <p className="tiny-label">Pakai Bot</p>
                    <h3>Apa yang dilakukan setelah tertaut</h3>
                  </div>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => void refreshAll({ announce: true })}
                  >
                    Cek status live
                  </button>
                </div>

                <div className="use-grid">
                  <div className="use-card highlight">
                    <span>Status sekarang</span>
                    <strong>{isBotReady ? 'Siap dipakai' : isLinked ? 'Sudah tertaut, menunggu socket' : 'Belum tertaut'}</strong>
                    <p>
                      {isBotReady
                        ? 'Buka WhatsApp sekarang lalu kirim salah satu perintah awal di bawah.'
                        : isLinked
                          ? 'Perangkat sudah tertaut, tapi socket belum terbuka penuh. Tunggu sebentar lalu refresh.'
                          : 'Hubungkan perangkat dulu dari panel pairing, lalu balik ke sini untuk memakai bot.'}
                    </p>
                  </div>

                  <div className="use-card">
                    <span>Buka chat</span>
                    <strong>Pakai WhatsApp Anda sendiri</strong>
                    <p>Setelah tertaut, kirim perintah dari chat sendiri, chat ke diri sendiri, atau chat lain yang diizinkan mode bot.</p>
                    <a
                      className="use-link"
                    href="https://web.whatsapp.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                      Buka WhatsApp Web
                    </a>
                  </div>
                </div>

                <div className="starter-grid">
                  {starterCommands.map((command) => (
                    <article key={command} className="starter-card">
                      <strong>{command}</strong>
                      <p>{commandDescriptions[command] ?? 'Perintah awal.'}</p>
                      <button
                        type="button"
                        className="command-action"
                        onClick={() =>
                          void copyText(commandExamples[command] ?? command, `${command} starter`)
                        }
                      >
                        Salin perintah
                      </button>
                    </article>
                  ))}
                </div>

                <div className="usage-steps">
                  <div className="usage-step">
                    <span>Langkah 1</span>
                    <p>Link perangkat dari panel pairing.</p>
                  </div>
                  <div className="usage-step">
                    <span>Langkah 2</span>
                    <p>Tunggu sampai status registered aktif dan idealnya runtime sudah `open`.</p>
                  </div>
                  <div className="usage-step">
                    <span>Langkah 3</span>
                    <p>Salin `.menu` atau `.ping`, buka WhatsApp, lalu kirim.</p>
                  </div>
                </div>
              </article>

              <article
                id="section-commands"
                className="panel command-panel reveal reveal-delay-4"
              >
                <div className="panel-head">
                  <div>
                    <p className="tiny-label">Matriks perintah</p>
                    <h3>Daftar perintah aktif</h3>
                  </div>
                  <a
                    className="ghost-link"
                    href={liveMeta?.repoUrl ?? 'https://github.com/myarzlvisualdesign-blip/Mybeebot'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    buka repo
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
                                `Contoh ${command}`,
                              )
                            }
                          >
                            salin
                          </button>
                        </div>
                        <p>{getCommandDescription(command)}</p>
                        <code className="command-example">{getCommandExample(command)}</code>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      Tidak ada perintah yang cocok dengan <strong>{searchQuery}</strong>.
                    </div>
                  )}
                </div>
              </article>

              <article id="section-api" className="panel api-panel reveal reveal-delay-4">
                <div className="panel-head">
                  <div>
                    <p className="tiny-label">Penjelajah API</p>
                    <h3>Cek endpoint live</h3>
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
                    {inspectingKey === 'bot-qr' ? 'Memeriksa...' : 'Cek QR'}
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
                            {inspectingKey === endpoint.key ? 'Mengetes...' : 'Tes'}
                          </button>
                          <button
                            type="button"
                            className="command-action secondary"
                            onClick={() => void copyText(endpoint.path, `${endpoint.path} path`)}
                          >
                            salin path
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      Tidak ada endpoint yang cocok dengan <strong>{searchQuery}</strong>.
                    </div>
                  )}
                </div>

                <div className={`json-panel${inspector?.tone === 'error' ? ' error' : ''}`}>
                  <div className="result-head">
                    <span>{inspector?.label ?? 'Respons endpoint terbaru'}</span>
                    {inspector ? (
                      <button
                        type="button"
                        className="ghost-action"
                        onClick={() => void copyText(inspector.payload, 'Payload inspector')}
                      >
                        Salin JSON
                      </button>
                    ) : null}
                  </div>
                  <pre>{inspector?.payload ?? 'Jalankan tes di salah satu endpoint untuk melihat respons JSON live di sini.'}</pre>
                </div>
              </article>
            </main>

            <aside className="side-column">
              <article className="panel side-card accent reveal reveal-delay-2">
                <p className="tiny-label">Skor workspace</p>
                <strong className="score-number">{overallReadiness}</strong>
                <span className="score-unit">persen siap</span>
                <div className="score-track">
                  <span style={{ width: `${overallReadiness}%` }} />
                </div>
              </article>

              <article className="panel side-card reveal reveal-delay-3">
                <p className="tiny-label">Permukaan edge</p>
                <h3>Route live</h3>
                <ul className="detail-list">
                  <li>{status?.domain ?? 'menunggu domain'}</li>
                  <li>{status?.runtime ?? 'Aset statis worker'}</li>
                  <li>{lastSyncedAt ? `Sinkron ${formatDateTime(lastSyncedAt)}` : 'Menunggu ping edge'}</li>
                </ul>
              </article>

              <article className="panel side-card reveal reveal-delay-4">
                <p className="tiny-label">Feed runtime</p>
                <h3>Catatan sistem</h3>
                <ul className="feed-list">
                  {runtimeFeed.length ? (
                    runtimeFeed.map((entry) => <li key={entry}>{entry}</li>)
                  ) : (
                    <li>Tidak ada catatan runtime yang cocok dengan pencarian saat ini.</li>
                  )}
                </ul>
              </article>

              <article className="panel side-card reveal reveal-delay-4">
                <p className="tiny-label">Link langsung</p>
                <h3>Jalur kontrol</h3>
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
                        salin
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state compact">Tidak ada link yang cocok dengan pencarian saat ini.</div>
                )}
              </article>

              <article
                id="section-activity"
                className="panel side-card reveal reveal-delay-4 activity-panel"
              >
                <p className="tiny-label">Log aktivitas</p>
                <h3>Aksi terbaru</h3>
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
                      Belum ada aksi dashboard. Coba Refresh, tes endpoint, buat kode, muat QR, atau salin perintah.
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
                      ? 'Permukaan live perlu perhatian'
                      : 'Proxy live online'}
                  </strong>
                  <p>
                    {statusError || botStatusError || metaError
                      ? statusError || botStatusError || metaError
                      : liveMeta?.note ||
                        'Cloudflare edge dan proxy runtime merespons dari domain yang sama.'}
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
