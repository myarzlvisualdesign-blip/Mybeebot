import { ensureGroupAdmin, parseToggle } from '../lib/group-utils.js'

export default {
  name: 'goodbye',
  aliases: ['bye'],
  category: 'grup',
  description: 'Aktifkan atau matikan kartu perpisahan di grup ini.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const value = parseToggle(args[0])
    if (value === null) {
      await reply(`Contoh: ${config.prefix}goodbye on atau ${config.prefix}goodbye off`)
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.set(context.jid, { goodbye: value })

    await reply(`Kartu perpisahan sekarang ${settings.goodbye ? 'aktif' : 'mati'}.`)
  },
}
