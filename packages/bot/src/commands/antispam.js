import { ensureGroupAdmin, parseToggle } from '../lib/group-utils.js'

export default {
  name: 'antispam',
  aliases: ['spamguard'],
  category: 'grup',
  description: 'Aktifkan atau matikan penjaga anti-spam di grup.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const value = parseToggle(args[0])
    if (value === null) {
      await reply(`🚦 Contoh: ${config.prefix}antispam on atau ${config.prefix}antispam off`)
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.set(context.jid, { antiSpam: value })

    await reply(`🚦 Anti-spam sekarang ${settings.antiSpam ? 'aktif ✅' : 'mati ❌'}.`)
  },
}
