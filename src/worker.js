const commands = [
  ".add",
  ".admins",
  ".ai",
  ".aireply",
  ".anticall",
  ".antilink",
  ".antibadword",
  ".antispam",
  ".addbadword",
  ".autoresponder",
  ".menu",
  ".help",
  ".ping",
  ".alive",
  ".profile",
  ".stats",
  ".close",
  ".delbadword",
  ".delreply",
  ".demote",
  ".goodbye",
  ".groupconfig",
  ".owner",
  ".ownerpanel",
  ".premium",
  ".kick",
  ".linkgroup",
  ".listbadword",
  ".open",
  ".promote",
  ".repo",
  ".setreply",
  ".setdesc",
  ".setsubject",
  ".sticker",
  ".toimg",
  ".tomp3",
  ".tovn",
  ".uptime",
  ".rules",
  ".welcome",
  ".donate",
  ".id",
  ".groupinfo",
  ".tagall",
  ".hidetag",
  ".echo",
  ".ytmp3",
  ".ytmp4",
  ".listreply",
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

async function handleBotPairing(request, env) {
  if (!env.BOT_TUNNEL_URL) {
    return Response.json(
      {
        ok: false,
        message: "Bot tunnel URL is not configured.",
      },
      { status: 503 },
    );
  }

  if (request.method !== "POST") {
    return Response.json(
      {
        ok: false,
        message: "Method not allowed.",
      },
      { status: 405 },
    );
  }

  const payload = await request.json().catch(() => null);
  const phone = String(payload?.phone || "").replace(/\D/g, "");
  const adminKey = String(payload?.adminKey || "");

  if (!phone) {
    return Response.json(
      {
        ok: false,
        message: "Phone number is required.",
      },
      { status: 400 },
    );
  }

  if (!env.BOT_ADMIN_KEY || adminKey !== env.BOT_ADMIN_KEY) {
    return Response.json(
      {
        ok: false,
        message: "Invalid admin key.",
      },
      { status: 403 },
    );
  }

  const upstream = new URL(`/pairing?phone=${encodeURIComponent(phone)}`, env.BOT_TUNNEL_URL.endsWith("/") ? env.BOT_TUNNEL_URL : `${env.BOT_TUNNEL_URL}/`);
  const response = await fetch(upstream.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-bot-admin-key": env.BOT_PAIRING_PROXY_KEY || "",
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

async function handleBotReset(request, env) {
  if (!env.BOT_TUNNEL_URL) {
    return Response.json(
      {
        ok: false,
        message: "Bot tunnel URL is not configured.",
      },
      { status: 503 },
    );
  }

  if (request.method !== "POST") {
    return Response.json(
      {
        ok: false,
        message: "Method not allowed.",
      },
      { status: 405 },
    );
  }

  const payload = await request.json().catch(() => null);
  const adminKey = String(payload?.adminKey || "");

  if (!env.BOT_ADMIN_KEY || adminKey !== env.BOT_ADMIN_KEY) {
    return Response.json(
      {
        ok: false,
        message: "Invalid admin key.",
      },
      { status: 403 },
    );
  }

  const upstream = new URL("/session/reset", env.BOT_TUNNEL_URL.endsWith("/") ? env.BOT_TUNNEL_URL : `${env.BOT_TUNNEL_URL}/`);
  const response = await fetch(upstream.toString(), {
    method: "POST",
    headers: {
      accept: "application/json",
      "x-bot-admin-key": env.BOT_PAIRING_PROXY_KEY || "",
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

async function handleBotQr(request, env) {
  if (!env.BOT_TUNNEL_URL) {
    return Response.json(
      {
        ok: false,
        message: "Bot tunnel URL is not configured.",
      },
      { status: 503 },
    );
  }

  if (request.method !== "POST") {
    return Response.json(
      {
        ok: false,
        message: "Method not allowed.",
      },
      { status: 405 },
    );
  }

  const payload = await request.json().catch(() => null);
  const adminKey = String(payload?.adminKey || "");

  if (!env.BOT_ADMIN_KEY || adminKey !== env.BOT_ADMIN_KEY) {
    return Response.json(
      {
        ok: false,
        message: "Invalid admin key.",
      },
      { status: 403 },
    );
  }

  const upstream = new URL("/qr", env.BOT_TUNNEL_URL.endsWith("/") ? env.BOT_TUNNEL_URL : `${env.BOT_TUNNEL_URL}/`);
  const response = await fetch(upstream.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-bot-admin-key": env.BOT_PAIRING_PROXY_KEY || "",
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
        note: "Deploy edge live ini menampung website publik dan API status. Runtime WhatsApp tetap jalan di paket bot Node.js.",
      });
    }

    if (url.pathname === "/api/bot-health") {
      return proxyBotRequest(request, env, "/health");
    }

    if (url.pathname === "/api/bot-meta") {
      return proxyBotRequest(request, env, "/meta");
    }

    if (url.pathname === "/api/bot-pairing") {
      return handleBotPairing(request, env);
    }

    if (url.pathname === "/api/bot-reset") {
      return handleBotReset(request, env);
    }

    if (url.pathname === "/api/bot-qr") {
      return handleBotQr(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
