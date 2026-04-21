export default {
  name: 'donate',
  aliases: ['donasi', 'support'],
  category: 'info',
  description: 'Tampilkan cara mendukung owner bot.',
  async execute({ config, reply }) {
    const number = config.ownerNumbers[0] ? `+${config.ownerNumbers[0]}` : 'nomor owner belum diatur'

    await reply(
      [
        `*Dukung ${config.botName}*`,
        '',
        'Kalau mau dukung pengembangan bot, langsung hubungi owner ya.',
        `Owner: ${config.ownerName}`,
        `Kontak: ${number}`,
        `Website: ${config.websiteUrl}`,
      ].join('\n'),
    )
  },
}
