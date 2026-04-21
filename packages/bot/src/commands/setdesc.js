import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'setdesc',
  aliases: ['setdescription'],
  category: 'group',
  description: 'Change the group description. Admin or owner only.',
  async execute({ args, config, message, reply, sock }) {
    if (!args.length) {
      await reply('Usage: .setdesc New group description')
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot must be an admin before it can change the group description.')
      return
    }

    const description = args.join(' ').trim()
    await sock.groupUpdateDescription(context.jid, description)
    await reply('Group description updated.')
  },
}
