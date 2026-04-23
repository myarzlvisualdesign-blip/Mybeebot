const protectedCommands = new Set([
  'help',
  'menu',
  'settings',
  'tools',
  'tool',
  'statusbot',
  'reload',
])

const optionalByDefault = new Set(['donate'])

function commandToolId(commandName) {
  return `command:${commandName}`
}

export class ToolRegistry {
  constructor(settingsService) {
    this.settingsService = settingsService
  }

  fromCommand(command) {
    const id = commandToolId(command.name)
    const stored = this.settingsService.getToolState(id)
    const protectedTool = protectedCommands.has(command.name)
    const defaultEnabled = !optionalByDefault.has(command.name)

    return {
      id,
      name: command.name,
      description: command.description || 'Command WhatsApp aktif.',
      enabled: protectedTool ? true : stored.enabled ?? defaultEnabled,
      protected: protectedTool,
      category: command.category || 'core',
      input_schema: {
        type: 'object',
        properties: {
          args: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          text: {
            type: 'string',
          },
        },
      },
      output_schema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
          },
        },
      },
      last_used: stored.last_used || null,
      error_count: Number(stored.error_count || 0),
      aliases: command.aliases || [],
      ownerOnly: Boolean(command.ownerOnly),
      adminOnly: Boolean(command.adminOnly),
    }
  }

  list(commandRegistry) {
    return commandRegistry.list().map((command) => this.fromCommand(command))
  }

  get(commandRegistry, commandName) {
    const command = commandRegistry.list().find((entry) => entry.name === commandName)
    return command ? this.fromCommand(command) : null
  }

  isEnabled(command) {
    return this.fromCommand(command).enabled
  }

  async setEnabled(id, enabled, actor = {}) {
    const commandName = String(id || '').replace(/^command:/, '')
    if (protectedCommands.has(commandName) && !enabled) {
      throw new Error('Tool inti ini dilindungi agar dashboard dan recovery tetap bisa dipakai.')
    }

    return this.settingsService.setToolEnabled(id, enabled, actor)
  }

  async markUsed(command, success = true) {
    await this.settingsService.recordToolUsage(commandToolId(command.name), success)
  }
}

export { commandToolId }
