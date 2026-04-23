import { actorFromMessage } from '../lib/permissions.js'

export default {
  name: 'tool',
  aliases: ['fitur'],
  category: 'admin',
  description: 'Aktifkan atau matikan tool dari WhatsApp.',
  adminOnly: true,
  async execute({ args, registry, reply, role, sender, toolRegistry }) {
    const action = String(args[0] || '').toLowerCase()
    const name = String(args[1] || '').toLowerCase().replace(/^command:/, '')

    if (!['on', 'off'].includes(action) || !name) {
      await reply('Format: /tool on <nama> atau /tool off <nama>. Contoh: /tool off ytmp3')
      return
    }

    const command = registry.get(name)
    if (!command) {
      await reply(`Tool ${name} tidak ditemukan.`)
      return
    }

    const id = `command:${command.name}`
    await toolRegistry.setEnabled(id, action === 'on', actorFromMessage({ role, sender }))
    const tool = toolRegistry.get(registry, command.name)
    await reply(
      [
        `Tool ${command.name} sekarang ${tool?.enabled ? 'aktif' : 'nonaktif'}.`,
        `ID: ${id}`,
        'Sumber settings: database.',
      ].join('\n'),
    )
  },
}
