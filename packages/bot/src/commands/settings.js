export default {
  name: 'settings',
  aliases: ['pengaturan'],
  category: 'admin',
  description: 'Lihat ringkasan pengaturan global bot.',
  adminOnly: true,
  async execute({ config, registry, reply, settingsService, toolRegistry }) {
    const settings = settingsService.getSettings()
    const roles = settingsService.getRoles()
    const tools = toolRegistry.list(registry)
    const enabledTools = tools.filter((tool) => tool.enabled).length
    const latestAudit = settingsService.listAuditLogs(1)[0]

    await reply(
      [
        'PENGATURAN BOT',
        `Bot: ${settings.botEnabled ? 'aktif' : 'nonaktif'}`,
        `Anti-call: ${settings.antiCall ? 'aktif' : 'nonaktif'}`,
        `Auto reply: ${settings.autoReply.enabled ? settings.autoReply.mode : 'nonaktif'}`,
        `Delay balas: ${settings.replyTiming.enabled ? `${settings.replyTiming.delaySeconds} detik` : 'otomatis'}`,
        `Improve: ${settings.improvement.enabled ? `aktif (${settings.improvement.minRepeats}x -> ${settings.improvement.suggestionLimit} saran)` : 'nonaktif'}`,
        `Jam aktif: ${settings.activeHours.enabled ? `${settings.activeHours.start}-${settings.activeHours.end} ${settings.activeHours.timezone}` : 'nonaktif'}`,
        `Prefix: ${settings.commandPrefixes.join(', ')}`,
        `Welcome: ${settings.welcomeMessage.slice(0, 80)}${settings.welcomeMessage.length > 80 ? '...' : ''}`,
        `Tools aktif: ${enabledTools}/${tools.length}`,
        `Owner: ${roles.owners.length}`,
        `Admin: ${roles.admins.length}`,
        `Audit terakhir: ${latestAudit ? `${latestAudit.action} (${latestAudit.actor?.source || 'system'})` : '-'}`,
        '',
        'Command admin:',
        `${config.prefix}settings`,
        `${config.prefix}tool on/off <nama>`,
        `${config.prefix}statusbot`,
        `${config.prefix}set welcome <teks>`,
        `${config.prefix}set delay <detik|off>`,
        `${config.prefix}set improve on|off`,
      ].join('\n'),
    )
  },
}
