import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'close',
  aliases: [],
  category: 'grup',
  description: 'Tutup grup agar hanya admin yang bisa kirim pesan.',
  async execute({ config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot harus jadi admin dulu sebelum bisa mengatur grup.')
      return
    }

    await sock.groupSettingUpdate(context.jid, 'announcement')
    await reply('Grup sekarang ditutup. Hanya admin yang bisa kirim pesan.')
  },
}
