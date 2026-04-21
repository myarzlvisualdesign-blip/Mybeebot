import { ensureGroupAdmin, getTargetJids, toMention } from '../lib/group-utils.js'

export default {
  name: 'add',
  aliases: ['invite', 'undang'],
  category: 'grup',
  description: 'Tambah anggota ke grup lewat nomor. Khusus admin atau owner.',
  async execute({ args, config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot harus jadi admin dulu sebelum bisa menambahkan anggota.')
      return
    }

    const targets = getTargetJids(message, args)
    if (!targets.length) {
      await reply(`Contoh: ${config.prefix}add 6281234567890`)
      return
    }

    await sock.groupParticipantsUpdate(context.jid, targets, 'add')
    await reply(`Permintaan tambah anggota dikirim untuk: ${targets.map(toMention).join(', ')}`)
  },
}
