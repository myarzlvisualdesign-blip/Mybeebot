export default {
  name: 'ownerpanel',
  aliases: ['panelowner', 'opanel'],
  category: 'owner',
  description: 'Ringkasan kontrol owner dan status bot.',
  ownerOnly: true,
  async execute({ groupSettings, registry, reply, state, systemSettings, userStore }) {
    const groups = groupSettings.list()
    const users = userStore.listUsers()
    const premiumUsers = userStore.listPremium()
    const settings = systemSettings.get()

    await reply(
      [
        '╭━〔 🛡️ OWNER PANEL 〕━⬣',
        `┃ Koneksi: ${state.connection}`,
        `┃ Bot aktif: ${settings.botEnabled ? 'aktif ✅' : 'mati ❌'}`,
        `┃ Total Command: ${registry.count()}`,
        `┃ Grup Aktif: ${groups.length}`,
        `┃ Total User: ${users.length}`,
        `┃ User Premium: ${premiumUsers.length}`,
        `┃ Anti-call: ${settings.antiCall ? 'aktif ✅' : 'mati ❌'}`,
        '╰━━━━━━━━━━━━━━━━⬣',
        '⚙️ Quick cmds: .premium list | .anticall on/off | .stats',
      ].join('\n'),
    )
  },
}
