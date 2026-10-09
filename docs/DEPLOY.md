# Deploy (Render) — Phase 1

Tek **Web Service**: Express hem API/Socket.io hem `client/dist` SPA’yı sunar.

## Render’da ne yapmalısın

1. [Render](https://render.com) hesabı aç; GitHub/GitLab’daki bu repoyu bağla.
2. **Blueprint** kullanıyorsan: kökteki `render.yaml` ile “New → Blueprint”.
   - Manuel: **Web Service** → kök dizin monorepo root.
3. Komutlar (blueprint’te de aynı):
   - **Build:** `npm run install:all && npm run build`
   - **Start:** `npm start`
4. Deploy bitince URL’yi paylaş (ör. `https://rfgames.onrender.com`).
5. Free plan uyur; ilk istekte uyanma gecikmesi normal.

## Ortam değişkenleri

| Değişken | Gerekli? | Açıklama |
|----------|----------|----------|
| `PORT` | Render set eder | Dinleme portu |
| `NODE_ENV` | `production` | Blueprint’te set |
| `CORS_ORIGIN` | Genelde hayır | Virgülle origin listesi. Same-origin’de Render `RENDER_EXTERNAL_URL` otomatik allow list’e eklenir. Özel domain için `https://senin-domain.com` yaz. **`*` kullanma.** |
| `VITE_SERVER_URL` | Hayır | Build-time Socket URL. Boşsa üretim client `window.location.origin` kullanır (tek servis için ideal). |
| `SERVE_CLIENT` | Hayır | `0` yaparsan statik SPA kapanır (sadece API). |

İstemciye secret koyma; yalnızca `VITE_*` build’e gömülür.

## Yerel üretim duman testi

```bash
npm run install:all
npm run build
npm start
```

`install:all` paketleri `--install-links` ile kurar (Windows’ta `file:` symlink hatasını önler). `build:shared` ardından `sync:shared` güncel `shared/dist`’i client/server `node_modules` içine kopyalar.

- http://localhost:3001/health → `{"ok":true}`
- http://localhost:3001/ → SPA
- Kapmaca online: aynı origin Socket

## Sonraki faz

Katla-Çiz online Socket odaları bu deploy’a sonra eklenir; Phase 1 yalnızca hosting + Kapmaca online.
