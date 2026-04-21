import { aiIsConfigured } from '../lib/ai-client.js'
import { ensureGroupAdmin, parseToggle } from '../lib/group-utils.js'

export default {
  name: 'aireply',
  aliases: ['aiauto'],
  category: 'ai',
  description: 'Aktifkan balasan AI otomatis saat bot dipanggil di grup.',
  async execute({ args, config, groupSettings, message, reply, sock }) {
    const value = parseToggle(args[0])
    if (value === null) {
      await reply(`Contoh: ${config.prefix}aireply on atau ${config.prefix}aireply off`)
      return
    }

    if (value && !aiIsConfigured(config)) {
      await reply('AI belum aktif. Isi AI_API_KEY, AI_BASE_URL, dan AI_MODEL dulu.')
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    const settings = await groupSettings.set(context.jid, { aiReply: value })
    await reply(`AI reply otomatis sekarang ${settings.aiReply ? 'aktif' : 'mati'}.`)
  },
}
