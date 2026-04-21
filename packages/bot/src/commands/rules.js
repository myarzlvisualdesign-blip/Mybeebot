export default {
  name: 'rules',
  aliases: ['rule'],
  category: 'info',
  description: 'Tampilkan aturan penggunaan bot.',
  async execute({ config, reply }) {
    await reply(
      [
        `*Aturan ${config.botName}*`,
        '',
        `1. Gunakan command dengan prefix ${config.prefix}`,
        '2. Jangan spam bot berulang-ulang',
        '3. Hormati owner dan admin grup',
        '4. Pakai tools grup hanya saat perlu',
        '5. Kalau bot berhenti merespons, sambungkan ulang dari dashboard',
      ].join('\n'),
    )
  },
}
