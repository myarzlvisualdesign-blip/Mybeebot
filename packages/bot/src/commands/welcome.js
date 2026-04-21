import { ensureGroupAdmin, parseToggle } from '../lib/group-utils.js'

export default {
  name: 'welcome',
  aliases: [],
  category: 'group',
  description: 'Turn welcome messages on or off for this group. Admin or owner only.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const value = parseToggle(args[0])
    if (value === null) {
      await reply('Usage: .welcome on or .welcome off')
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.set(context.jid, { welcome: value })

    await reply(`Welcome messages are now ${settings.welcome ? 'enabled' : 'disabled'}.`)
  },
}
