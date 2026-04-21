export default {
  name: 'ping',
  category: 'core',
  description: 'Measure bot response latency.',
  async execute({ reply }) {
    const startedAt = Date.now()
    await reply('Pong...')
    const latency = Date.now() - startedAt
    await reply(`Pong. Latency: ${latency}ms`)
  },
}
