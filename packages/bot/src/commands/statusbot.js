import { formatRuntime } from '../lib/message-utils.js'

export default {
  name: 'statusbot',
  aliases: ['botstatus'],
  category: 'admin',
  description: 'Lihat status runtime, workflow, dan settings bot.',
  adminOnly: true,
  async execute({ registry, reply, settingsService, state, toolRegistry }) {
    const settings = settingsService.getSettings()
    const tools = toolRegistry.list(registry)
    const enabledTools = tools.filter((tool) => tool.enabled).length
    const failedTools = tools.reduce((total, tool) => total + Number(tool.error_count || 0), 0)
    const latestAudit = settingsService.listAuditLogs(1)[0]

    await reply(
      [
        'STATUS BOT',
        `Koneksi: ${state.connection}`,
        `Uptime: ${formatRuntime(process.uptime())}`,
        `Bot: ${settings.botEnabled ? 'aktif' : 'nonaktif'}`,
        `Anti-call: ${settings.antiCall ? 'aktif' : 'nonaktif'}`,
        `Auto reply: ${settings.autoReply.enabled ? settings.autoReply.mode : 'nonaktif'}`,
        `Delay balas: ${settings.replyTiming.enabled ? `${settings.replyTiming.delaySeconds} detik` : 'otomatis'}`,
        `Improve: ${settings.improvement.enabled ? 'aktif' : 'nonaktif'}`,
        `Jam aktif: ${settings.activeHours.enabled ? `${settings.activeHours.start}-${settings.activeHours.end}` : 'nonaktif'}`,
        `Tools: ${enabledTools}/${tools.length} aktif`,
        `Tool errors: ${failedTools}`,
        `Audit terakhir: ${latestAudit ? `${latestAudit.action} -> ${latestAudit.target}` : '-'}`,
        `Settings source: database`,
        `Workflow: incoming -> command/FAQ/template -> role -> execute -> log -> reply`,
      ].join('\n'),
    )
  },
}
