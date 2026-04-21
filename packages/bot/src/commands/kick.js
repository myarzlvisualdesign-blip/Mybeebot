import { ensureGroupAdmin, getTargetJids, normalizeJid, toMention } from '../lib/group-utils.js'

export default {
  name: 'kick',
  aliases: ['remove'],
  category: 'grup',
  description: 'Keluarkan anggota yang di-tag, dibalas, atau ditulis nomornya.',
  async execute({ args, config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot harus jadi admin dulu sebelum bisa mengeluarkan anggota.')
      return
    }

    const targets = getTargetJids(message, args).filter(
      (jid) => normalizeJid(jid) !== normalizeJid(sock.user?.id),
    )

    if (!targets.length) {
      await reply(`Contoh: ${config.prefix}kick @user atau balas pesan target.`)
      return
    }

    await sock.groupParticipantsUpdate(context.jid, targets, 'remove')
    await reply(`Berhasil mengeluarkan: ${targets.map(toMention).join(', ')}`)
  },
}
