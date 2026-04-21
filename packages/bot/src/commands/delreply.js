import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'delreply',
  aliases: ['hapusreply'],
  category: 'grup',
  description: 'Hapus satu keyword auto-responder dari grup ini.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const trigger = args.join(' ').trim().toLowerCase()
    if (!trigger) {
      await reply(`Contoh: ${config.prefix}delreply halo`)
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const current = groupSettings.get(context.jid)
    if (!current.autoReplies[trigger]) {
      await reply(`Keyword *${trigger}* belum ada di daftar auto-responder.`)
      return
    }

    await groupSettings.removeAutoReply(context.jid, trigger)
    await reply(`Keyword *${trigger}* berhasil dihapus.`)
  },
}
