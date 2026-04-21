# Mybeebot Bot Runtime

This package contains the WhatsApp bot runtime for Mybeebot.

## What it includes

- pairing-code login flow
- command loader from `src/commands`
- reconnect handling
- local health endpoint on `http://localhost:8788/health`
- local-only pairing endpoint on `http://127.0.0.1:8788/pairing?phone=628...`

## Setup

```bash
cp .env.example .env
npm install
npm start
```

## Commands

- `.menu`
- `.help`
- `.ping`
- `.alive`
- `.repo`
- `.echo`
- `.reload`

## Notes

The session directory is ignored by git. Delete the session files if you need to reset the login.

The pairing endpoint only responds for localhost requests. Public tunnel traffic can read health and metadata, but cannot trigger pairing.
