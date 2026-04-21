import { getGroupContext, toMention } from '../lib/group-utils.js'

export default {
  name: 'groupinfo',
  aliases: ['gcinfo', 'infogc'],
  category: 'group',
  description: 'Show basic info about the current group.',
  async execute({ message, reply, sock }) {
    const { metadata, participants } = await getGroupContext(sock, message)
    const admins = participants.filter((entry) => entry.admin)

    await reply(
      [
        '*Group info*',
        '',
        `Name: ${metadata.subject || '-'}`,
        `ID: ${metadata.id}`,
        `Members: ${participants.length}`,
        `Admins: ${admins.length}`,
        `Owner: ${metadata.owner ? toMention(metadata.owner) : 'not exposed'}`,
        `Description: ${metadata.desc || 'No description'}`,
      ].join('\n'),
    )
  },
}
