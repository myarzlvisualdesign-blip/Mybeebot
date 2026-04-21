import { getChatJid, getSenderJid, isGroupChat } from '../lib/group-utils.js'

export default {
  name: 'id',
  aliases: ['chatid'],
  category: 'utility',
  description: 'Show the current chat ID and sender ID.',
  async execute({ message, reply }) {
    await reply(
      [
        '*Chat identity*',
        '',
        `Chat ID: ${getChatJid(message) || 'unknown'}`,
        `Sender ID: ${getSenderJid(message) || 'unknown'}`,
        `Group chat: ${isGroupChat(message) ? 'yes' : 'no'}`,
      ].join('\n'),
    )
  },
}
