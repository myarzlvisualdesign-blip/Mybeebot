import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'groupconfig',
  aliases: ['gcconfig', 'settings'],
  category: 'grup',
  description: 'Tampilkan semua pengaturan bot untuk grup ini.',
  async execute({ config, groupSettings, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    const settings = groupSettings.get(context.jid)

    await reply(
      [
        '*Pengaturan bot grup*',
        '',
        `Welcome card: ${settings.welcome ? 'on' : 'off'}`,
        `Goodbye card: ${settings.goodbye ? 'on' : 'off'}`,
        `Anti-link: ${settings.antiLink}`,
        `AI reply: ${settings.aiReply ? 'on' : 'off'}`,
        `Auto-responder: ${settings.autoResponder ? 'on' : 'off'}`,
        `Jumlah balasan otomatis: ${Object.keys(settings.autoReplies || {}).length}`,
      ].join('\n'),
    )
  },
}
