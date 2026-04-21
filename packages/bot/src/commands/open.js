import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'open',
  aliases: [],
  category: 'grup',
  description: 'Buka grup agar semua anggota bisa kirim pesan.',
  async execute({ config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot harus jadi admin dulu sebelum bisa mengatur grup.')
      return
    }

    await sock.groupSettingUpdate(context.jid, 'not_announcement')
    await reply('Grup sekarang dibuka untuk semua anggota.')
  },
}
