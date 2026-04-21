# Mybeebot Bot Runtime

This package contains the WhatsApp bot runtime for Mybeebot.

## What it includes

- pairing-code login flow
- command loader from `src/commands`
- reconnect handling
- local health endpoint on `http://localhost:8788/health`

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
