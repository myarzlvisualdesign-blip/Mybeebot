export default {
  name: 'ping',
  category: 'inti',
  description: 'Cek respons bot dan latency.',
  async execute({ reply }) {
    const startedAt = Date.now()
    await reply('Mengukur ping...')
    const latency = Date.now() - startedAt
    await reply(`Pong. Latency: ${latency}ms`)
  },
}
