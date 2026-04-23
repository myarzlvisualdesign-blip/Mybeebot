import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'groupconfig',
  aliases: ['gcconfig', 'settings', 'fitur'],
  category: 'grup',
  description: 'Tampilkan semua pengaturan bot untuk grup ini.',
  async execute({ config, groupSettings, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    const settings = groupSettings.get(context.jid)

    await reply(
      [
        '╭━〔 👥 FITUR GRUP 〕━⬣',
        `┃ Welcome Card: ${settings.welcome ? '✅ aktif' : '❌ mati'}`,
        `┃ Goodbye Card: ${settings.goodbye ? '✅ aktif' : '❌ mati'}`,
        `┃ Anti-link: ${settings.antiLink}`,
        `┃ Anti-spam: ${settings.antiSpam ? '✅ aktif' : '❌ mati'}`,
        `┃ Anti-badword: ${settings.antiBadword ? '✅ aktif' : '❌ mati'}`,
        `┃ Jumlah Badword: ${(settings.badWords || []).length}`,
        `┃ Auto-responder: ${settings.autoResponder ? '✅ aktif' : '❌ mati'}`,
        `┃ Jumlah Reply Auto: ${Object.keys(settings.autoReplies || {}).length}`,
        '╰━━━━━━━━━━━━━━━━⬣',
        `💡 Prefix grup ini: ${config.prefix}`,
      ].join('\n'),
    )
  },
}
