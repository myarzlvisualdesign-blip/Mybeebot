import { aiIsConfigured, generateAiReply } from '../lib/ai-client.js'
import { getChatJid, getSenderJid, toMention } from '../lib/group-utils.js'

export default {
  name: 'ai',
  aliases: ['tanya', 'ask'],
  category: 'ai',
  description: 'Tanya AI langsung dari WhatsApp.',
  async execute({ args, config, message, reply, sock }) {
    const prompt = args.join(' ').trim()
    if (!prompt) {
      await reply(`Contoh: ${config.prefix}ai tolong buat caption promosi singkat`)
      return
    }

    if (!aiIsConfigured(config)) {
      await reply(
        'AI belum aktif. Isi AI_API_KEY, AI_BASE_URL, dan AI_MODEL di konfigurasi bot dulu.',
      )
      return
    }

    const chatJid = getChatJid(message)
    const sender = getSenderJid(message)
    const metadata =
      chatJid.endsWith('@g.us') ? await sock.groupMetadata(chatJid).catch(() => null) : null

    const result = await generateAiReply({
      config,
      prompt,
      context: [
        `Chat: ${metadata?.subject || chatJid}`,
        `Pengirim: ${toMention(sender)}`,
        'Balas singkat, jelas, dan tetap natural dalam bahasa Indonesia.',
      ].join('\n'),
    })

    await reply(result)
  },
}
