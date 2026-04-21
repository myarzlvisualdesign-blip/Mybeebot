import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'setsubject',
  aliases: ['setname'],
  category: 'grup',
  description: 'Ubah nama grup.',
  async execute({ args, config, message, reply, sock }) {
    if (!args.length) {
      await reply(`Contoh: ${config.prefix}setsubject Nama Grup Baru`)
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot harus jadi admin dulu sebelum bisa mengubah nama grup.')
      return
    }

    const subject = args.join(' ').trim()
    await sock.groupUpdateSubject(context.jid, subject)
    await reply(`Nama grup berhasil diubah menjadi: ${subject}`)
  },
}
