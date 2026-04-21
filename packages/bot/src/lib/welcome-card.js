import sharp from 'sharp'

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
  const size = 176

  if (!avatarBuffer) {
    const fallbackSvg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#60a5fa"/>
            <stop offset="100%" stop-color="#22d3ee"/>
          </linearGradient>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#avatarGrad)"/>
        <text x="50%" y="54%" text-anchor="middle" font-size="72" font-family="Arial, sans-serif" fill="#071122" font-weight="700">${escapeXml(fallbackText)}</text>
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

export async function renderWelcomeCard({
  avatarUrl,
  handle,
  kind,
  subject,
  title,
}) {
  const width = 1040
  const height = 420
  const primary = kind === 'goodbye' ? '#fb7185' : '#4ade80'
  const secondary = kind === 'goodbye' ? '#f97316' : '#38bdf8'
  const heading = kind === 'goodbye' ? 'Sampai jumpa' : 'Selamat datang'
  const subtitle = title || (kind === 'goodbye' ? 'Semoga ketemu lagi' : 'Siap ramaikan obrolan')
  const handleText = handle || '@anggota'
  const subjectText = subject || 'Grup WhatsApp'
  const initial = handleText.replace(/[@\W_]+/g, '').slice(0, 1).toUpperCase() || 'M'

  const avatarLayer = await createAvatarLayer({
    avatarBuffer: await fetchAvatarBuffer(avatarUrl),
    fallbackText: initial,
  })

  const backgroundSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#09111f"/>
          <stop offset="55%" stop-color="#0f172f"/>
          <stop offset="100%" stop-color="#16213e"/>
        </linearGradient>
        <linearGradient id="line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${primary}"/>
          <stop offset="100%" stop-color="${secondary}"/>
        </linearGradient>
        <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="32"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" rx="36" fill="url(#bg)"/>
      <circle cx="920" cy="86" r="90" fill="${primary}" opacity="0.18" filter="url(#blur)"/>
      <circle cx="820" cy="330" r="120" fill="${secondary}" opacity="0.16" filter="url(#blur)"/>
      <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="28" fill="none" stroke="rgba(255,255,255,0.08)"/>
      <rect x="56" y="56" width="12" height="${height - 112}" rx="6" fill="url(#line)"/>
      <rect x="310" y="286" width="280" height="14" rx="7" fill="rgba(255,255,255,0.08)"/>
      <rect x="310" y="286" width="208" height="14" rx="7" fill="url(#line)"/>
    </svg>
  `)

  const textSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="310" y="120" fill="rgba(255,255,255,0.7)" font-size="28" font-family="Arial, sans-serif" letter-spacing="4">MYBEEBOT</text>
      <text x="310" y="184" fill="#f8fafc" font-size="58" font-family="Arial, sans-serif" font-weight="700">${escapeXml(heading)}</text>
      <text x="310" y="238" fill="rgba(226,232,240,0.9)" font-size="34" font-family="Arial, sans-serif">${escapeXml(handleText)}</text>
      <text x="310" y="326" fill="rgba(226,232,240,0.88)" font-size="28" font-family="Arial, sans-serif">${escapeXml(subtitle)}</text>
      <text x="310" y="366" fill="rgba(148,163,184,0.95)" font-size="22" font-family="Arial, sans-serif">Grup: ${escapeXml(subjectText)}</text>
    </svg>
  `)

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#09111f',
    },
  })
    .composite([
      {
        input: backgroundSvg,
      },
      {
        input: avatarLayer,
        left: 92,
        top: 122,
      },
      {
        input: textSvg,
      },
    ])
    .png()
    .toBuffer()
}
