import { parseToggle } from '../lib/group-utils.js'
import { actorFromMessage } from '../lib/permissions.js'

export default {
  name: 'set',
  aliases: ['atur'],
  category: 'admin',
  description: 'Ubah setting admin dari WhatsApp.',
  adminOnly: true,
  async execute({ args, config, reply, role, sender, settingsService }) {
    const key = String(args.shift() || '').toLowerCase()
    const value = args.join(' ').trim()
    const actor = actorFromMessage({ role, sender })

    if (!['welcome', 'delay', 'replydelay', 'improve'].includes(key)) {
      await reply(
        [
          `Format: ${config.prefix}set welcome <teks>`,
          `Format: ${config.prefix}set delay <detik|off>`,
          `Format: ${config.prefix}set improve on|off`,
          `Contoh: ${config.prefix}set welcome Halo, selamat datang di Mybeebot.`,
        ].join('\n'),
      )
      return
    }

    if (key === 'delay' || key === 'replydelay') {
      if (!value) {
        await reply(`Isi delay wajib. Contoh: ${config.prefix}set delay 2 atau ${config.prefix}set delay off`)
        return
      }

      if (value.toLowerCase() === 'off') {
        await settingsService.updateSettings(
          {
            replyTiming: {
              enabled: false,
            },
          },
          actor,
        )
        await reply('Delay balasan bot dimatikan. Bot akan jawab secepat runtime siap.')
        return
      }

      const seconds = Number(value)
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 30) {
        await reply('Delay harus angka 0 sampai 30 detik.')
        return
      }

      await settingsService.updateSettings(
        {
          replyTiming: {
            enabled: true,
            delaySeconds: seconds,
          },
        },
        actor,
      )
      await reply(`Delay balasan bot diatur ke ${Math.round(seconds)} detik.`)
      return
    }

    if (key === 'improve') {
      const enabled = parseToggle(value)
      if (enabled === null) {
        await reply(`Format improve: ${config.prefix}set improve on atau ${config.prefix}set improve off`)
        return
      }

      await settingsService.updateSettings(
        {
          improvement: {
            enabled,
          },
        },
        actor,
      )
      await reply(`Mode improve sekarang ${enabled ? 'aktif ✅' : 'mati ❌'}.`)
      return
    }

    if (!value) {
      await reply(`Teks welcome wajib diisi. Contoh: ${config.prefix}set welcome Halo semuanya.`)
      return
    }

    await settingsService.updateSetting('welcomeMessage', value, actor)
    await settingsService.setTemplate('welcome', value, actor)
    await reply('Welcome message berhasil diperbarui dari database settings.')
  },
}
