import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'hidetag',
  aliases: ['silenttag'],
  category: 'group',
  description: 'Send a hidden mention to all members. Admin or owner only.',
  async execute({ args, config, message, reply, sock }) {
    if (!args.length) {
      await reply('Usage: .hidetag your message here')
      return
    }

    const { participants, jid } = await ensureGroupAdmin(sock, message, config)
    await sock.sendMessage(
      jid,
      {
        text: args.join(' '),
        mentions: participants.map((entry) => entry.id),
      },
      { quoted: message },
    )
  },
}
