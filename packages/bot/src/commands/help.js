export default {
  name: 'help',
  aliases: ['menu'],
  category: 'inti',
  description: 'Tampilkan semua command yang aktif.',
  async execute({ config, registry, reply }) {
    const sections = []

    for (const [category, commands] of registry.grouped()) {
      const lines = commands.map((command) => {
        const aliasText = command.aliases.length
          ? ` (alias: ${command.aliases.join(', ')})`
          : ''
        return `${config.prefix}${command.name}${aliasText} - ${command.description}`
      })

      sections.push(`*${category.toUpperCase()}*\n${lines.join('\n')}`)
    }

    await reply([`*Menu ${config.botName}*`, '', ...sections].join('\n\n'))
  },
}
