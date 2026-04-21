import { ensureGroupAdmin } from '../lib/group-utils.js'

function parseAntiLinkMode(value) {
  const normalized = String(value || '').trim().toLowerCase()

  if (['off', 'mati', 'disable'].includes(normalized)) {
    return 'off'
  }

  if (['on', 'aktif', 'kick'].includes(normalized)) {
    return 'kick'
  }

  if (normalized === 'warn') {
    return 'warn'
  }

  return null
}

export default {
  name: 'antilink',
  aliases: ['antilinkgc'],
  category: 'grup',
  description: 'Atur proteksi link di grup: off, warn, atau kick.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const mode = parseAntiLinkMode(args[0])
    if (!mode) {
      await reply(
        `Contoh: ${config.prefix}antilink on, ${config.prefix}antilink warn, atau ${config.prefix}antilink off`,
      )
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.set(context.jid, { antiLink: mode })
    await reply(`Anti-link sekarang di mode *${settings.antiLink}*.`)
  },
}
