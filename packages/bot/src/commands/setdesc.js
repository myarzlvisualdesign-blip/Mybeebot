import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'setdesc',
  aliases: ['setdescription'],
  category: 'grup',
  description: 'Ubah deskripsi grup.',
  async execute({ args, config, message, reply, sock }) {
    if (!args.length) {
      await reply(`Contoh: ${config.prefix}setdesc Deskripsi grup baru`)
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot harus jadi admin dulu sebelum bisa mengubah deskripsi grup.')
      return
    }

    const description = args.join(' ').trim()
    await sock.groupUpdateDescription(context.jid, description)
    await reply('Deskripsi grup berhasil diperbarui.')
  },
}
