import { getGroupContext, toMention } from '../lib/group-utils.js'

export default {
  name: 'admins',
  aliases: ['adminlist'],
  category: 'group',
  description: 'Mention all admins in the current group.',
  async execute({ message, reply, sock }) {
    const { participants } = await getGroupContext(sock, message)
    const admins = participants.filter((entry) => entry.admin)

    if (!admins.length) {
      await reply('No admins were found in this group.')
      return
    }

    const lines = admins.map((entry, index) => `${index + 1}. ${toMention(entry.id)}`)
    await sock.sendMessage(
      message.key.remoteJid,
      {
        text: ['*Group admins*', '', ...lines].join('\n'),
        mentions: admins.map((entry) => entry.id),
      },
      { quoted: message },
    )
  },
}
