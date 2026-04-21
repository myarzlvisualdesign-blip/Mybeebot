import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'addbadword',
  aliases: ['tambahbadword'],
  category: 'grup',
  description: 'Tambahkan kata terlarang ke filter grup.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const word = args.join(' ').trim().toLowerCase()
    if (!word) {
      await reply(`🚫 Contoh: ${config.prefix}addbadword kasar`)
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.addBadWord(context.jid, word)

    await reply(`🚫 Kata *${word}* ditambahkan. Total badword: ${settings.badWords.length}.`)
  },
}
