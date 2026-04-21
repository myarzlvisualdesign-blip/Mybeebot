import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'close',
  aliases: [],
  category: 'group',
  description: 'Close the group so only admins can send messages. Admin or owner only.',
  async execute({ config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot must be an admin before it can change group settings.')
      return
    }

    await sock.groupSettingUpdate(context.jid, 'announcement')
    await reply('Group is now admin-only.')
  },
}
