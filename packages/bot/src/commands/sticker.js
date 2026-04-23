import { makeStickerFromMessage } from '../lib/media-utils.js'
import { getChatJid } from '../lib/group-utils.js'

export default {
  name: 'sticker',
  aliases: ['stiker', 's'],
  category: 'media',
  description: 'Buat stiker dari gambar atau video maksimal 10 detik.',
  async execute({ config, message, reply, sock }) {
    await reply('🧩 Sedang membuat stiker...')
    const sticker = await makeStickerFromMessage({
      config,
      message,
      sock,
    })

    await sock.sendMessage(
      getChatJid(message),
      {
        sticker,
      },
      { quoted: message },
    )
  },
}
