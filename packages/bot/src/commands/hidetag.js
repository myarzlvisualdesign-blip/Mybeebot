import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'hidetag',
  aliases: ['silenttag'],
  category: 'grup',
  description: 'Kirim mention tersembunyi ke semua anggota.',
  async execute({ args, config, message, reply, sock }) {
    if (!args.length) {
      await reply(`Contoh: ${config.prefix}hidetag rapat mulai sekarang`)
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
