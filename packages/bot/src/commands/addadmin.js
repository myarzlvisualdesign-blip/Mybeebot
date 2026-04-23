import { actorFromMessage } from '../lib/permissions.js'

export default {
  name: 'addadmin',
  aliases: ['tambahadmin'],
  category: 'admin',
  description: 'Tambahkan nomor WhatsApp sebagai admin bot.',
  adminOnly: true,
  async execute({ args, reply, role, sender, settingsService }) {
    const number = args.join(' ').trim()
    const roles = await settingsService.addRole(
      'admins',
      number,
      actorFromMessage({ role, sender }),
    )

    await reply(`Admin ditambahkan. Total admin: ${roles.admins.length}.`)
  },
}
