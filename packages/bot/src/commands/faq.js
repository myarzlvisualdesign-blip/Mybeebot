import { actorFromMessage } from '../lib/permissions.js'

function splitPair(text) {
  const [left, ...rest] = String(text || '').split('|')
  return [left?.trim() || '', rest.join('|').trim()]
}

export default {
  name: 'faq',
  aliases: ['kb'],
  category: 'admin',
  description: 'Kelola FAQ dan knowledge base bot.',
  adminOnly: true,
  async execute({ args, reply, role, sender, settingsService }) {
    const action = String(args.shift() || 'list').toLowerCase()
    const value = args.join(' ').trim()
    const actor = actorFromMessage({ role, sender })

    if (action === 'add') {
      const [question, answer] = splitPair(value)
      const faq = await settingsService.addFaq(question, answer, actor)
      await reply(`FAQ ditambahkan dengan id ${faq.id}.`)
      return
    }

    if (action === 'del' || action === 'delete' || action === 'hapus') {
      await settingsService.removeFaq(value, actor)
      await reply(`FAQ ${value} dihapus.`)
      return
    }

    const rows = settingsService.listFaq()
    await reply(
      [
        'FAQ / KNOWLEDGE BASE',
        rows.length ? rows.map((entry) => `- ${entry.id}: ${entry.question}`).join('\n') : 'Belum ada FAQ.',
        '',
        'Tambah: /faq add pertanyaan|jawaban',
        'Hapus: /faq del <id>',
      ].join('\n'),
    )
  },
}
