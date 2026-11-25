# SONIC GRAB — Legal Music Discovery & Free MP3 SaaS

A deployable, client-side React + Vite + TypeScript + Material UI SaaS web application for discovering live music metadata, finding verified Creative Commons & Public Domain MP3 downloads, managing personal playlists, and letting every user bring their own API tokens (BYOT).

> **Compliance Notice:** SONIC GRAB never bypasses DRM, never scrapes protected streaming platforms, and never converts streaming previews into MP3 files. Only tracks with explicit provider authorisation (`FREE DOWNLOAD AVAILABLE`) expose an MP3 download action.

---

## 1. Local Development

Requires **Node.js 18+** and **npm**.

```bash
npm install
npm run dev
```

Verify types and build:

```bash
npm run typecheck
npm run build
```

---

## 2. Multi-User BYOT (Bring Your Own Tokens) Model

Every visitor can enter their own API tokens directly in the browser via **My API Tokens** (top bar) or **Settings & Tokens** (`/settings`):
- Tokens are persisted privately in each user's own browser `localStorage` and are never sent to any SONIC GRAB backend.
- Playlists, favourites, download history, and cached MP3 blobs are stored per-user in their browser's IndexedDB (`sonic-grab-db`).
- **Important for Deployers:** Leave `.env` unset in CI/production builds so your personal credentials are not bundled into the public JavaScript build.

| Provider | User Token Needed | Purpose |
| --- | --- | --- |
| **Internet Archive** | None | Public Domain / CC MP3 downloads out of the box |
| **Apple / iTunes Discovery** | Optional Apple Music Developer JWT | Live charts, artist catalogues & 30s previews (`STREAMING ONLY`) |
| **MusicBrainz** | None | Artist, release-group & Cover Art Archive metadata (`1 req/sec`) |
| **Jamendo** | User's free `client_id` (`devportal.jamendo.com`) | CC-licensed free MP3 downloads |
| **Spotify** | Optional user OAuth token | Metadata-only discovery (`STREAMING ONLY`) |
| **SoundCloud** | Optional `client_id` | Artist-authorised downloads only |
| **Bandcamp** | N/A | External discovery only (no public CORS API) |

---

## 3. Deploying to a Server / Cloud Host

Because all requests run directly from the user's browser using their own tokens, the built `dist/` folder deploys to any static host or container platform:

### Option A — Vercel
Includes `vercel.json` with SPA rewrites and security headers:
```bash
npx vercel --prod
```

### Option B — Netlify or Cloudflare Pages
Includes `netlify.toml` and `public/_redirects`:
- Build command: `npm run build`
- Publish directory: `dist`

### Option C — Docker + Nginx (VPS / Cloud Run / Render / Railway)
Includes `Dockerfile`, `.dockerignore` (excludes `.env`), and `nginx.conf`:
```bash
docker build -t sonic-grab .
docker run -p 8080:80 sonic-grab
```

---

## 4. Known Limitations

- Browsers forbid custom `User-Agent` headers in `fetch()`, and certain external file hosts block cross-origin `fetch()` via CORS. When CORS blocks a fetch download, SONIC GRAB opens the official provider download URL / source page directly instead of proxying through a server.
- Commercial label tracks are strictly labelled `STREAMING ONLY` or `DOWNLOAD NOT VERIFIED` and cannot be downloaded as MP3s.
