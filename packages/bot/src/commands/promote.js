import { ensureGroupAdmin, getTargetJids, toMention } from '../lib/group-utils.js'

export default {
  name: 'promote',
  aliases: [],
  category: 'group',
  description: 'Promote members to admin. Admin or owner only.',
  async execute({ args, config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot must be an admin before it can promote members.')
      return
    }

    const targets = getTargetJids(message, args)
    if (!targets.length) {
      await reply('Usage: .promote @user or reply to a member message.')
      return
    }

    await sock.groupParticipantsUpdate(context.jid, targets, 'promote')
    await reply(`Promoted: ${targets.map(toMention).join(', ')}`)
  },
}
