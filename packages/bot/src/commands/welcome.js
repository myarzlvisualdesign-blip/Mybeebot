import { ensureGroupAdmin, parseToggle } from '../lib/group-utils.js'

export default {
  name: 'welcome',
  aliases: [],
  category: 'grup',
  description: 'Aktifkan atau matikan welcome card di grup ini.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const value = parseToggle(args[0])
    if (value === null) {
      await reply(`Contoh: ${config.prefix}welcome on atau ${config.prefix}welcome off`)
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.set(context.jid, { welcome: value })

    await reply(`Welcome card sekarang ${settings.welcome ? 'aktif' : 'mati'}.`)
  },
}
