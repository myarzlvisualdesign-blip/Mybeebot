const commands = [
  ".menu",
  ".help",
  ".ping",
  ".alive",
  ".repo",
  ".echo",
  ".reload"
];

const repoUrl = "https://github.com/myarzlvisualdesign-blip/Mybeebot";
const upstreamUrl = "https://github.com/athmanmussah-sketch/wa-base-bot";

async function proxyBotRequest(request, env, targetPath) {
  if (!env.BOT_TUNNEL_URL) {
    return Response.json(
      {
        ok: false,
        message: "Bot tunnel URL is not configured.",
      },
      { status: 503 },
    );
  }

  const upstream = new URL(targetPath, env.BOT_TUNNEL_URL.endsWith("/") ? env.BOT_TUNNEL_URL : `${env.BOT_TUNNEL_URL}/`);
  const response = await fetch(upstream.toString(), {
    method: request.method,
    headers: {
      accept: "application/json",
    },
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/status") {
      return Response.json({
        name: "Mybeebot",
        status: "live",
        domain: url.host,
        runtime: "Cloudflare Workers Static Assets",
        edgeServedAt: new Date().toISOString(),
        commands,
      });
    }

    if (url.pathname === "/api/meta") {
      return Response.json({
        name: "Mybeebot",
        repoUrl,
        upstreamUrl,
        deployment: "cloudflare",
        botHealthProxy: `${url.origin}/api/bot-health`,
        botMetaProxy: `${url.origin}/api/bot-meta`,
        botTunnelConfigured: Boolean(env.BOT_TUNNEL_URL),
        note: "The live edge deploy hosts the public companion site and status APIs. The WhatsApp socket runtime stays in the Node.js bot package.",
      });
    }

    if (url.pathname === "/api/bot-health") {
      return proxyBotRequest(request, env, "/health");
    }

    if (url.pathname === "/api/bot-meta") {
      return proxyBotRequest(request, env, "/meta");
    }

    return env.ASSETS.fetch(request);
  },
};
