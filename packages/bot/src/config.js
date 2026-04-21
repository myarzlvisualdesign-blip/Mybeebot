import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageRoot, '..', '..')

dotenv.config({ path: path.join(repoRoot, '.env') })
dotenv.config({ path: path.join(packageRoot, '.env'), override: false })

function asBoolean(value, fallback) {
  if (value === undefined) {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

function splitCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function firstDefined(...values) {
  return values.find((value) => Boolean(value)) || ''
}

const botName = process.env.BOT_NAME || 'Mybeebot'

export const config = {
  botName,
  prefix: process.env.BOT_PREFIX || '.',
  botMode: process.env.BOT_MODE || 'public',
  ownerName: process.env.OWNER_NAME || 'Myarzl',
  ownerNumbers: splitCsv(process.env.OWNER_NUMBERS || process.env.PAIRING_NUMBER),
  pairingNumber: process.env.PAIRING_NUMBER || '',
  sessionDir: path.resolve(packageRoot, process.env.SESSION_DIR || './session'),
  healthPort: Number(process.env.HEALTH_PORT || 8788),
  usePairingCode: asBoolean(process.env.USE_PAIRING_CODE, true),
  pairingProxyKey: process.env.PAIRING_PROXY_KEY || '',
  repoUrl: process.env.REPO_URL || 'https://github.com/myarzlvisualdesign-blip/Mybeebot',
  websiteUrl:
    process.env.WEBSITE_URL || 'https://mybeebot.myarzl-visualdesign.my.id',
  tempDir: path.resolve(packageRoot, process.env.TEMP_DIR || './tmp'),
  ffmpegPath: process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg',
  ffprobePath: process.env.FFPROBE_PATH || '/usr/local/bin/ffprobe',
  ytDlpPath:
    process.env.YTDLP_PATH ||
    path.join(process.env.HOME || '', 'Library', 'Python', '3.9', 'bin', 'yt-dlp'),
  aiApiKey: firstDefined(
    process.env.AI_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.OPENROUTER_API_KEY,
    process.env.GROQ_API_KEY,
  ),
  aiBaseUrl:
    process.env.AI_BASE_URL ||
    (process.env.OPENROUTER_API_KEY
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : process.env.GROQ_API_KEY
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions'),
  aiModel:
    process.env.AI_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.OPENROUTER_MODEL ||
    process.env.GROQ_MODEL ||
    'gpt-4.1-mini',
  aiSystemPrompt:
    process.env.AI_SYSTEM_PROMPT ||
    `${botName} adalah asisten WhatsApp yang menjawab singkat, jelas, dan natural dalam bahasa Indonesia.`,
}
