import { formatRuntime } from '../lib/message-utils.js'

export default {
  name: 'alive',
  aliases: ['status', 'botinfo'],
  category: 'inti',
  description: 'Tampilkan identitas bot dan status runtime.',
  async execute({ config, registry, reply, state }) {
    const lines = [
      '╭━〔 🟢 STATUS BOT 〕━⬣',
      `┃ Nama: ${config.botName}`,
      `┃ Owner: ${config.ownerName}`,
      `┃ Mode: ${config.botMode}`,
      `┃ Prefix: ${config.prefix}`,
      `┃ Command: ${registry.count()}`,
      `┃ Uptime: ${formatRuntime(process.uptime())}`,
      `┃ Koneksi: ${state.connection}`,
      '╰━━━━━━━━━━━━━━━━⬣',
      `🌐 Website: ${config.websiteUrl}`,
      `📦 Repo: ${config.repoUrl}`,
    ]

    await reply(lines.join('\n'))
  },
}
