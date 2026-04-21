import { getChatJid, getSenderJid, isGroupChat } from '../lib/group-utils.js'

export default {
  name: 'id',
  aliases: ['chatid'],
  category: 'utilitas',
  description: 'Tampilkan ID chat dan ID pengirim.',
  async execute({ message, reply }) {
    await reply(
      [
        '*Identitas chat*',
        '',
        `Chat ID: ${getChatJid(message) || 'tidak diketahui'}`,
        `Sender ID: ${getSenderJid(message) || 'tidak diketahui'}`,
        `Chat grup: ${isGroupChat(message) ? 'ya' : 'tidak'}`,
      ].join('\n'),
    )
  },
}
