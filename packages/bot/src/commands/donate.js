export default {
  name: 'donate',
  aliases: ['donasi', 'support'],
  category: 'info',
  description: 'Show how to support the bot owner.',
  async execute({ config, reply }) {
    const number = config.ownerNumbers[0] ? `+${config.ownerNumbers[0]}` : 'owner number not set'

    await reply(
      [
        `*Support ${config.botName}*`,
        '',
        'If you want to support development, contact the owner directly.',
        `Owner: ${config.ownerName}`,
        `Contact: ${number}`,
        `Website: ${config.websiteUrl}`,
      ].join('\n'),
    )
  },
}
