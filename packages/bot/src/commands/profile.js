import {
  getChatJid,
  getSenderJid,
  getSenderJids,
  isGroupChat,
  normalizeJid,
  toMention,
} from '../lib/group-utils.js'
import { isOwner } from '../lib/message-utils.js'
import { renderProfileCard } from '../lib/profile-card.js'

export default {
  name: 'profile',
  aliases: ['me', 'profil', 'level', 'rank'],
  category: 'utilitas',
  description: 'Tampilkan kartu profil, level, dan status user.',
  async execute({ config, message, sock, userStore }) {
    const chatJid = getChatJid(message)
    const sender = getSenderJid(message)
    const senderJids = getSenderJids(message)
    const group = isGroupChat(message)
    const owner = senderJids.some((jid) => isOwner(jid, config)) || Boolean(message?.key?.fromMe)
    const user = userStore.get(sender)
    let role = owner ? 'Owner 👑' : 'Member 👤'
    let chatName = 'Chat pribadi'

    if (group) {
      const metadata = await sock.groupMetadata(chatJid).catch(() => null)
      const participant = metadata?.participants?.find((entry) =>
        [entry.id, entry.jid, entry.lid, entry.phoneNumber].some((jid) =>
          senderJids.includes(normalizeJid(jid)),
        ),
      )
      if (participant?.admin && !owner) {
        role = 'Admin Grup 🛡️'
      }
      chatName = metadata?.subject || 'Grup WhatsApp'
    }

    const avatarUrl = await sock.profilePictureUrl(sender, 'image').catch(() => null)
    const card = await renderProfileCard({
      avatarUrl,
      botName: config.botName,
      handle: toMention(sender),
      role,
      premium: user.premium,
      level: user.level,
      xp: user.xp,
      commandCount: user.commandCount,
      messageCount: user.messageCount,
    })

    await sock.sendMessage(
      chatJid,
      {
        image: card,
        caption: [
          '╭━〔 🙋 PROFILE PENGGUNA 〕━⬣',
          `┃ Nama Tag: ${toMention(sender)}`,
          `┃ Nomor: +${String(sender).split('@')[0]}`,
          `┃ Peran: ${role}`,
          `┃ Premium: ${user.premium ? 'aktif ⭐' : 'reguler'}`,
          `┃ Tipe Chat: ${group ? 'Grup 👥' : 'Pribadi 💬'}`,
          `┃ Nama Chat: ${chatName}`,
          '╰━━━━━━━━━━━━━━━━⬣',
        ].join('\n'),
      },
      { quoted: message },
    )
  },
}
