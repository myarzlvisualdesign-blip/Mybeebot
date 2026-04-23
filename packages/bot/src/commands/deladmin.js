import { actorFromMessage } from '../lib/permissions.js'

export default {
  name: 'deladmin',
  aliases: ['hapusadmin'],
  category: 'admin',
  description: 'Hapus nomor WhatsApp dari admin bot.',
  adminOnly: true,
  async execute({ args, reply, role, sender, settingsService }) {
    const number = args.join(' ').trim()
    const roles = await settingsService.removeRole(
      'admins',
      number,
      actorFromMessage({ role, sender }),
    )

    await reply(`Admin dihapus. Total admin: ${roles.admins.length}.`)
  },
}
