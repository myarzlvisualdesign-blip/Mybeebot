export default {
  name: 'repo',
  aliases: ['sc', 'source', 'script'],
  category: 'inti',
  description: 'Kirim URL repository project.',
  async execute({ config, reply }) {
    await reply(
      [
        '╭━〔 📦 REPOSITORY 〕━⬣',
        `┃ Nama: ${config.botName}`,
        `┃ URL: ${config.repoUrl}`,
        '╰━━━━━━━━━━━━━━━━⬣',
      ].join('\n'),
    )
  },
}
