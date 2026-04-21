export default {
  name: 'owner',
  aliases: ['creator', 'contact'],
  category: 'core',
  description: 'Show owner identity and contact numbers.',
  async execute({ config, reply }) {
    const numbers = config.ownerNumbers.length
      ? config.ownerNumbers.map((number) => `+${number}`).join(', ')
      : 'Not configured'

    await reply(
      [
        `*${config.botName} owner info*`,
        '',
        `Name: ${config.ownerName}`,
        `Numbers: ${numbers}`,
        `Website: ${config.websiteUrl}`,
      ].join('\n'),
    )
  },
}
