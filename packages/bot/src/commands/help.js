export default {
  name: 'help',
  aliases: ['menu'],
  category: 'core',
  description: 'List all loaded commands.',
  async execute({ config, registry, reply }) {
    const sections = []

    for (const [category, commands] of registry.grouped()) {
      const lines = commands.map((command) => {
        const aliasText = command.aliases.length
          ? ` (aliases: ${command.aliases.join(', ')})`
          : ''
        return `${config.prefix}${command.name}${aliasText} - ${command.description}`
      })

      sections.push(`*${category.toUpperCase()}*\n${lines.join('\n')}`)
    }

    await reply(
      [`*${config.botName} command deck*`, '', ...sections].join('\n\n'),
    )
  },
}
