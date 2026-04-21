export default {
  name: 'rules',
  aliases: ['rule'],
  category: 'info',
  description: 'Tampilkan aturan penggunaan bot.',
  async execute({ config, reply }) {
    await reply(
      [
        '╭━〔 📌 ATURAN BOT 〕━⬣',
        `┃ 1. Gunakan prefix ${config.prefix}`,
        '┃ 2. Jangan spam bot berulang-ulang',
        '┃ 3. Hormati owner dan admin grup',
        '┃ 4. Pakai tools grup saat perlu saja',
        '┃ 5. Kalau bot error, sambungkan ulang dari dashboard',
        '╰━━━━━━━━━━━━━━━━⬣',
      ].join('\n'),
    )
  },
}
