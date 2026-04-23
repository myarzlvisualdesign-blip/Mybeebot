# Mybeebot Refactor Notes

## 1. Audit temuan

- Bot runtime ada di `packages/bot/src/index.js` dan memakai Baileys.
- Command loader sudah ada di `packages/bot/src/lib/command-registry.js`, tetapi sebelumnya belum punya feature flag per tool.
- Dashboard lama lebih fokus pairing/diagnostics, belum menjadi panel pengaturan operasional.
- Settings global masih kecil dan tersebar di JSON lama (`system-settings.json`, `group-settings.json`).
- Belum ada audit trail untuk perubahan settings dari web/WhatsApp.

## 2. Masalah utama

- Source of truth settings belum satu.
- Dashboard dan WhatsApp command belum melewati service layer yang sama.
- Tool metadata belum lengkap: belum ada `input_schema`, `output_schema`, `last_used`, `error_count`.
- Role belum mengenal admin bot, hanya owner dari env.
- Workflow pesan masih monolitik di handler utama.

## 3. Rencana refactor

1. Buat database aplikasi terstruktur di `packages/bot/data/app-database.json`.
2. Letakkan semua perubahan settings di `SettingsService`.
3. Tambahkan `ToolRegistry` sebagai registry metadata dan feature flag.
4. Tambahkan parser command modular yang menerima `.` dan `/`.
5. Tambahkan permissions `owner`, `admin`, `user`.
6. Tambahkan API admin di health server bot.
7. Proxy API admin dari Cloudflare Worker.
8. Ganti dashboard menjadi panel settings operasional.
9. Tambahkan WhatsApp command admin untuk settings/tools/FAQ/template/role/status.
10. Simpan log pesan dan audit trail.

## 4. Struktur folder baru

```text
apps/web/src/
  App.tsx                 Dashboard admin operasional
  index.css               UI dashboard

packages/bot/
  database/
    schema.sql            Schema logis untuk migrasi SQL
    seed.json             Contoh seed data tersanitasi
  data/
    app-database.json     Database runtime, dibuat otomatis saat bot start
  src/
    commands/
      addadmin.js
      deladmin.js
      faq.js
      set.js
      settings.js
      statusbot.js
      template.js
      tool.js
      tools.js
    lib/
      app-database.js
      command-parser.js
      permissions.js
      settings-service.js
      tool-registry.js
      workflow-engine.js
      health-server.js
    index.js

src/
  worker.js               Cloudflare Worker + proxy API admin
```

## 5. Implementasi inti

- `SettingsService` adalah satu service untuk web dan WhatsApp.
- Adapter `systemSettings` dan `groupSettings` tetap disediakan agar command lama tetap jalan.
- `ToolRegistry` membungkus command registry menjadi tool metadata.
- `parseCommand()` membaca prefix dari database sehingga `/menu` dan `.menu` sama-sama jalan.
- `workflow-engine.js` memuat helper jam aktif dan trace workflow.

Potongan inti:

```js
const appDatabase = new AppDatabase(new URL('../data/app-database.json', import.meta.url))
const settingsService = new SettingsService(appDatabase, config)
const groupSettings = settingsService.createGroupSettingsAdapter()
const systemSettings = settingsService.createSystemSettingsAdapter()
const toolRegistry = new ToolRegistry(settingsService)
```

## 6. Dashboard web

Dashboard sekarang memiliki panel:

- login admin
- status runtime bot
- enable/disable bot
- enable/disable tools
- delay balasan, improve mode, fallback mode, dan escalation rules
- keyword command
- FAQ dan template pesan
- auto reply dan jam aktif bot
- owner/admin list
- message logs dan audit logs
- workflows
- integrasi API/webhook
- test reply

Semua form dashboard memanggil endpoint `/api/admin/*`, lalu Worker mem-proxy ke runtime bot.

## 7. WhatsApp settings commands

Command baru:

- `/settings`
- `/tools`
- `/tool on <nama>`
- `/tool off <nama>`
- `/set welcome <isi>`
- `/set delay <detik|off>`
- `/set improve on|off`
- `/set jamaktif 08:00-21:00`
- `/set bot on|off`
- `/set anticall on|off`
- `/set keyword <command>|<keyword>`
- `/addadmin <nomor>`
- `/deladmin <nomor>`
- `/faq add <q>|<a>`
- `/faq del <id>`
- `/template add <nama>|<isi>`
- `/template del <nama>`
- `/statusbot`
- `/reload`

