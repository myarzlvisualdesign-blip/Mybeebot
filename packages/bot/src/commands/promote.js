import { ensureGroupAdmin, getTargetJids, toMention } from '../lib/group-utils.js'

export default {
  name: 'promote',
  aliases: [],
  category: 'grup',
  description: 'Naikkan anggota jadi admin.',
  async execute({ args, config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot harus jadi admin dulu sebelum bisa menaikkan admin.')
      return
    }

    const targets = getTargetJids(message, args)
    if (!targets.length) {
      await reply(`Contoh: ${config.prefix}promote @user atau balas pesan target.`)
      return
    }

    await sock.groupParticipantsUpdate(context.jid, targets, 'promote')
    await reply(`Berhasil menaikkan admin: ${targets.map(toMention).join(', ')}`)
  },
}
