import { formatRuntime } from '../lib/message-utils.js'

export default {
  name: 'alive',
  aliases: ['status'],
  category: 'core',
  description: 'Show bot identity and runtime health.',
  async execute({ config, registry, reply, state }) {
    const lines = [
      `*${config.botName} is online*`,
      '',
      `Owner: ${config.ownerName}`,
      `Mode: ${config.botMode}`,
      `Prefix: ${config.prefix}`,
      `Commands: ${registry.count()}`,
      `Runtime: ${formatRuntime(process.uptime())}`,
      `Website: ${config.websiteUrl}`,
      `Repo: ${config.repoUrl}`,
      `Connection: ${state.connection}`,
    ]

    await reply(lines.join('\n'))
  },
}
