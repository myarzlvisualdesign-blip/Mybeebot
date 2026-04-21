import { getGroupContext, toMention } from '../lib/group-utils.js'

export default {
  name: 'admins',
  aliases: ['adminlist'],
  category: 'grup',
  description: 'Tandai semua admin di grup ini.',
  async execute({ message, reply, sock }) {
    const { participants } = await getGroupContext(sock, message)
    const admins = participants.filter((entry) => entry.admin)

    if (!admins.length) {
      await reply('Admin grup tidak ditemukan.')
      return
    }

    const lines = admins.map((entry, index) => `${index + 1}. ${toMention(entry.id)}`)
    await sock.sendMessage(
      message.key.remoteJid,
      {
        text: ['*Daftar admin grup*', '', ...lines].join('\n'),
        mentions: admins.map((entry) => entry.id),
      },
      { quoted: message },
    )
  },
}
