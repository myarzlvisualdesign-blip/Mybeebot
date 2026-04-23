const categoryMeta = {
  inti: { icon: '⚡', title: 'Inti' },
  media: { icon: '🎬', title: 'Media' },
  grup: { icon: '👥', title: 'Grup' },
  utilitas: { icon: '🧰', title: 'Utilitas' },
  info: { icon: '📚', title: 'Info' },
  owner: { icon: '🛡️', title: 'Owner' },
}

export default {
  name: 'help',
  aliases: ['menu'],
  category: 'inti',
  description: 'Tampilkan semua command yang aktif.',
  async execute({ args, config, registry, reply }) {
    const query = args.join(' ').trim().toLowerCase()
    const entries = registry.list()

    if (query) {
      const command = registry.get(query)
      if (command) {
        const aliases = command.aliases.length ? command.aliases.join(', ') : '-'
        const meta = categoryMeta[command.category] || { icon: '✨', title: command.category }

        await reply(
          [
            `╭━〔 ${meta.icon} DETAIL COMMAND 〕━⬣`,
            `┃ Nama: ${config.prefix}${command.name}`,
            `┃ Kategori: ${meta.title}`,
            `┃ Alias: ${aliases}`,
            `┃ Owner Only: ${command.ownerOnly ? 'Ya' : 'Tidak'}`,
            `┃ Deskripsi: ${command.description}`,
            `╰━━━━━━━━━━━━━━━━⬣`,
            `💡 Contoh: ${config.prefix}${command.name}`,
          ].join('\n'),
        )
        return
      }

      const categoryEntries = entries.filter((entry) => entry.category === query)
      if (categoryEntries.length) {
        const meta = categoryMeta[query] || { icon: '✨', title: query.toUpperCase() }
        const lines = categoryEntries.map(
          (command, index) => `${index + 1}. ${config.prefix}${command.name} - ${command.description}`,
        )

        await reply(
          [
            `╭━〔 ${meta.icon} MENU ${meta.title.toUpperCase()} 〕━⬣`,
            `┃ Total: ${categoryEntries.length} command`,
            `╰━━━━━━━━━━━━━━━━⬣`,
            '',
            ...lines,
          ].join('\n'),
        )
        return
      }
    }

    const sections = []

    for (const [category, commands] of registry.grouped()) {
      const meta = categoryMeta[category] || { icon: '✨', title: category.toUpperCase() }
      const lines = commands.map((command) => {
        const aliasText = command.aliases.length ? ` [${command.aliases.join(', ')}]` : ''
        return `┃ ${config.prefix}${command.name}${aliasText}`
      })

      sections.push(
        [
          `╭━〔 ${meta.icon} ${meta.title.toUpperCase()} 〕━⬣`,
          ...lines,
          '╰━━━━━━━━━━━━━━━━⬣',
        ].join('\n'),
      )
    }

    await reply(
      [
        `╭━〔 🐝 MENU ${config.botName.toUpperCase()} 〕━⬣`,
        `┃ Mode: ${config.botMode}`,
        `┃ Prefix: ${config.prefix}`,
        `┃ Total Command: ${registry.count()}`,
        '╰━━━━━━━━━━━━━━━━⬣',
        '',
        ...sections,
        '',
        `📌 Ketik *${config.prefix}menu media* untuk filter kategori.`,
        `📌 Ketik *${config.prefix}menu ping* untuk lihat detail command.`,
      ].join('\n'),
    )
  },
}
