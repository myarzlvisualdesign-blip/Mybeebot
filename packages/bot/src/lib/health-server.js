import http from 'node:http'
import { resolveAssistantReply } from './assistant-reply.js'

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(payload))
}

async function readJsonBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) {
    return {}
  }

  return JSON.parse(raw)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isLocalRequest(request) {
  const host = String(request.headers.host || '')
  return host.includes('127.0.0.1') || host.includes('localhost')
}

function allowedLoopbackOrigins(config) {
  return new Set([
    `http://127.0.0.1:${config.healthPort}`,
    `http://localhost:${config.healthPort}`,
  ])
}

function isTrustedLoopbackRequest(request, config) {
  if (!isLocalRequest(request)) {
    return false
  }

  const origin = String(request.headers.origin || '')
  const fetchSite = String(request.headers['sec-fetch-site'] || '').toLowerCase()
  const allowedOrigins = allowedLoopbackOrigins(config)

  if (origin && !allowedOrigins.has(origin)) {
    return false
  }

  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    return false
  }

  return true
}

function isAuthorizedRemotePairing(request, config) {
  const providedKey = String(request.headers['x-bot-admin-key'] || '')
  return Boolean(config.pairingProxyKey) && providedKey === config.pairingProxyKey
}

function canAccessAdminSurface(request, config) {
  return isTrustedLoopbackRequest(request, config) || isAuthorizedRemotePairing(request, config)
}

