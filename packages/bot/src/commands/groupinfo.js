import { getGroupContext, toMention } from '../lib/group-utils.js'

export default {
  name: 'groupinfo',
  aliases: ['gcinfo', 'infogc'],
  category: 'grup',
  description: 'Tampilkan info dasar grup saat ini.',
  async execute({ message, reply, sock }) {
    const { metadata, participants } = await getGroupContext(sock, message)
    const admins = participants.filter((entry) => entry.admin)

    await reply(
      [
        '*Info grup*',
        '',
        `Nama: ${metadata.subject || '-'}`,
        `ID: ${metadata.id}`,
        `Member: ${participants.length}`,
        `Admin: ${admins.length}`,
        `Owner: ${metadata.owner ? toMention(metadata.owner) : 'tidak terlihat'}`,
        `Deskripsi: ${metadata.desc || 'Belum ada deskripsi'}`,
      ].join('\n'),
    )
  },
}
