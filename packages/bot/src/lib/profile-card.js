import sharp from 'sharp'
import { levelThreshold } from './user-store.js'

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function fetchAvatarBuffer(avatarUrl) {
  if (!avatarUrl) {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(avatarUrl, {
      signal: controller.signal,
    })

    if (!response.ok) {
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function createAvatarLayer({ avatarBuffer, fallbackText }) {
  const size = 184

  if (!avatarBuffer) {
    const fallbackSvg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#60a5fa"/>
          </linearGradient>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#avatarGrad)"/>
        <text x="50%" y="55%" text-anchor="middle" font-size="72" font-family="Arial, sans-serif" fill="#081121" font-weight="700">${escapeXml(fallbackText)}</text>
      </svg>
    `

    return Buffer.from(fallbackSvg)
  }

  const mask = Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/>
    </svg>
  `)

  return sharp(avatarBuffer)
    .resize(size, size, {
      fit: 'cover',
    })
    .composite([
      {
        input: mask,
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer()
}

export async function renderProfileCard({
  avatarUrl,
  botName,
  handle,
  role,
  premium,
  level,
  xp,
  commandCount,
  messageCount,
}) {
  const width = 1040
  const height = 420
  const needXp = levelThreshold(level)
  const currentSegmentXp = xp - [...Array(level - 1).keys()].reduce((sum, entry) => sum + levelThreshold(entry + 1), 0)
  const progress = Math.max(0, Math.min(100, Math.round((currentSegmentXp / needXp) * 100)))
  const avatarLayer = await createAvatarLayer({
    avatarBuffer: await fetchAvatarBuffer(avatarUrl),
    fallbackText: handle.replace(/[@\W_]+/g, '').slice(0, 1).toUpperCase() || 'M',
  })

  const backgroundSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a1020"/>
          <stop offset="50%" stop-color="#131b34"/>
          <stop offset="100%" stop-color="#1d2748"/>
        </linearGradient>
        <linearGradient id="line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="50%" stop-color="#60a5fa"/>
          <stop offset="100%" stop-color="#34d399"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="36" fill="url(#bg)"/>
      <rect x="48" y="48" width="${width - 96}" height="${height - 96}" rx="28" fill="none" stroke="rgba(255,255,255,0.08)"/>
      <circle cx="905" cy="90" r="72" fill="#f59e0b" opacity="0.18"/>
      <circle cx="810" cy="320" r="110" fill="#60a5fa" opacity="0.14"/>
      <rect x="320" y="290" width="430" height="16" rx="8" fill="rgba(255,255,255,0.08)"/>
      <rect x="320" y="290" width="${Math.max(40, Math.round((430 * progress) / 100))}" height="16" rx="8" fill="url(#line)"/>
    </svg>
  `)

  const textSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="320" y="110" fill="rgba(255,255,255,0.72)" font-size="28" font-family="Arial, sans-serif" letter-spacing="4">${escapeXml(botName.toUpperCase())}</text>
      <text x="320" y="170" fill="#f8fafc" font-size="54" font-family="Arial, sans-serif" font-weight="700">${escapeXml(handle)}</text>
      <text x="320" y="218" fill="rgba(226,232,240,0.92)" font-size="28" font-family="Arial, sans-serif">${escapeXml(role)}</text>
      <text x="320" y="264" fill="rgba(226,232,240,0.84)" font-size="24" font-family="Arial, sans-serif">Level ${level} • XP ${xp} • ${premium ? 'Premium ⭐' : 'Reguler'}</text>
      <text x="320" y="342" fill="rgba(148,163,184,0.95)" font-size="22" font-family="Arial, sans-serif">Progress level: ${progress}% • Pesan: ${messageCount} • Command: ${commandCount}</text>
    </svg>
  `)

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#0a1020',
    },
  })
    .composite([
      {
        input: backgroundSvg,
      },
      {
        input: avatarLayer,
        left: 92,
        top: 118,
      },
      {
        input: textSvg,
      },
    ])
    .png()
    .toBuffer()
}
