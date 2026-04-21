import { cleanupJob, convertMediaToMp3 } from '../lib/media-utils.js'

export default {
  name: 'tomp3',
  aliases: ['toaudio', 'mp3convert'],
  category: 'media',
  description: 'Ubah video atau audio menjadi file MP3.',
  async execute({ config, message, reply, sock }) {
    await reply('🎧 Sedang mengubah media ke MP3...')

    const result = await convertMediaToMp3({
      config,
      message,
      sock,
    })

    try {
      await sock.sendMessage(
        message.key.remoteJid,
        {
          audio: {
            url: result.outputPath,
          },
          mimetype: 'audio/mpeg',
          fileName: 'mybeebot-audio.mp3',
        },
        { quoted: message },
      )
    } finally {
      await cleanupJob(result.jobDir)
    }
  },
}
