export default {
  name: 'donate',
  aliases: ['donasi', 'support'],
  category: 'info',
  description: 'Tampilkan cara mendukung owner bot.',
  async execute({ config, reply }) {
    const number = config.ownerNumbers[0] ? `+${config.ownerNumbers[0]}` : 'nomor owner belum diatur'

    await reply(
      [
        '╭━〔 💝 DUKUNG BOT 〕━⬣',
        `┃ Bot: ${config.botName}`,
        `┃ Owner: ${config.ownerName}`,
        `┃ Kontak: ${number}`,
        '╰━━━━━━━━━━━━━━━━⬣',
        'Kalau mau dukung pengembangan bot, langsung hubungi owner ya.',
        `🌐 Website: ${config.websiteUrl}`,
      ].join('\n'),
    )
  },
}
