import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

export const config = {
  botName: process.env.BOT_NAME || 'Mybeebot',
  prefix: process.env.BOT_PREFIX || '.',
  botMode: process.env.BOT_MODE || 'public',
  ownerName: process.env.OWNER_NAME || 'Myarzl',
  ownerNumbers: splitCsv(process.env.OWNER_NUMBERS || process.env.PAIRING_NUMBER),
  pairingNumber: process.env.PAIRING_NUMBER || '',
  sessionDir: path.resolve(packageRoot, process.env.SESSION_DIR || './session'),
  healthPort: Number(process.env.HEALTH_PORT || 8788),
  usePairingCode: asBoolean(process.env.USE_PAIRING_CODE, true),
  repoUrl: process.env.REPO_URL || 'https://github.com/myarzlvisualdesign-blip/Mybeebot',
  websiteUrl:
    process.env.WEBSITE_URL || 'https://mybeebot.myarzl-visualdesign.my.id',
}
