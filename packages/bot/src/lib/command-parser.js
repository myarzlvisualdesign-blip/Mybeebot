function uniquePrefixes(config, settings) {
  const prefixes = [
    ...(settings?.commandPrefixes || []),
    config.prefix,
    '/',
  ]
    .map((prefix) => String(prefix || '').trim())
    .filter(Boolean)

  return [...new Set(prefixes)].sort((left, right) => right.length - left.length)
}

export function parseCommand(body, config, settings) {
  const text = String(body || '').trim()
  const prefix = uniquePrefixes(config, settings).find((entry) => text.startsWith(entry))

  if (!prefix) {
    return {
      isCommand: false,
      prefix: '',
      name: '',
      args: [],
      commandLine: '',
    }
  }

  const commandLine = text.slice(prefix.length).trim()
  if (!commandLine) {
    return {
      isCommand: true,
      prefix,
      name: '',
      args: [],
      commandLine,
    }
  }

  const [rawName, ...args] = commandLine.split(/\s+/)

  return {
    isCommand: true,
    prefix,
    name: rawName.toLowerCase(),
    args,
    commandLine,
  }
}
