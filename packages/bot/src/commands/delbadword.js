import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'delbadword',
  aliases: ['hapusbadword'],
  category: 'grup',
  description: 'Hapus kata terlarang dari filter grup.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const word = args.join(' ').trim().toLowerCase()
    if (!word) {
      await reply(`🚫 Contoh: ${config.prefix}delbadword kasar`)
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.removeBadWord(context.jid, word)

    await reply(`🗑️ Kata *${word}* dihapus. Total badword: ${settings.badWords.length}.`)
  },
}
