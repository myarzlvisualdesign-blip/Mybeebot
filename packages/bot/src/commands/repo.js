export default {
  name: 'repo',
  aliases: ['sc', 'source'],
  category: 'inti',
  description: 'Kirim URL repository project.',
  async execute({ config, reply }) {
    await reply(`Repo ${config.botName}: ${config.repoUrl}`)
  },
}
