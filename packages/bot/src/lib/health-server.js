import http from 'node:http'

export function startHealthServer(config, state) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

    if (url.pathname !== '/health') {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: false, message: 'Not found' }))
      return
    }

    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({
        ok: true,
        bot: config.botName,
        mode: config.botMode,
        prefix: config.prefix,
        connection: state.connection,
        commandCount: state.commandCount,
        lastConnectedAt: state.lastConnectedAt,
        lastDisconnectReason: state.lastDisconnectReason,
        uptimeSeconds: Math.floor(process.uptime()),
      }),
    )
  })

  server.listen(config.healthPort, () => {
    console.log(`[health] http://localhost:${config.healthPort}/health`)
  })

  return server
}
