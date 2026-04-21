import { ensureGroupAdmin, parseToggle } from '../lib/group-utils.js'

export default {
  name: 'antibadword',
  aliases: ['badword'],
  category: 'grup',
  description: 'Aktifkan atau matikan filter kata terlarang di grup.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const value = parseToggle(args[0])
    if (value === null) {
      await reply(`🚫 Contoh: ${config.prefix}antibadword on atau ${config.prefix}antibadword off`)
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.set(context.jid, { antiBadword: value })
    await reply(`🚫 Anti-badword sekarang ${settings.antiBadword ? 'aktif ✅' : 'mati ❌'}.`)
  },
}
