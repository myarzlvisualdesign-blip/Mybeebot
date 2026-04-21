import { ensureGroupAdmin } from '../lib/group-utils.js'

export default {
  name: 'listreply',
  aliases: ['daftarreply'],
  category: 'grup',
  description: 'Lihat daftar keyword auto-responder yang tersimpan.',
  async execute({ config, groupSettings, message, reply, sock }) {
    const context = await ensureGroupAdmin(sock, message, config)
    const settings = groupSettings.get(context.jid)
    const entries = Object.entries(settings.autoReplies || {})

    if (!entries.length) {
      await reply(
        `Belum ada auto-responder. Tambah dulu dengan ${config.prefix}setreply halo|Hai juga`,
      )
      return
    }

    const lines = entries.map(
      ([trigger, response], index) => `${index + 1}. ${trigger} -> ${response}`,
    )

    await reply(['*Daftar auto-responder*', '', ...lines].join('\n'))
  },
}
