import { actorFromMessage } from '../lib/permissions.js'

function splitPair(text) {
  const [left, ...rest] = String(text || '').split('|')
  return [left?.trim() || '', rest.join('|').trim()]
}

export default {
  name: 'template',
  aliases: ['tpl'],
  category: 'admin',
  description: 'Kelola template pesan global.',
  adminOnly: true,
  async execute({ args, reply, role, sender, settingsService }) {
    const action = String(args.shift() || 'list').toLowerCase()
    const value = args.join(' ').trim()
    const actor = actorFromMessage({ role, sender })

    if (action === 'add' || action === 'set') {
      const [name, body] = splitPair(value)
      const template = await settingsService.setTemplate(name, body, actor)
      await reply(`Template ${template.name} disimpan.`)
      return
    }

    if (action === 'del' || action === 'delete' || action === 'hapus') {
      await settingsService.removeTemplate(value, actor)
      await reply(`Template ${value} dihapus.`)
      return
    }

    const templates = settingsService.listTemplates()
    const rows = Object.values(templates).map((template) => `- ${template.name}: ${template.body.slice(0, 70)}`)
    await reply(
      [
        'TEMPLATE PESAN',
        rows.length ? rows.join('\n') : 'Belum ada template.',
        '',
        'Tambah: /template add nama|isi',
        'Hapus: /template del <nama>',
      ].join('\n'),
    )
  },
}
