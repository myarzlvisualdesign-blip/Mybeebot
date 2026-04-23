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

## Admin refactor

The bot now uses one settings source through `SettingsService`:

- web dashboard calls `/api/admin/*`
- WhatsApp admin commands call the same service layer
- settings, tools, FAQ, templates, workflows, message logs, and audit logs are stored in `packages/bot/data/app-database.json`
- logical migration schema lives in `packages/bot/database/schema.sql`

Admin WhatsApp commands support both `.` and `/`, for example:

```text
/settings
/tools
/tool off ytmp3
/set delay 2
/set improve on
/faq add Jam operasional?|Admin aktif 08:00-21:00.
/template add welcome|Halo, ada yang bisa dibantu?
/addadmin 6281234567890
/statusbot
```

See `docs/architecture.md` for the audit, folder structure, API list, workflow, and deploy notes.

## Reference

Upstream inspiration:

`https://github.com/athmanmussah-sketch/wa-base-bot`
