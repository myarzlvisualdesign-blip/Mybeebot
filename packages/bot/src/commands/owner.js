export default {
  name: 'owner',
  aliases: ['creator', 'contact'],
  category: 'inti',
  description: 'Tampilkan identitas owner dan nomor kontaknya.',
  async execute({ config, reply }) {
    const numbers = config.ownerNumbers.length
      ? config.ownerNumbers.map((number) => `+${number}`).join(', ')
      : 'Belum diatur'

    await reply(
      [
        `*Info owner ${config.botName}*`,
        '',
        `Nama: ${config.ownerName}`,
        `Nomor: ${numbers}`,
        `Website: ${config.websiteUrl}`,
      ].join('\n'),
    )
  },
}
