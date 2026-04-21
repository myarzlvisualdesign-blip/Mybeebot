import { ensureGroupAdmin, parseToggle } from '../lib/group-utils.js'

export default {
  name: 'goodbye',
  aliases: ['bye'],
  category: 'group',
  description: 'Turn goodbye messages on or off for this group. Admin or owner only.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const value = parseToggle(args[0])
    if (value === null) {
      await reply('Usage: .goodbye on or .goodbye off')
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.set(context.jid, { goodbye: value })

    await reply(`Goodbye messages are now ${settings.goodbye ? 'enabled' : 'disabled'}.`)
  },
}
