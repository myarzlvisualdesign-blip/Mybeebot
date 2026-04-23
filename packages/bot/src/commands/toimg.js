import sharp from 'sharp'
import { getChatJid } from '../lib/group-utils.js'
import { cleanupJob, prepareMediaInput } from '../lib/media-utils.js'

export default {
  name: 'toimg',
  aliases: ['toimage', 'jpg'],
  category: 'media',
  description: 'Ubah stiker menjadi gambar PNG.',
  async execute({ config, message, reply, sock }) {
    await reply('🖼️ Sedang mengubah stiker ke gambar...')

    const prepared = await prepareMediaInput({
      config,
      message,
      sock,
      label: 'toimg',
      allowedTypes: ['sticker'],
    })

    try {
      const imageBuffer = await sharp(prepared.buffer).png().toBuffer()

      await sock.sendMessage(
        getChatJid(message),
        {
          image: imageBuffer,
          caption: '✅ Stiker berhasil diubah jadi gambar.',
        },
        { quoted: message },
      )
    } finally {
      await cleanupJob(prepared.jobDir)
    }
  },
}
