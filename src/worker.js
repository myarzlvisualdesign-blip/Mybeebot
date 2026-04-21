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
        note: "The live edge deploy hosts the public companion site and status APIs. The WhatsApp socket runtime stays in the Node.js bot package.",
      });
    }

    return env.ASSETS.fetch(request);
  },
};
