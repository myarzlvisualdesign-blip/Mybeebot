import { parseToggle } from '../lib/group-utils.js'

export default {
  name: 'anticall',
  aliases: ['callguard'],
  category: 'owner',
  description: 'Aktifkan atau matikan auto reject telepon masuk.',
  ownerOnly: true,
  async execute({ args, config, reply, systemSettings }) {
    const value = parseToggle(args[0])
    if (value === null) {
      const settings = systemSettings.get()
      await reply(
        [
          '╭━〔 📵 ANTI-CALL 〕━⬣',
          `┃ Status: ${settings.antiCall ? 'aktif ✅' : 'mati ❌'}`,
          '╰━━━━━━━━━━━━━━━━⬣',
          `💡 Contoh: ${config.prefix}anticall on`,
        ].join('\n'),
      )
      return
    }

    const settings = await systemSettings.set({ antiCall: value })
    await reply(`📵 Anti-call sekarang ${settings.antiCall ? 'aktif ✅' : 'mati ❌'}.`)
  },
}