Command lama dengan prefix `.` tetap jalan.

## 8. Tool cleanup

Tools dipertahankan karena masih punya fungsi jelas:

- core: `menu`, `help`, `ping`, `alive`, `repo`, `uptime`
- admin/settings: `settings`, `set`, `tools`, `tool`, `statusbot`, `faq`, `template`
- group moderation: `antilink`, `antispam`, `antibadword`, `welcome`, `goodbye`
- group admin: `kick`, `add`, `promote`, `demote`, `open`, `close`
- media: `sticker`, `toimg`, `tomp3`, `tovn`, `ytmp3`, `ytmp4`
- smart reply: FAQ, template, handoff, improve suggestions dari log

Tool opsional yang ditandai non-core:

- `donate` dinonaktifkan secara default oleh `ToolRegistry` karena tidak berdampak ke workflow utama.

Tidak ada dependency media yang dihapus karena `sharp`, `ffmpeg`, dan `yt-dlp` masih dipakai command media.

## 9. Schema/database

Schema SQL logis ada di:

```text
packages/bot/database/schema.sql
```

Runtime saat ini memakai JSON database:

```text
packages/bot/data/app-database.json
```

Tabel logis:

- `users`
- `admins`
- `settings`
- `tools`
- `conversations`
- `message_logs`
- `faq`
- `templates`
- `workflows`
- `audit_logs`

Seed data contoh tersanitasi:

```text
packages/bot/database/seed.json
```

## 10. Endpoint/API

Cloudflare Worker:

- `GET /api/admin/snapshot`
- `GET|PATCH /api/admin/settings`
- `GET /api/admin/tools`
- `PATCH /api/admin/tools/:id`
- `GET|POST /api/admin/faq`
- `DELETE /api/admin/faq/:id`
- `GET|POST /api/admin/templates`
- `DELETE /api/admin/templates/:name`
- `GET|POST|DELETE /api/admin/roles`
- `GET /api/admin/logs`
- `GET /api/admin/audit`
- `GET /api/admin/workflows`
- `GET|PATCH /api/admin/integrations`
- `POST /api/admin/test-reply`

Runtime bot menerima endpoint yang sama tanpa prefix `/api`, lewat health server.

## 11. Risiko & catatan

- Runtime WhatsApp tetap Node.js lokal/VM, bukan Cloudflare Worker. Worker hanya dashboard dan proxy.
- Jika `BOT_TUNNEL_URL` atau `BOT_PAIRING_PROXY_KEY` salah, dashboard live tidak bisa mengubah runtime.
- Session WhatsApp di `packages/bot/session` jangan di-commit ke repo publik.

## 12. Langkah deploy

```bash
npm install
npm run lint
npm run build
npm run deploy
```

Bot runtime:

```bash
npm run bot:start
```

Live domain:

```text
https://mybeebot.myarzl-visualdesign.my.id
```

## Contoh flow

User chat biasa:

1. Pesan masuk.
2. Router cek command.
3. Jika bukan command, cek jam aktif dan auto responder.
4. Cek FAQ.
5. Jika tidak ada match, fallback/template/handoff dipakai.
6. Log masuk/keluar disimpan.

Admin ubah setting dari web:

1. Admin login.
2. Dashboard memanggil `/api/admin/settings`.
3. Worker proxy ke runtime bot.
4. `SettingsService` update database.
5. Audit log tersimpan.
6. WhatsApp runtime langsung membaca settings terbaru.

Admin ubah setting dari WhatsApp:

1. Admin kirim `/set delay 2` atau `/set improve on`.
2. Parser membaca command.
3. Permission cek role admin/owner.
4. Command memanggil `SettingsService`.
5. Database dan audit log update.
6. Dashboard refresh menampilkan nilai baru.

Enable/disable tools:

1. Admin klik toggle di dashboard atau kirim `/tool off ytmp3`.
2. `ToolRegistry` update feature flag.
3. Command handler menolak tool nonaktif sebelum execute.
4. Audit log tersimpan.

Improve suggestions:

1. Message log dibaca dari percakapan masuk non-command.
2. Pesan yang sering berulang dan belum punya FAQ dihitung.
3. Dashboard menampilkan suggestion yang siap dijadikan FAQ.
4. Admin bisa memasukkan suggestion itu ke knowledge base dalam satu klik.

Fallback ke admin:

1. Jika di luar jam aktif atau fallback mode handoff.
2. Bot mengirim `handoffMessage`.
3. Log message menyimpan mode dan status.
