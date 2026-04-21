import { ensureGroupAdmin, toMention } from '../lib/group-utils.js'

export default {
  name: 'tagall',
  aliases: ['everyone'],
  category: 'grup',
  description: 'Tandai semua anggota grup.',
  async execute({ args, config, message, sock }) {
    const { participants, jid } = await ensureGroupAdmin(sock, message, config)
    const header = args.length ? args.join(' ') : 'Perhatian semuanya'
    const lines = participants.map((entry, index) => `${index + 1}. ${toMention(entry.id)}`)

    await sock.sendMessage(
      jid,
      {
        text: [`*${header}*`, '', ...lines].join('\n'),
        mentions: participants.map((entry) => entry.id),
      },
      { quoted: message },
    )
  },
}
