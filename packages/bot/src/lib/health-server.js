import http from 'node:http'

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'content-type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}

function isLocalRequest(request) {
  const host = String(request.headers.host || '')
  return host.includes('127.0.0.1') || host.includes('localhost')
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
        lastPairingRequestAt: runtime.lastPairingRequestAt,
      })
      return
    }

    if (url.pathname === '/meta') {
      writeJson(response, 200, {
        ok: true,
        bot: config.botName,
        repoUrl: config.repoUrl,
        websiteUrl: config.websiteUrl,
        healthUrl: `http://127.0.0.1:${config.healthPort}/health`,
        localPairingUrl: `http://127.0.0.1:${config.healthPort}/pairing?phone=6281234567890`,
      })
      return
    }

    if (url.pathname === '/pairing') {
      if (!isLocalRequest(request)) {
        writeJson(response, 403, {
          ok: false,
          message: 'Pairing is restricted to localhost requests.',
        })
        return
      }

      const phone = url.searchParams.get('phone') || ''
      if (!phone) {
        writeJson(response, 400, {
          ok: false,
          message: 'Missing phone query parameter.',
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
        })
      } catch (error) {
        writeJson(response, 500, {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        })
      }
      return
    }

    writeJson(response, 404, { ok: false, message: 'Not found' })
  })

  server.listen(config.healthPort, () => {
    console.log(`[health] http://localhost:${config.healthPort}/health`)
  })

  return server
}
