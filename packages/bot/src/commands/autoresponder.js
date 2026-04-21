import { ensureGroupAdmin, parseToggle } from '../lib/group-utils.js'

export default {
  name: 'autoresponder',
  aliases: ['autorespon', 'replyauto'],
  category: 'grup',
  description: 'Aktifkan atau matikan auto-responder per grup.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const value = parseToggle(args[0])
    if (value === null) {
      await reply(
        `Contoh: ${config.prefix}autoresponder on atau ${config.prefix}autoresponder off`,
      )
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.set(context.jid, { autoResponder: value })
    await reply(`Auto-responder sekarang ${settings.autoResponder ? 'aktif' : 'mati'}.`)
  },
}
