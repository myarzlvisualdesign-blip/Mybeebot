import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'listbadword',
  aliases: ['badwords'],
  category: 'grup',
  description: 'Lihat daftar kata terlarang grup ini.',
  async execute({ config, groupSettings, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    const settings = groupSettings.get(context.jid)

    if (!settings.badWords.length) {
      await reply(`🚫 Belum ada badword. Tambah dulu dengan ${config.prefix}addbadword kata`)
      return
    }

    const lines = settings.badWords.map((word, index) => `${index + 1}. ${word}`)
    await reply(['╭━〔 🚫 DAFTAR BADWORD 〕━⬣', ...lines, '╰━━━━━━━━━━━━━━━━⬣'].join('\n'))
  },
}
