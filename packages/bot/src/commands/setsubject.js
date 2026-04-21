import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'setsubject',
  aliases: ['setname'],
  category: 'group',
  description: 'Change the group subject. Admin or owner only.',
  async execute({ args, config, message, reply, sock }) {
    if (!args.length) {
      await reply('Usage: .setsubject New Group Name')
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot must be an admin before it can change the group subject.')
      return
    }

    const subject = args.join(' ').trim()
    await sock.groupUpdateSubject(context.jid, subject)
    await reply(`Group subject updated to: ${subject}`)
  },
}
