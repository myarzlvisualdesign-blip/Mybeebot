export default {
  name: 'tools',
  aliases: ['toolmenu', 'fituraktif'],
  category: 'admin',
  description: 'Lihat daftar tool yang terdaftar dan statusnya.',
  adminOnly: true,
  async execute({ registry, reply, toolRegistry }) {
    const tools = toolRegistry.list(registry)
    const lines = tools.map((tool) => {
      const state = tool.enabled ? 'on' : 'off'
      const protectedMark = tool.protected ? ' locked' : ''
      return `- ${tool.name}: ${state}${protectedMark} (${tool.category})`
    })

    await reply(
      [
        'TOOL REGISTRY',
        `${tools.length} tool terdaftar.`,
        '',
        ...lines,
        '',
        'Ubah: /tool on <nama> atau /tool off <nama>',
      ].join('\n'),
    )
  },
}
