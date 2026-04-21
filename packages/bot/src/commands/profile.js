import { getChatJid, getSenderJid, isGroupChat, toMention } from '../lib/group-utils.js'
import { isOwner } from '../lib/message-utils.js'

export default {
  name: 'profile',
  aliases: ['me', 'profil'],
  category: 'utilitas',
  description: 'Tampilkan profil singkat pengirim dan konteks chat.',
  async execute({ config, message, reply, sock }) {
    const chatJid = getChatJid(message)
    const sender = getSenderJid(message)
    const group = isGroupChat(message)
    const owner = isOwner(sender, config) || Boolean(message?.key?.fromMe)
    let role = owner ? 'Owner 👑' : 'Member 👤'
    let chatName = 'Chat pribadi'

    if (group) {
      const metadata = await sock.groupMetadata(chatJid).catch(() => null)
      const participant = metadata?.participants?.find((entry) => entry.id === sender)
      if (participant?.admin && !owner) {
        role = 'Admin Grup 🛡️'
      }
      chatName = metadata?.subject || 'Grup WhatsApp'
    }

    await reply(
      [
        '╭━〔 🙋 PROFILE PENGGUNA 〕━⬣',
        `┃ Nama Tag: ${toMention(sender)}`,
        `┃ Nomor: +${String(sender).split('@')[0]}`,
        `┃ Peran: ${role}`,
        `┃ Tipe Chat: ${group ? 'Grup 👥' : 'Pribadi 💬'}`,
        `┃ Nama Chat: ${chatName}`,
        '╰━━━━━━━━━━━━━━━━⬣',
      ].join('\n'),
    )
  },
}
