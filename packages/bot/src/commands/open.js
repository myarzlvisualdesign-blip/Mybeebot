import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'open',
  aliases: [],
  category: 'group',
  description: 'Open the group so all members can send messages. Admin or owner only.',
  async execute({ config, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    if (!context.botAdmin) {
      await reply('Bot must be an admin before it can change group settings.')
      return
    }

    await sock.groupSettingUpdate(context.jid, 'not_announcement')
    await reply('Group is now open for all members.')
  },
}
