import { cleanupJob, convertMediaToVoiceNote } from '../lib/media-utils.js'
import { getChatJid } from '../lib/group-utils.js'

export default {
  name: 'tovn',
  aliases: ['vn', 'ptt'],
  category: 'media',
  description: 'Ubah video atau audio menjadi voice note.',
  async execute({ config, message, reply, sock }) {
    await reply('🎙️ Sedang membuat voice note...')

    const result = await convertMediaToVoiceNote({
      config,
      message,
      sock,
    })

    try {
      await sock.sendMessage(
        getChatJid(message),
        {
          audio: {
            url: result.outputPath,
          },
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true,
        },
        { quoted: message },
      )
    } finally {
      await cleanupJob(result.jobDir)
    }
  },
}
