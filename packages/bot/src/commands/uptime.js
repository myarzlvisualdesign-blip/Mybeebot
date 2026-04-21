import { formatRuntime } from '../lib/message-utils.js'

export default {
  name: 'uptime',
  aliases: ['runtime'],
  category: 'inti',
  description: 'Tampilkan sudah berapa lama bot berjalan.',
  async execute({ reply, state }) {
    await reply(
      [
        '*Uptime Mybeebot*',
        '',
        `Runtime: ${formatRuntime(process.uptime())}`,
        `Koneksi: ${state.connection}`,
      ].join('\n'),
    )
  },
}
