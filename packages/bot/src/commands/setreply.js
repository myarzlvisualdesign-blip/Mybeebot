import { ensureGroupAdmin } from '../lib/group-utils.js'

function parsePair(raw) {
  const divider = raw.includes('|') ? '|' : raw.includes('=') ? '=' : null
  if (!divider) {
    return null
  }

  const index = raw.indexOf(divider)
  const trigger = raw.slice(0, index).trim().toLowerCase()
  const response = raw.slice(index + 1).trim()

  if (!trigger || !response) {
    return null
  }

  return { trigger, response }
}

export default {
  name: 'setreply',
  aliases: ['setrespon'],
  category: 'grup',
  description: 'Simpan balasan otomatis dengan format keyword|balasan.',
  async execute({ body, config, groupSettings, message, reply, sock }) {
    const raw = body.replace(new RegExp(`^\\${config.prefix}\\S+\\s*`), '').trim()
    const parsed = parsePair(raw)

    if (!parsed) {
      await reply(
        `💬 Contoh: ${config.prefix}setreply halo|Halo juga, ada yang bisa dibantu?`,
      )
      return
    }

    const context = await ensureGroupAdmin(sock, message, config)
    await groupSettings.setAutoReply(context.jid, parsed.trigger, parsed.response)
    await reply(`💬 Auto-responder disimpan untuk keyword *${parsed.trigger}*.`)
  },
}
