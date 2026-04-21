import { ensureGroupAdmin, getTargetJids, toMention } from '../lib/group-utils.js'

export default {
  name: 'demote',
  aliases: [],
  category: 'grup',
  description: 'Cabut status admin dari anggota yang dipilih.',
  async execute({ args, config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot harus jadi admin dulu sebelum bisa menurunkan admin.')
      return
    }

    const targets = getTargetJids(message, args)
    if (!targets.length) {
      await reply(`Contoh: ${config.prefix}demote @user atau balas pesan target.`)
      return
    }

    await sock.groupParticipantsUpdate(context.jid, targets, 'demote')
    await reply(`Berhasil menurunkan admin: ${targets.map(toMention).join(', ')}`)
  },
}
