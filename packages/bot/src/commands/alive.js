import { formatRuntime } from '../lib/message-utils.js'

export default {
  name: 'alive',
  aliases: ['status'],
  category: 'inti',
  description: 'Tampilkan identitas bot dan status runtime.',
  async execute({ config, registry, reply, state }) {
    const lines = [
      `*${config.botName} sedang online*`,
      '',
      `Owner: ${config.ownerName}`,
      `Mode: ${config.botMode}`,
      `Prefix: ${config.prefix}`,
      `Jumlah command: ${registry.count()}`,
      `Uptime: ${formatRuntime(process.uptime())}`,
      `Website: ${config.websiteUrl}`,
      `Repo: ${config.repoUrl}`,
      `Koneksi: ${state.connection}`,
    ]

    await reply(lines.join('\n'))
  },
}
