import { ensureGroupAdmin, getTargetJids, toMention } from '../lib/group-utils.js'

export default {
  name: 'demote',
  aliases: [],
  category: 'group',
  description: 'Remove admin status from members. Admin or owner only.',
  async execute({ args, config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot must be an admin before it can demote members.')
      return
    }

    const targets = getTargetJids(message, args)
    if (!targets.length) {
      await reply('Usage: .demote @user or reply to a member message.')
      return
    }

    await sock.groupParticipantsUpdate(context.jid, targets, 'demote')
    await reply(`Demoted: ${targets.map(toMention).join(', ')}`)
  },
}
