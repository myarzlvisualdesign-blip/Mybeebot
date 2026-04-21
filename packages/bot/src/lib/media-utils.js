import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { logger } from './logger.js'

const execFileAsync = promisify(execFile)

function extractContextInfo(payload) {
  if (!payload) {
    return null
  }

  if (payload.message) {
    return extractContextInfo(payload.message)
  }

  if (payload.ephemeralMessage?.message) {
    return extractContextInfo(payload.ephemeralMessage.message)
  }

  if (payload.viewOnceMessage?.message) {
    return extractContextInfo(payload.viewOnceMessage.message)
  }

  return (
    payload.extendedTextMessage?.contextInfo ||
    payload.imageMessage?.contextInfo ||
    payload.videoMessage?.contextInfo ||
    payload.documentMessage?.contextInfo ||
    null
  )
}

function extractMessagePayload(payload) {
  if (!payload) {
    return null
  }

  if (payload.message) {
    return extractMessagePayload(payload.message)
  }

  if (payload.ephemeralMessage?.message) {
    return extractMessagePayload(payload.ephemeralMessage.message)
  }

  if (payload.viewOnceMessage?.message) {
    return extractMessagePayload(payload.viewOnceMessage.message)
  }

  return payload
}

function findMediaNode(payload) {
  const message = extractMessagePayload(payload)
  if (!message) {
    return null
  }

  if (message.imageMessage) {
    return { type: 'image', node: message.imageMessage }
  }

  if (message.videoMessage) {
    return { type: 'video', node: message.videoMessage }
  }

  if (message.stickerMessage) {
    return { type: 'sticker', node: message.stickerMessage }
  }

  if (message.audioMessage) {
    return { type: 'audio', node: message.audioMessage }
  }

  if (message.documentMessage) {
    return { type: 'document', node: message.documentMessage }
  }

  return null
}

function buildQuotedMessage(message) {
  const contextInfo = extractContextInfo(message)
  if (!contextInfo?.quotedMessage) {
    return null
  }

  return {
    key: {
      remoteJid: message?.key?.remoteJid || '',
      participant: contextInfo.participant,
      id: contextInfo.stanzaId || message?.key?.id || randomUUID(),
    },
    message: contextInfo.quotedMessage,
  }
}

function getMediaCarrier(message) {
  const quoted = buildQuotedMessage(message)
  if (quoted && findMediaNode(quoted)) {
    return quoted
  }

  if (findMediaNode(message)) {
    return message
  }

  return null
}

async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true })
}

export async function createJobDir(rootDir, label) {
  const directory = path.join(rootDir, `${label}-${Date.now()}-${randomUUID().slice(0, 8)}`)
  await ensureDir(directory)
  return directory
}

export async function cleanupJob(directory) {
  if (!directory) {
    return
  }

  await fs.rm(directory, { force: true, recursive: true }).catch(() => {})
}

async function runBinary(command, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    timeout: options.timeout ?? 120000,
    maxBuffer: 10 * 1024 * 1024,
  })

  if (stderr?.trim()) {
    logger.info(stderr.trim())
  }

  return stdout
}

export async function probeDurationSeconds(filePath, config) {
  if (!config.ffprobePath) {
    return null
  }

  try {
    const stdout = await runBinary(config.ffprobePath, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ])

    const seconds = Number.parseFloat(String(stdout || '').trim())
    return Number.isFinite(seconds) ? seconds : null
  } catch {
    return null
  }
}

export async function makeStickerFromMessage({ config, message, sock }) {
  const carrier = getMediaCarrier(message)
  if (!carrier) {
    throw new Error('Kirim atau balas gambar/video dulu, lalu ketik .stiker')
  }

  const media = findMediaNode(carrier)
  if (!media || !['image', 'video', 'sticker'].includes(media.type)) {
    throw new Error('Media untuk stiker harus berupa gambar, video, atau stiker.')
  }

  const jobDir = await createJobDir(config.tempDir, 'sticker')
  const inputExt =
    media.type === 'video' ? 'mp4' : media.type === 'sticker' ? 'webp' : 'jpg'
  const inputPath = path.join(jobDir, `source.${inputExt}`)
  const outputPath = path.join(jobDir, 'result.webp')

  try {
    const buffer = await downloadMediaMessage(
      carrier,
      'buffer',
      {},
      {
        reuploadRequest: sock.updateMediaMessage,
        logger,
      },
    )

    await fs.writeFile(inputPath, buffer)

    if (media.type === 'video') {
      const duration = media.node?.seconds || (await probeDurationSeconds(inputPath, config))
      if (duration && duration > 10) {
        throw new Error('Video untuk stiker maksimal 10 detik.')
      }
    }

    const args =
      media.type === 'video'
        ? [
            '-y',
            '-i',
            inputPath,
            '-vf',
            "fps=12,scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:-1:-1:color=0x00000000",
            '-vcodec',
            'libwebp',
            '-lossless',
            '0',
            '-compression_level',
            '6',
            '-q:v',
            '45',
            '-loop',
            '0',
            '-preset',
            'picture',
            '-an',
            '-vsync',
            '0',
            outputPath,
          ]
        : [
            '-y',
            '-i',
            inputPath,
            '-vf',
            'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:-1:-1:color=0x00000000',
            '-vcodec',
            'libwebp',
            '-lossless',
            '0',
            '-compression_level',
            '6',
            '-q:v',
            '45',
            '-preset',
            'picture',
            '-an',
            outputPath,
          ]

    await runBinary(config.ffmpegPath, args, { timeout: 120000 })
    return await fs.readFile(outputPath)
  } finally {
    await cleanupJob(jobDir)
  }
}

function getDownloadedFile(entries) {
  return entries.find((file) => !file.startsWith('.') && !file.endsWith('.part') && !file.endsWith('.ytdl'))
}

export async function downloadWithYtDlp({ config, mode, url }) {
  if (!url) {
    throw new Error('URL downloader tidak boleh kosong.')
  }

  const jobDir = await createJobDir(config.tempDir, mode)
  const outputTemplate = path.join(jobDir, 'output.%(ext)s')

  try {
    const args =
      mode === 'audio'
        ? [
            '--no-playlist',
            '--no-progress',
            '--restrict-filenames',
            '--extract-audio',
            '--audio-format',
            'mp3',
            '--audio-quality',
            '0',
            '--max-filesize',
            '20M',
            '-f',
            'bestaudio/best',
            '-o',
            outputTemplate,
            url,
          ]
        : [
            '--no-playlist',
            '--no-progress',
            '--restrict-filenames',
            '--merge-output-format',
            'mp4',
            '--max-filesize',
            '45M',
            '-f',
            'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]',
            '-o',
            outputTemplate,
            url,
          ]

    await runBinary(config.ytDlpPath, args, { timeout: 240000 })

    const files = await fs.readdir(jobDir)
    const fileName = getDownloadedFile(files)
    if (!fileName) {
      throw new Error('File hasil unduhan tidak ditemukan.')
    }

    const filePath = path.join(jobDir, fileName)
    const title = path.parse(fileName).name.replace(/[_-]+/g, ' ').trim() || 'hasil-download'

    return {
      jobDir,
      filePath,
      fileName,
      title,
    }
  } catch (error) {
    await cleanupJob(jobDir)
    throw error
  }
}
