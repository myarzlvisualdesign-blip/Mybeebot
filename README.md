# Mybeebot

Mybeebot is a fresh WhatsApp bot starter inspired by the structure of `wa-base-bot`, but rebuilt into a cleaner project with:

- a new command system
- safer local configuration
- a health endpoint for the bot runtime
- a Cloudflare-deployed live companion site

## Project structure

```text
apps/web        Cloudflare live site and edge API
packages/bot    Node.js + Baileys WhatsApp bot runtime
src/worker.js   Cloudflare Worker entry for static assets + JSON endpoints
wrangler.jsonc  Cloudflare deployment config
```

## Quick start

```bash
npm install
cp packages/bot/.env.example packages/bot/.env
npm run bot:start
```

In a second terminal, run the web app locally:

```bash
npm run dev:web
```

## Bot runtime notes

The WhatsApp socket runtime lives in `packages/bot` and is designed for a long-lived Node.js process with a persistent auth session.

The Cloudflare deployment in this repo serves:

- the Mybeebot public launch page
- a lightweight `/api/status` endpoint
- a lightweight `/api/meta` endpoint

## Deploy to Cloudflare

```bash
npm run deploy
```

The configured live domain is:

`https://mybeebot.myarzl-visualdesign.my.id`

The public bot health proxy is exposed from the same domain at:

`https://mybeebot.myarzl-visualdesign.my.id/api/bot-health`

## Commands included

- `.menu`
- `.help`
- `.ping`
- `.alive`
- `.repo`
- `.echo`
- `.reload`

## Reference

Upstream inspiration:

`https://github.com/athmanmussah-sketch/wa-base-bot`