function buildDiagnostics(state, runtime, actions) {
  const commands = actions.getCommands ? actions.getCommands() : []
  const registeredTools = actions.getTools ? actions.getTools() : []
  const settings = actions.getSystemSettings ? actions.getSystemSettings() : {
    antiCall: true,
    botEnabled: true,
  }
  const categories = new Map()

  for (const command of commands) {
    const category = command.category || 'core'
    categories.set(category, (categories.get(category) || 0) + 1)
  }

  const botEnabled = settings.botEnabled !== false
  const qrAvailable = Boolean(runtime.latestQr)
  const registered = Boolean(runtime.registered)
  const socketOpen = state.connection === 'open'
  const commandTotal = commands.length
  const ownerOnly = commands.filter((command) => command.ownerOnly).length

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    runtime: {
      connection: state.connection,
      registered,
      botEnabled,
      uptimeSeconds: Math.floor(process.uptime()),
      qrAvailable,
      lastDisconnectReason: state.lastDisconnectReason,
    },
    commands: {
      total: commandTotal,
      public: commandTotal - ownerOnly,
      ownerOnly,
      aliases: commands.reduce((total, command) => total + (command.aliases?.length || 0), 0),
      categories: Array.from(categories.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((left, right) => left.category.localeCompare(right.category)),
    },
    tools: [
      {
        key: 'pairing-code',
        label: 'Kode pairing',
        method: 'POST',
        endpoint: '/api/bot-pairing',
        available: !registered,
        detail: registered ? 'Device sudah tertaut.' : 'Siap membuat kode pairing dari dashboard.',
      },
      {
        key: 'qr-scan',
        label: 'QR desktop',
        method: 'POST',
        endpoint: '/api/bot-qr',
        available: qrAvailable && !registered,
        detail: qrAvailable ? 'QR tersedia untuk scan desktop.' : 'QR belum tersedia dari socket.',
      },
      {
        key: 'session-reset',
        label: 'Reset sesi',
        method: 'POST',
        endpoint: '/api/bot-reset',
        available: true,
        detail: 'Hapus sesi lokal dan restart bot untuk pairing ulang.',
      },
      {
        key: 'device-logout',
        label: 'Logout device',
        method: 'POST',
        endpoint: '/api/bot-logout-device',
        available: registered,
        detail: registered
          ? 'Device bisa di-logout dari dashboard.'
          : 'Standby sampai device tertaut.',
      },
      {
        key: 'bot-toggle',
        label: 'Enable/disable bot',
        method: 'POST',
        endpoint: botEnabled ? '/api/bot-disable' : '/api/bot-enable',
        available: true,
        detail: botEnabled ? 'Bot aktif dan bisa dinonaktifkan.' : 'Bot standby dan bisa diaktifkan.',
      },
      {
        key: 'command-map',
        label: 'Command map',
        method: 'GET',
        endpoint: '/api/bot-meta',
        available: commandTotal > 0,
        detail: `${commandTotal} command aktif di registry.`,
      },
      ...registeredTools.map((tool) => ({
        key: tool.id,
        label: tool.name,
        method: 'COMMAND',
        endpoint: `/${tool.name}`,
        available: tool.enabled,
        detail: tool.description,
        category: tool.category,
        last_used: tool.last_used,
        error_count: tool.error_count,
      })),
    ],
    checks: [
      {
        key: 'socket-open',
        label: 'Socket WhatsApp',
        ok: socketOpen,
        detail: socketOpen
          ? 'Socket sudah open dan siap menerima pesan.'
          : `Socket saat ini ${state.connection}.`,
        severity: socketOpen ? 'success' : 'warning',
      },
      {
        key: 'device-registered',
        label: 'Device tertaut',
        ok: registered,
        detail: registered ? 'Sesi WhatsApp sudah registered.' : 'Butuh pairing kode atau QR.',
        severity: registered ? 'success' : 'warning',
      },
      {
        key: 'bot-enabled',
        label: 'Bot enabled',
        ok: botEnabled,
        detail: botEnabled ? 'Bot akan merespons pesan.' : 'Bot sengaja dinonaktifkan.',
        severity: botEnabled ? 'success' : 'warning',
      },
      {
        key: 'command-registry',
        label: 'Command registry',
        ok: commandTotal >= 40,
        detail: `${commandTotal} command dimuat dari runtime.`,
        severity: commandTotal >= 40 ? 'success' : 'error',
      },
      {
        key: 'qr-fallback',
        label: 'QR fallback',
        ok: registered || qrAvailable,
        detail: registered
          ? 'QR tidak dibutuhkan karena device sudah tertaut.'
          : qrAvailable
            ? 'QR fallback tersedia.'
            : 'QR belum tersedia.',
        severity: registered || qrAvailable ? 'success' : 'warning',
      },
      {
        key: 'anti-call',
        label: 'Anti-call',
        ok: settings.antiCall !== false,
        detail: settings.antiCall !== false ? 'Proteksi panggilan aktif.' : 'Proteksi panggilan nonaktif.',
        severity: settings.antiCall !== false ? 'success' : 'info',
      },
    ],
    system: {
      node: process.version,
      platform: process.platform,
      memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  }
}

function redactSettings(settings) {
  return {
    ...settings,
    integrations: {
      ...settings.integrations,
      webhook: {
        ...settings.integrations?.webhook,
        secret: settings.integrations?.webhook?.secret ? 'configured' : '',
      },
    },
  }
}

async function handleAdminRequest(request, response, url, config, actions) {
  if (!canAccessAdminSurface(request, config)) {
    writeJson(response, 403, {
      ok: false,
      message: 'Admin API hanya bisa diakses dari localhost atau proxy dashboard yang sah.',
    })
    return
  }

  const service = actions.settingsService
  const toolRegistry = actions.toolRegistry
  const commandRegistry = actions.registry
  const actor = {
    jid: 'dashboard',
    role: 'admin',
    source: 'dashboard',
  }
  const segments = url.pathname.split('/').filter(Boolean)
  const resource = segments[1] || ''
  const id = decodeURIComponent(segments.slice(2).join('/'))

  try {
    if (resource === 'snapshot' && request.method === 'GET') {
      writeJson(response, 200, {
        ok: true,
        settings: redactSettings(service.getSettings()),
        roles: service.getRoles(),
        tools: toolRegistry.list(commandRegistry),
        faq: service.listFaq(),
        improvementSuggestions: service.listImprovementSuggestions(),
        templates: service.listTemplates(),
        workflows: service.listWorkflows(),
        auditLogs: service.listAuditLogs(50),
        messageLogs: service.listMessageLogs(50),
      })
      return
    }

    if (resource === 'settings') {
      if (request.method === 'GET') {
        writeJson(response, 200, {
          ok: true,
          settings: redactSettings(service.getSettings()),
        })
        return
      }

      if (request.method === 'PUT' || request.method === 'PATCH') {
        const payload = await readJsonBody(request)
        const settings = await service.updateSettings(payload.settings || payload, actor)
        writeJson(response, 200, {
          ok: true,
          settings: redactSettings(settings),
        })
        return
      }
    }

    if (resource === 'tools') {
      if (request.method === 'GET') {
        writeJson(response, 200, {
          ok: true,
          tools: toolRegistry.list(commandRegistry),
        })
        return
      }

      if (request.method === 'PATCH' && id) {
        const payload = await readJsonBody(request)
        await toolRegistry.setEnabled(id, Boolean(payload.enabled), actor)
        writeJson(response, 200, {
          ok: true,
          tools: toolRegistry.list(commandRegistry),
        })
        return
      }
    }

    if (resource === 'faq') {
      if (request.method === 'GET') {
        writeJson(response, 200, {
          ok: true,
          faq: service.listFaq(),
        })
        return
      }

      if (request.method === 'POST') {
        const payload = await readJsonBody(request)
        const faq = await service.addFaq(payload.question, payload.answer, actor)
        writeJson(response, 200, {
          ok: true,
          faq,
          items: service.listFaq(),
        })
        return
      }

      if ((request.method === 'PUT' || request.method === 'PATCH') && id) {
        const payload = await readJsonBody(request)
        const faq = await service.updateFaq(id, payload.question, payload.answer, actor)
        writeJson(response, 200, {
          ok: true,
          faq,
          items: service.listFaq(),
        })
        return
      }

      if (request.method === 'DELETE' && id) {
        writeJson(response, 200, {
          ok: true,
          faq: await service.removeFaq(id, actor),
        })
        return
      }
    }

    if (resource === 'templates') {
      if (request.method === 'GET') {
        writeJson(response, 200, {
          ok: true,
          templates: service.listTemplates(),
        })
        return
      }

      if (request.method === 'POST') {
        const payload = await readJsonBody(request)
        const template = await service.setTemplate(payload.name, payload.body, actor)
        writeJson(response, 200, {
          ok: true,
          template,
          templates: service.listTemplates(),
        })
        return
      }

      if (request.method === 'DELETE' && id) {
        writeJson(response, 200, {
          ok: true,
          templates: await service.removeTemplate(id, actor),
        })
        return
      }
    }

    if (resource === 'roles') {
      if (request.method === 'GET') {
        writeJson(response, 200, {
          ok: true,
          roles: service.getRoles(),
        })
        return
      }

      if (request.method === 'POST') {
        const payload = await readJsonBody(request)
        const role = payload.role === 'owners' ? 'owners' : 'admins'
        const roles = await service.addRole(role, payload.number, actor)
        writeJson(response, 200, {
          ok: true,
          roles,
        })
        return
      }

      if (request.method === 'DELETE') {
        const payload = await readJsonBody(request)
        const role = payload.role === 'owners' ? 'owners' : 'admins'
        const roles = await service.removeRole(role, payload.number, actor)
        writeJson(response, 200, {
          ok: true,
          roles,
        })
        return
      }
    }

    if (resource === 'logs' && request.method === 'GET') {
      writeJson(response, 200, {
        ok: true,
        logs: service.listMessageLogs(Number(url.searchParams.get('limit') || 100)),
      })
      return
    }

    if (resource === 'audit' && request.method === 'GET') {
      writeJson(response, 200, {
        ok: true,
        auditLogs: service.listAuditLogs(Number(url.searchParams.get('limit') || 100)),
      })
      return
    }

    if (resource === 'workflows' && request.method === 'GET') {
      writeJson(response, 200, {
        ok: true,
        workflows: service.listWorkflows(),
      })
      return
    }

    if (resource === 'integrations') {
      if (request.method === 'GET') {
        writeJson(response, 200, {
          ok: true,
          integrations: redactSettings(service.getSettings()).integrations,
        })
        return
      }

      if (request.method === 'PATCH') {
        const payload = await readJsonBody(request)
        const settings = await service.updateSettings(
          {
            integrations: payload.integrations || payload,
          },
          actor,
        )
        writeJson(response, 200, {
          ok: true,
          integrations: redactSettings(settings).integrations,
        })
        return
      }
    }

    if (resource === 'test-reply' && request.method === 'POST') {
      const payload = await readJsonBody(request)
      const message = String(payload.message || '')
      const result = await resolveAssistantReply({
        settingsService: service,
        prompt: message,
      })
      writeJson(response, 200, {
        ok: true,
        mode: result.mode,
        reply: result.text,
        matchedFaq: result.matchedFaq || null,
        warning: result.warning || null,
      })
      return
    }

    writeJson(response, 404, {
      ok: false,
      message: 'Admin endpoint tidak ditemukan.',
    })
  } catch (error) {
    writeJson(response, 500, {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

export function startHealthServer(config, state, runtime, actions) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

    if (request.method === 'OPTIONS') {
      writeJson(response, 204, {})
      return
    }

    if (url.pathname === '/health') {
      writeJson(response, 200, {
        ok: true,
        bot: config.botName,
        mode: config.botMode,
        prefix: config.prefix,
        connection: state.connection,
        commandCount: state.commandCount,
        lastConnectedAt: state.lastConnectedAt,
        lastDisconnectReason: state.lastDisconnectReason,
        uptimeSeconds: Math.floor(process.uptime()),
        registered: runtime.registered,
        botEnabled: actions.getSystemSettings ? actions.getSystemSettings().botEnabled : true,
        lastPairingRequestAt: runtime.lastPairingRequestAt,
        qrAvailable: Boolean(runtime.latestQr),
        lastQrAt: runtime.latestQrAt,
      })
      return
    }

    if (url.pathname === '/meta') {
      const adminSurface = canAccessAdminSurface(request, config)
      writeJson(response, 200, {
        ok: true,
        bot: config.botName,
        repoUrl: config.repoUrl,
        websiteUrl: config.websiteUrl,
        commands: actions.getCommands ? actions.getCommands() : [],
        ...(adminSurface
          ? {
              healthUrl: `http://127.0.0.1:${config.healthPort}/health`,
              localPairingUrl: `http://127.0.0.1:${config.healthPort}/pairing?phone=6281234567890`,
            }
          : {}),
      })
      return
    }

    if (url.pathname === '/diagnostics') {
      if (!canAccessAdminSurface(request, config)) {
        writeJson(response, 403, {
          ok: false,
          message: 'Diagnostics hanya bisa diakses dari localhost atau permintaan admin yang sah.',
        })
        return
      }

      writeJson(response, 200, buildDiagnostics(state, runtime, actions))
      return
    }

    if (url.pathname.startsWith('/admin/')) {
      await handleAdminRequest(request, response, url, config, actions)
      return
    }

    if (url.pathname === '/pairing') {
      if (!canAccessAdminSurface(request, config)) {
        writeJson(response, 403, {
          ok: false,
          message: 'Pairing hanya bisa diakses dari localhost atau permintaan admin yang sah.',
        })
        return
      }

      const phone = url.searchParams.get('phone') || ''
      if (!phone) {
        writeJson(response, 400, {
          ok: false,
          message: 'Parameter query phone wajib diisi.',
        })
        return
      }

      try {
        const code = await actions.requestPairingCode(phone)
        writeJson(response, 200, {
          ok: true,
          phone,
          code,
          requestedAt: runtime.lastPairingRequestAt,
          remote: !isLocalRequest(request),
        })
      } catch (error) {
        writeJson(response, 500, {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        })
      }
      return
    }

    if (url.pathname === '/qr') {
      if (!canAccessAdminSurface(request, config)) {
        writeJson(response, 403, {
          ok: false,
          message: 'QR access is restricted to localhost requests.',
        })
        return
      }

      const waitMs = Math.min(Number(url.searchParams.get('wait') || 7000), 12000)
      const startedAt = Date.now()
      while (!runtime.latestQr && !runtime.registered && Date.now() - startedAt < waitMs) {
        await sleep(500)
      }

      writeJson(response, 200, {
        ok: true,
        registered: runtime.registered,
        connection: state.connection,
        qr: runtime.latestQr,
        generatedAt: runtime.latestQrAt,
        message: runtime.registered
          ? 'Device sudah tertaut. QR tidak dibutuhkan.'
          : runtime.latestQr
            ? 'QR siap dipindai.'
            : 'QR belum tersedia. Socket masih menyiapkan QR, coba lagi sebentar.',
      })
      return
    }

    if (url.pathname === '/session/reset') {
      if (!canAccessAdminSurface(request, config)) {
        writeJson(response, 403, {
          ok: false,
          message: 'Reset hanya bisa diakses dari localhost atau permintaan admin yang sah.',
        })
        return
      }

      if (request.method !== 'POST') {
        writeJson(response, 405, {
          ok: false,
          message: 'Method tidak diizinkan.',
        })
        return
      }

      try {
        const result = await actions.resetSession()
        writeJson(response, 200, {
          ok: true,
          ...result,
        })
      } catch (error) {
        writeJson(response, 500, {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        })
      }
      return
    }

    if (url.pathname === '/session/logout') {
      if (!canAccessAdminSurface(request, config)) {
        writeJson(response, 403, {
          ok: false,
          message: 'Logout device hanya bisa diakses dari localhost atau permintaan admin yang sah.',
        })
        return
      }

      if (request.method !== 'POST') {
        writeJson(response, 405, {
          ok: false,
          message: 'Method tidak diizinkan.',
        })
        return
      }

      try {
        const result = await actions.logoutDevice()
        writeJson(response, 200, {
          ok: true,
          ...result,
        })
      } catch (error) {
        writeJson(response, 500, {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        })
      }
      return
    }

    if (url.pathname === '/bot/enable' || url.pathname === '/bot/disable') {
      if (!canAccessAdminSurface(request, config)) {
        writeJson(response, 403, {
          ok: false,
          message: 'Kontrol bot hanya bisa diakses dari localhost atau permintaan admin yang sah.',
        })
        return
      }

      if (request.method !== 'POST') {
        writeJson(response, 405, {
          ok: false,
          message: 'Method tidak diizinkan.',
        })
        return
      }

      try {
        const enabled = url.pathname === '/bot/enable'
        const result = await actions.setBotEnabled(enabled)
        writeJson(response, 200, {
          ok: true,
          ...result,
        })
      } catch (error) {
        writeJson(response, 500, {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        })
      }
      return
    }

    writeJson(response, 404, { ok: false, message: 'Endpoint tidak ditemukan.' })
  })

  server.listen(config.healthPort, () => {
    console.log(`[health] http://localhost:${config.healthPort}/health`)
  })

  return server
}
