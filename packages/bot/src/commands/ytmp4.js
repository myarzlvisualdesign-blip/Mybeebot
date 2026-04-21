import { cleanupJob, downloadWithYtDlp } from '../lib/media-utils.js'

export default {
  name: 'ytmp4',
  aliases: ['video', 'download', 'mp4'],
  category: 'media',
  description: 'Unduh video dari link yang didukung yt-dlp.',
  async execute({ args, config, message, reply, sock }) {
    const url = args[0]
    if (!url) {
      await reply(`🎬 Contoh: ${config.prefix}ytmp4 https://youtu.be/xxxx`)
      return
    }

    await reply('🎬 Sedang mengunduh video. Tunggu sebentar...')
    const result = await downloadWithYtDlp({
      config,
      mode: 'video',
      url,
    })

    try {
      await sock.sendMessage(
        message.key.remoteJid,
        {
          video: {
            url: result.filePath,
          },
          mimetype: 'video/mp4',
          fileName: `${result.title}.mp4`,
          caption: `Selesai diunduh: ${result.title}`,
        },
        { quoted: message },
      )
    } finally {
      await cleanupJob(result.jobDir)
    }
  },
}
