import { cleanNumber, isOwner } from '../lib/message-utils.js'
import { getSenderJid } from '../lib/group-utils.js'

function normalizeTarget(input) {
  const digits = cleanNumber(input)
  return digits ? `${digits}@s.whatsapp.net` : ''
}

export default {
  name: 'premium',
  aliases: ['vip'],
  category: 'utilitas',
  description: 'Cek status premium atau kelola user premium untuk owner.',
  async execute({ args, config, message, reply, userStore }) {
    const sender = getSenderJid(message)
    const owner = isOwner(sender, config) || Boolean(message?.key?.fromMe)
    const action = String(args[0] || '').toLowerCase()

    if (!action) {
      const user = userStore.get(sender)
      await reply(
        [
          '╭━〔 ⭐ STATUS PREMIUM 〕━⬣',
          `┃ Nomor: +${String(sender).split('@')[0]}`,
          `┃ Premium: ${user.premium ? 'aktif ✅' : 'belum ❌'}`,
          `┃ Level: ${user.level}`,
          `┃ XP: ${user.xp}`,
          '╰━━━━━━━━━━━━━━━━⬣',
        ].join('\n'),
      )
      return
    }

    if (!owner) {
      await reply('⚠️ Kelola premium hanya bisa dipakai owner.')
      return
    }

    if (action === 'list') {
      const premiumUsers = userStore.listPremium()
      if (!premiumUsers.length) {
        await reply('⭐ Belum ada user premium.')
        return
      }

      const lines = premiumUsers.map(
        (user, index) => `${index + 1}. +${String(user.jid).split('@')[0]} • Lv ${user.level}`,
      )
      await reply(['╭━〔 ⭐ DAFTAR PREMIUM 〕━⬣', ...lines, '╰━━━━━━━━━━━━━━━━⬣'].join('\n'))
      return
    }

    const target = normalizeTarget(args[1] || '')
    if (!target) {
      await reply(`⭐ Contoh: ${config.prefix}premium add 6281234567890`)
      return
    }

    if (action === 'add') {
      await userStore.setPremium(target, true)
      await reply(`⭐ User +${String(target).split('@')[0]} sekarang premium.`)
      return
    }

    if (action === 'del' || action === 'remove') {
      await userStore.setPremium(target, false)
      await reply(`🗑️ User +${String(target).split('@')[0]} dihapus dari premium.`)
      return
    }

    await reply(`⭐ Aksi tidak dikenal. Pakai: ${config.prefix}premium add|del|list`)
  },
}
