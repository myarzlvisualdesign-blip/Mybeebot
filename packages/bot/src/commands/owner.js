export default {
  name: 'owner',
  aliases: ['creator', 'contact', 'dev'],
  category: 'inti',
  description: 'Tampilkan identitas owner dan nomor kontaknya.',
  async execute({ config, reply }) {
    const numbers = config.ownerNumbers.length
      ? config.ownerNumbers.map((number) => `+${number}`).join(', ')
      : 'Belum diatur'

    await reply(
      [
        '╭━〔 👑 OWNER BOT 〕━⬣',
        `┃ Nama: ${config.ownerName}`,
        `┃ Nomor: ${numbers}`,
        `┃ Website: ${config.websiteUrl}`,
        `┃ Bot: ${config.botName}`,
        '╰━━━━━━━━━━━━━━━━⬣',
        '📬 Hubungi owner kalau mau custom fitur atau mode bot.',
      ].join('\n'),
    )
  },
}
