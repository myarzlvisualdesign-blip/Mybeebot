const commands = [
  ".add",
  ".addadmin",
  ".admins",
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
  ".deladmin",
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
  ".faq",
  ".settings",
  ".set",
  ".statusbot",
  ".template",
  ".tool",
  ".tools",
  ".ytmp3",
  ".ytmp4",
  ".listreply",
  ".reload"
];

const repoUrl = "https://github.com/myarzlvisualdesign-blip/Mybeebot";
const upstreamUrl = "https://github.com/athmanmussah-sketch/wa-base-bot";
const authCookieName = "mybeebot_session";
const authMaxAgeSeconds = 60 * 60 * 12;
const publicApiPaths = new Set([
  "/api/status",
  "/api/meta",
  "/api/bot-health",
  "/api/bot-meta",
]);
const baseSecurityHeaders = {
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function jsonResponse(payload, status = 200, headers = {}) {
  return Response.json(payload, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      ...baseSecurityHeaders,
      ...headers,
    },
  });
}

function botTunnelBaseUrl(env) {
  return env.BOT_TUNNEL_URL.endsWith("/") ? env.BOT_TUNNEL_URL : `${env.BOT_TUNNEL_URL}/`;
}

function buildUpstreamError(targetPath, error) {
  const detail = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    message: `Bot runtime tidak bisa dijangkau untuk ${targetPath}. ${detail}`,
  };
}

async function fetchUpstreamText(env, targetPath, init = {}) {
  if (!env.BOT_TUNNEL_URL) {
    return {
      ok: false,
      status: 503,
      payload: {
        ok: false,
        message: "Bot tunnel URL is not configured.",
      },
    };
  }

  const upstream = new URL(targetPath, botTunnelBaseUrl(env));

  try {
    const response = await fetch(upstream.toString(), init);
    const body = await response.text();
    return {
      ok: true,
      response,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      payload: buildUpstreamError(targetPath, error),
    };
  }
}

function responseFromUpstream(result) {
  if (!result.ok) {
    return jsonResponse(result.payload, result.status);
  }

  return new Response(result.body, {
    status: result.response.status,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      "content-type": result.response.headers.get("content-type") || "application/json",
      ...baseSecurityHeaders,
    },
  });
}

function withSecurityHeaders(response, extraHeaders = {}) {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(baseSecurityHeaders)) {
    headers.set(key, value);
  }

  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const parts = cookie.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = parts.find((part) => part.startsWith(prefix));

  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

function safeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function base64UrlEncode(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signSession(secret, issuedAt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${issuedAt}.mybeebot-dashboard`),
  );

  return `${issuedAt}.${base64UrlEncode(signature)}`;
}

function buildAuthCookie(request, token, maxAge = authMaxAgeSeconds) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${authCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

async function getAuthSession(request, env) {
  if (!env.BOT_ADMIN_KEY) {
    return {
      authenticated: false,
      configured: false,
    };
  }

  const token = getCookie(request, authCookieName);
  const [issuedAtRaw, signature] = token.split(".");
  const issuedAt = Number(issuedAtRaw);

  if (!token || !issuedAtRaw || !signature || Number.isNaN(issuedAt)) {
    return {
      authenticated: false,
      configured: true,
    };
  }

  const now = Date.now();
  const ageSeconds = Math.floor((now - issuedAt) / 1000);

  if (ageSeconds < 0 || ageSeconds > authMaxAgeSeconds) {
    return {
      authenticated: false,
      configured: true,
    };
  }

  const expected = await signSession(env.BOT_ADMIN_KEY, issuedAtRaw);
  const expectedSignature = expected.split(".")[1];

  if (!safeEqual(signature, expectedSignature)) {
    return {
      authenticated: false,
      configured: true,
    };
  }

  return {
    authenticated: true,
    configured: true,
    expiresAt: new Date(issuedAt + authMaxAgeSeconds * 1000).toISOString(),
  };
}

async function requireAuthenticated(request, env) {
  const session = await getAuthSession(request, env);

  if (!session.configured) {
    return Response.json(
      {
        ok: false,
        message: "Dashboard admin key is not configured.",
      },
      { status: 503 },
    );
  }

  if (!session.authenticated) {
    return Response.json(
      {
        ok: false,
        message: "Login required.",
      },
      { status: 401 },
    );
  }

  return null;
}

async function handleAuthRequest(request, env, url) {
  if (url.pathname === "/api/auth/session") {
    return Response.json(await getAuthSession(request, env));
  }

  if (url.pathname === "/api/auth/login") {
    if (request.method !== "POST") {
      return Response.json(
        {
          ok: false,
          message: "Method not allowed.",
        },
        { status: 405 },
      );
    }

    if (!env.BOT_ADMIN_KEY) {
      return Response.json(
        {
          ok: false,
          message: "Dashboard admin key is not configured.",
        },
        { status: 503 },
      );
    }

    const payload = await request.json().catch(() => null);
    const adminKey = String(payload?.adminKey || "");

    if (!safeEqual(adminKey, env.BOT_ADMIN_KEY)) {
      return Response.json(
        {
          ok: false,
          message: "Admin key tidak valid.",
        },
        { status: 403 },
      );
    }

    const issuedAt = String(Date.now());
    const token = await signSession(env.BOT_ADMIN_KEY, issuedAt);

    return Response.json(
      {
        ok: true,
        authenticated: true,
        expiresAt: new Date(Number(issuedAt) + authMaxAgeSeconds * 1000).toISOString(),
      },
      {
        headers: {
          "set-cookie": buildAuthCookie(request, token),
        },
      },
    );
  }

  if (url.pathname === "/api/auth/logout") {
    if (request.method !== "POST") {
      return Response.json(
        {
          ok: false,
          message: "Method not allowed.",
        },
        { status: 405 },
      );
    }

    return Response.json(
      {
        ok: true,
      },
      {
        headers: {
          "set-cookie": buildAuthCookie(request, "", 0),
        },
      },
    );
  }

  return Response.json(
    {
      ok: false,
      message: "Not found.",
    },
    { status: 404 },
  );
}

async function proxyBotRequest(request, env, targetPath) {
  const result = await fetchUpstreamText(env, targetPath, {
    method: request.method,
    headers: {
      accept: "application/json",
    },
  });
  return responseFromUpstream(result);
}

async function fetchBotAdminJson(env, targetPath, init = {}) {
  const result = await fetchUpstreamText(env, targetPath, {
    method: init.method || "GET",
    headers: {
      accept: "application/json",
      "x-bot-admin-key": env.BOT_PAIRING_PROXY_KEY || "",
      ...(init.headers || {}),
    },
    body: init.body,
  });

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      payload: result.payload,
    };
  }

  const text = result.body;
  let payload;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {
      ok: false,
      message: text || "Bot response is not JSON.",
    };
  }

  return {
    ok: result.response.ok,
    status: result.response.status,
    payload,
  };
}

function responseFromBotResult(result) {
  return jsonResponse(result.payload, result.status);
}

async function handlePublicBotMeta(env) {
  const result = await fetchBotAdminJson(env, "/meta");
  if (!result.ok) {
    return responseFromBotResult(result);
  }

  const payload = { ...result.payload };
  delete payload.healthUrl;
  delete payload.localPairingUrl;

  return jsonResponse(payload, result.status);
}

async function proxyAdminRequest(request, env, url) {
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.clone().text();
  const targetPath = `${url.pathname.replace(/^\/api\/admin/, "/admin")}${url.search}`;
  const result = await fetchUpstreamText(env, targetPath, {
    method,
    headers: {
      accept: "application/json",
      "content-type": request.headers.get("content-type") || "application/json",
      "x-bot-admin-key": env.BOT_PAIRING_PROXY_KEY || "",
    },
    body,
  });

  return responseFromUpstream(result);
}

async function handleBotTunnelAction(env, targetPath, init = {}) {
  return responseFromUpstream(
    await fetchUpstreamText(env, targetPath, {
      headers: {
        accept: "application/json",
        "x-bot-admin-key": env.BOT_PAIRING_PROXY_KEY || "",
        ...(init.headers || {}),
      },
      ...init,
    }),
  );
}

function isPublicApiPath(pathname) {
  return publicApiPaths.has(pathname);
}

function methodNotAllowed() {
  return jsonResponse(
    {
      ok: false,
      message: "Method not allowed.",
    },
    405,
  );
}

function tunnelNotConfigured() {
  return jsonResponse(
    {
      ok: false,
      message: "Bot tunnel URL is not configured.",
    },
    503,
  );
}

function allowOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "cache-control": "no-store",
      ...baseSecurityHeaders,
    },
  });
}

async function handleBotDiagnostics(request, env) {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  return responseFromBotResult(await fetchBotAdminJson(env, "/diagnostics"));
}

async function handleToolsReport(request, env) {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  const diagnosticsResult = await fetchBotAdminJson(env, "/diagnostics");
  const botDiagnostics = diagnosticsResult.ok ? diagnosticsResult.payload : null;
  const checks = [
    {
      key: "edge-auth",
      label: "Dashboard auth",
      ok: true,
      detail: "Sesi admin valid dan API premium terbuka.",
      severity: "success",
    },
    {
      key: "edge-assets",
      label: "Static assets",
      ok: true,
      detail: "Cloudflare Worker melayani bundle dashboard.",
      severity: "success",
    },
    {
      key: "tunnel-configured",
      label: "Bot tunnel",
      ok: Boolean(env.BOT_TUNNEL_URL),
      detail: env.BOT_TUNNEL_URL
        ? "Tunnel runtime dikonfigurasi."
        : "BOT_TUNNEL_URL belum dikonfigurasi.",
      severity: env.BOT_TUNNEL_URL ? "success" : "error",
    },
    {
      key: "bot-diagnostics",
      label: "Bot diagnostics",
      ok: diagnosticsResult.ok,
      detail: diagnosticsResult.ok
        ? "Runtime diagnostics berhasil dibaca."
        : diagnosticsResult.payload?.message || "Runtime diagnostics gagal dibaca.",
      severity: diagnosticsResult.ok ? "success" : "warning",
    },
  ];

  return jsonResponse({
    ok: checks.every((check) => check.ok) && Boolean(botDiagnostics?.ok),
    generatedAt: new Date().toISOString(),
    edge: {
      authenticated: true,
      tunnelConfigured: Boolean(env.BOT_TUNNEL_URL),
      commands: commands.length,
      deployment: "cloudflare",
    },
    checks,
    botDiagnostics,
    message: diagnosticsResult.ok
      ? "Premium tools online."
      : diagnosticsResult.payload?.message || "Bot diagnostics belum tersedia.",
  });
}

async function handleBotPairing(request, env) {
  if (!env.BOT_TUNNEL_URL) {
    return tunnelNotConfigured();
  }

  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  const payload = await request.json().catch(() => null);
  const phone = String(payload?.phone || "").replace(/\D/g, "");

  if (!phone) {
    return jsonResponse(
      {
        ok: false,
        message: "Phone number is required.",
      },
      400,
    );
  }

  return handleBotTunnelAction(env, `/pairing?phone=${encodeURIComponent(phone)}`, {
    method: "GET",
  });
}

async function handleBotReset(request, env) {
  if (!env.BOT_TUNNEL_URL) {
    return tunnelNotConfigured();
  }

  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  return handleBotTunnelAction(env, "/session/reset", {
    method: "POST",
  });
}

async function handleBotLogout(request, env) {
  if (!env.BOT_TUNNEL_URL) {
    return tunnelNotConfigured();
  }

  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  return handleBotTunnelAction(env, "/session/logout", {
    method: "POST",
  });
}

async function handleBotToggle(request, env, enabled) {
  if (!env.BOT_TUNNEL_URL) {
    return tunnelNotConfigured();
  }

  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  return handleBotTunnelAction(env, enabled ? "/bot/enable" : "/bot/disable", {
    method: "POST",
  });
}

async function handleBotQr(request, env) {
  if (!env.BOT_TUNNEL_URL) {
    return tunnelNotConfigured();
  }

  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  return handleBotTunnelAction(env, "/qr", {
    method: "GET",
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return allowOptions();
    }

    if (url.pathname.startsWith("/api/auth/")) {
      return handleAuthRequest(request, env, url);
    }

    if (url.pathname.startsWith("/api/") && !isPublicApiPath(url.pathname)) {
      const authError = await requireAuthenticated(request, env);

      if (authError) {
        return authError;
      }
    }

    if (url.pathname === "/api/status") {
      return jsonResponse({
        name: "Mybeebot",
        status: "live",
        domain: url.host,
        runtime: "Cloudflare Workers Static Assets",
        edgeServedAt: new Date().toISOString(),
        commands,
      });
    }

    if (url.pathname === "/api/meta") {
      return jsonResponse({
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
      return handlePublicBotMeta(env);
    }

    if (url.pathname === "/api/bot-diagnostics") {
      return handleBotDiagnostics(request, env);
    }

    if (url.pathname === "/api/tools-report") {
      return handleToolsReport(request, env);
    }

    if (url.pathname.startsWith("/api/admin/")) {
      return proxyAdminRequest(request, env, url);
    }

    if (url.pathname === "/api/bot-pairing") {
      return handleBotPairing(request, env);
    }

    if (url.pathname === "/api/bot-reset") {
      return handleBotReset(request, env);
    }

    if (url.pathname === "/api/bot-logout-device") {
      return handleBotLogout(request, env);
    }

    if (url.pathname === "/api/bot-enable") {
      return handleBotToggle(request, env, true);
    }

    if (url.pathname === "/api/bot-disable") {
      return handleBotToggle(request, env, false);
    }

    if (url.pathname === "/api/bot-qr") {
      return handleBotQr(request, env);
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request), {
      "content-security-policy":
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    });
  },
};
