export default {
  name: 'repo',
  aliases: ['sc', 'source'],
  category: 'core',
  description: 'Send the project repository URL.',
  async execute({ config, reply }) {
    await reply(`Mybeebot repo: ${config.repoUrl}`)
  },
}
