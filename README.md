# Kare Kapmaca (RF Games)

Monorepo: React client + Node/Socket.io server + shared game logic (npm workspaces).

## Kurulum

```bash
npm run install:all
npm run build:shared
```

> Not: Ortam symlink desteklemiyorsa kök `npm install` (workspace link) başarısız olabilir; `install:all` paketleri ayrı kurar (`--no-workspaces --install-links --include=dev`) ve `build:shared` sonrası `sync:shared` kopyalar. Symlink olan sistemlerde kök `npm install` da kullanılabilir. `--include=dev`, `NODE_ENV=production` (ör. Render) altında da TypeScript/Vite/`@types` kurulmasını sağlar.

## Çalıştırma

Terminal 1 — sunucu:
```bash
npm run dev:server
```

Terminal 2 — istemci:
```bash
npm run dev
```

Tarayıcı: http://localhost:5173

Sunucu CORS: `CORS_ORIGIN` (virgülle ayrılmış; varsayılan `http://localhost:5173` + Render’da `RENDER_EXTERNAL_URL`). Üretimde `*` kullanmayın.

## Üretim / Render

Tek Web Service: Express `client/dist` + Socket.io. Ayrıntı: [`docs/DEPLOY.md`](docs/DEPLOY.md).

```bash
npm run install:all
npm run build
npm start
```

Render: Build `NPM_CONFIG_PRODUCTION=false npm run install:all && npm run build` · Start `npm start` · blueprint: `render.yaml`.

## Test

```bash
npm test
npm run test:e2e
```

## Modlar

- **Yerel:** Aynı cihazda 2–6 oyuncu, harita boyutu seçimi
- **Online:** Oda kodu ile katılım, host oyunu başlatır (kopunca yeniden bağlanma / host aktarımı)

## Yapı

- `shared/` — harita üretimi, fetih kuralları, otomatik doldurma, tur orkestrasyonu
- `client/` — React arayüzü, canvas harita
- `server/` — oda yönetimi, hamle doğrulama, senkronizasyon

## Oyunlar

1. **Kare Kapmaca** — ada fetih (yerel, bot, online)
2. **Katla-Çiz** (isim TBD) — katla-çiz karakter; brief: `docs/GAME2-BRIEF.md`

## Agent / AI harness

- `AGENTS.md` — ürün + teknik brief
- `.cursor/rules/` — kalıcı kurallar
- `.cursor/skills/` — platform + Katla-Çiz skill’leri
- `docs/AGENT-TOOLING.md` — MCP / verify
- `npm run verify` — shared test (+ e2e)

Cursor’da tarayıcı MCP (`cursor-ide-browser`) görsel QA için kullanılır.
