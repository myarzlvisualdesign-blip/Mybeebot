import { cleanupJob, downloadWithYtDlp } from '../lib/media-utils.js'
import { getChatJid } from '../lib/group-utils.js'

export default {
  name: 'ytmp3',
  aliases: ['audio', 'mp3', 'play'],
  category: 'media',
  description: 'Unduh audio dari link video yang didukung yt-dlp.',
  async execute({ args, config, message, reply, sock }) {
    const url = args[0]
    if (!url) {
      await reply(`🎵 Contoh: ${config.prefix}ytmp3 https://youtu.be/xxxx`)
      return
    }

    await reply('🎵 Sedang mengunduh audio. Tunggu sebentar...')
    const result = await downloadWithYtDlp({
      config,
      mode: 'audio',
      url,
    })

    try {
      await sock.sendMessage(
        getChatJid(message),
        {
          audio: {
            url: result.filePath,
          },
          mimetype: 'audio/mpeg',
          fileName: `${result.title}.mp3`,
        },
        { quoted: message },
      )
    } finally {
      await cleanupJob(result.jobDir)
    }
  },
}
