export default {
  name: 'stats',
  aliases: ['botstats', 'statistik'],
  category: 'info',
  description: 'Tampilkan statistik runtime dan fitur bot.',
  async execute({ config, groupSettings, registry, reply, state }) {
    const groups = groupSettings.list().map(([, settings]) => settings)
    const totalGroups = groups.length
    const totals = groups.reduce(
      (accumulator, settings) => {
        if (settings.welcome) accumulator.welcome += 1
        if (settings.goodbye) accumulator.goodbye += 1
        if (settings.aiReply) accumulator.aiReply += 1
        if (settings.autoResponder) accumulator.autoResponder += 1
        if (settings.antiSpam) accumulator.antiSpam += 1
        if (settings.antiLink && settings.antiLink !== 'off') accumulator.antiLink += 1
        accumulator.autoReplies += Object.keys(settings.autoReplies || {}).length
        return accumulator
      },
      {
        welcome: 0,
        goodbye: 0,
        aiReply: 0,
        autoResponder: 0,
        antiSpam: 0,
        antiLink: 0,
        autoReplies: 0,
      },
    )

    await reply(
      [
        '╭━〔 📊 STATISTIK BOT 〕━⬣',
        `┃ Nama: ${config.botName}`,
        `┃ Mode: ${config.botMode}`,
        `┃ Prefix: ${config.prefix}`,
        `┃ Koneksi: ${state.connection}`,
        `┃ Total Command: ${registry.count()}`,
        `┃ Grup Terkonfigurasi: ${totalGroups}`,
        '╰━━━━━━━━━━━━━━━━⬣',
        '╭━〔 🧩 FITUR AKTIF 〕━⬣',
        `┃ Welcome: ${totals.welcome}`,
        `┃ Goodbye: ${totals.goodbye}`,
        `┃ Anti-link: ${totals.antiLink}`,
        `┃ Anti-spam: ${totals.antiSpam}`,
        `┃ AI Reply: ${totals.aiReply}`,
        `┃ Auto-responder: ${totals.autoResponder}`,
        `┃ Keyword Reply: ${totals.autoReplies}`,
        '╰━━━━━━━━━━━━━━━━⬣',
      ].join('\n'),
    )
  },
}
