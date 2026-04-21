import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'groupconfig',
  aliases: ['gcconfig', 'settings'],
  category: 'group',
  description: 'Show the current bot settings for this group. Admin or owner only.',
  async execute({ config, groupSettings, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    const settings = groupSettings.get(context.jid)

    await reply(
      [
        '*Group bot settings*',
        '',
        `Welcome: ${settings.welcome ? 'on' : 'off'}`,
        `Goodbye: ${settings.goodbye ? 'on' : 'off'}`,
      ].join('\n'),
    )
  },
}
