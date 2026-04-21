export default {
  name: 'ping',
  aliases: ['speed'],
  category: 'inti',
  description: 'Cek respons bot dan latency.',
  async execute({ reply }) {
    const startedAt = Date.now()
    await reply('🏓 Sedang mengukur kecepatan bot...')
    const latency = Date.now() - startedAt
    await reply(
      [
        '╭━〔 ⚡ PING BOT 〕━⬣',
        `┃ Latency: ${latency}ms`,
        '┃ Status: respons normal',
        '╰━━━━━━━━━━━━━━━━⬣',
      ].join('\n'),
    )
  },
}
