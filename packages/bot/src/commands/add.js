import { ensureGroupAdmin, getTargetJids, toMention } from '../lib/group-utils.js'

export default {
  name: 'add',
  aliases: ['invite'],
  category: 'group',
  description: 'Add members by typing their numbers. Admin or owner only.',
  async execute({ args, config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot must be an admin before it can add members.')
      return
    }

    const targets = getTargetJids(message, args)
    if (!targets.length) {
      await reply('Usage: .add 6281234567890')
      return
    }

    await sock.groupParticipantsUpdate(context.jid, targets, 'add')
    await reply(`Add request sent for: ${targets.map(toMention).join(', ')}`)
  },
}
