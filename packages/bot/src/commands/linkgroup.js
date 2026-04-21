import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'linkgroup',
  aliases: ['grouplink'],
  category: 'group',
  description: 'Show the current group invite link. Admin or owner only.',
  async execute({ config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot must be an admin before it can read the invite link.')
      return
    }

    const code = await sock.groupInviteCode(context.jid)
    if (!code) {
      await reply('Unable to read the invite link for this group.')
      return
    }

    await reply(`Group invite link:\nhttps://chat.whatsapp.com/${code}`)
  },
}
