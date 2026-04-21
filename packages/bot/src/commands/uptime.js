import { formatRuntime } from '../lib/message-utils.js'

export default {
  name: 'uptime',
  aliases: ['runtime'],
  category: 'core',
  description: 'Show how long the bot process has been running.',
  async execute({ reply, state }) {
    await reply(
      [
        '*Mybeebot uptime*',
        '',
        `Runtime: ${formatRuntime(process.uptime())}`,
        `Connection: ${state.connection}`,
      ].join('\n'),
    )
  },
}
