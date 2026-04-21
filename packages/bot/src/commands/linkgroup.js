import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'linkgroup',
  aliases: ['grouplink'],
  category: 'grup',
  description: 'Tampilkan link undangan grup saat ini.',
  async execute({ config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot harus jadi admin dulu sebelum bisa membaca link grup.')
      return
    }

    const code = await sock.groupInviteCode(context.jid)
    if (!code) {
      await reply('Link undangan grup tidak bisa diambil.')
      return
    }

    await reply(`Link undangan grup:\nhttps://chat.whatsapp.com/${code}`)
  },
}
