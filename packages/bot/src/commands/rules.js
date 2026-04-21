export default {
  name: 'rules',
  aliases: ['rule'],
  category: 'info',
  description: 'Show the bot usage rules.',
  async execute({ config, reply }) {
    await reply(
      [
        `*${config.botName} rules*`,
        '',
        `1. Use commands with prefix ${config.prefix}`,
        '2. Do not spam the bot repeatedly',
        '3. Respect the owner and group admins',
        '4. Use group tools only when needed',
        '5. If the bot stops responding, reconnect from the dashboard',
      ].join('\n'),
    )
  },
}
