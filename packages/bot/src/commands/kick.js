import { ensureGroupAdmin, getTargetJids, normalizeJid, toMention } from '../lib/group-utils.js'

export default {
  name: 'kick',
  aliases: ['remove'],
  category: 'group',
  description: 'Remove mentioned, quoted, or typed members. Admin or owner only.',
  async execute({ args, config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot must be an admin before it can remove members.')
      return
    }

    const targets = getTargetJids(message, args).filter(
      (jid) => normalizeJid(jid) !== normalizeJid(sock.user?.id),
    )

    if (!targets.length) {
      await reply('Usage: .kick @user or reply to a member message.')
      return
    }

    await sock.groupParticipantsUpdate(context.jid, targets, 'remove')
    await reply(`Removed: ${targets.map(toMention).join(', ')}`)
  },
}
