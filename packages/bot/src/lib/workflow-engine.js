function minutesFromTime(value) {
  const [hour, minute] = String(value || '00:00')
    .split(':')
    .map((part) => Number(part))

  return hour * 60 + minute
}

export function isInsideActiveHours(settings, date = new Date()) {
  const activeHours = settings.activeHours || {}
  if (!activeHours.enabled) {
    return true
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: activeHours.timezone || 'Asia/Jakarta',
  })
  const current = minutesFromTime(formatter.format(date))
  const start = minutesFromTime(activeHours.start)
  const end = minutesFromTime(activeHours.end)

  if (start <= end) {
    return current >= start && current <= end
  }

  return current >= start || current <= end
}

export function buildWorkflowTrace({ isCommand, role, mode, commandName, toolId }) {
  return {
    steps: [
      'incoming_message',
      isCommand ? 'command_mode' : 'intent_detection',
      'role_check',
      'settings_check',
      mode,
      toolId ? 'tool_execute' : 'reply_execute',
      'log_result',
      'send_response',
    ],
    mode,
    role,
    commandName: commandName || null,
    toolId: toolId || null,
  }
}
