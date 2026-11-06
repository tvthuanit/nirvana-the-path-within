# NIRVANA — The Path Within · V0.1

A real React + TypeScript + React Three Fiber contemplative 3D world. The Lotus Sanctuary is an original artistic environment, **not a literal depiction of Nirvana**. No accounts, no backend, no leaderboard or meditation score.

## Requirements
Node.js 22.18+ (tests and the realtime server run `src/logic.ts` directly via Node type stripping), npm, modern browser with WebGL.

## Windows setup (PowerShell)
```powershell
cd nirvana-the-path-within
npm install
npm run dev
```
Open the local address shown by Vite (typically http://localhost:5173).

## Shared lake (optional multiplayer)
```powershell
npm run server      # ws://localhost:8787 — terminal 1
npm run dev         # terminal 2; open two browser windows and press the people button in each
```
Without `VITE_REALTIME_URL` the build is solo-only. Protocol and limits: `docs/realtime-contract.md`.

## Free deployment (GitHub Pages + Render)
1. **Site** — GitHub repo → Settings → Pages → Source: **GitHub Actions**. Every push to `main` runs `.github/workflows/deploy-pages.yml` (tests, build, deploy) to `https://tvthuanit.github.io/nirvana-the-path-within/`.
2. **Shared-lake server** — render.com → New → Blueprint → pick this repo; `render.yaml` creates a free web service (`npm run server`, health check `/health`, `ALLOWED_ORIGINS=https://tvthuanit.github.io`, `TRUST_PROXY=1`).
3. **Connect them** — GitHub repo → Settings → Secrets and variables → Actions → Variables → `VITE_REALTIME_URL` = `wss://<your-service>.onrender.com`, then re-run the Pages workflow.

Free-plan caveat: Render sleeps after ~15 min idle; the first visitor waits ~30–60 s while the client shows "out of reach" and reconnects by itself. Server memory (lanterns) resets on each sleep/restart.

## Languages
English, Tiếng Việt, 日本語, Español in `src/locales/*.json` (i18next-compatible format). To add one: copy `en.json`, translate every value (keep `{{…}}` placeholders; provide 16 `adj` and 16 `noun` words and a `nameFormat`), register it in `src/i18n.ts`. `npm test` fails if any key is missing. Translations other than English/Vietnamese should be reviewed by a native speaker.

## Verification
```powershell
npm test
npm run build
npm run preview
```

## Controls
- Enter Sanctuary: start experience.
- W/A/S/D or arrow keys: walk (relative to the camera).
- Drag the scene or hold Q/E: look around. Mouse wheel / pinch: zoom.
- Tap the water: ripple.
- Escape: close any dialog or end a sitting session.
- Mobile: touch directional pad.
- Release a light: add a floating lantern (up to 40).
- Sit in stillness: choose 3, 5 or 10 minutes; begin/pause/leave freely.
- Sound: off by default. "Play soft music" under the actions starts one of four generated pieces tuned to A = 432 Hz (skip button next to its name); Settings adds the piece list, optional lake sounds, an alpha binaural pulse (headphones) and volume. All synthesized locally — see docs/audio-plan.md.
- Settings: language, low graphics, reduced motion, share the lake.
- Shuffle button next to your name: pick another random name.
- People button (top right): share the lake with other wanderers (opt-in).

## Architecture
`src/World.tsx`: R3F procedural scene (instanced lotus/reeds, reflective water, ripples, lanterns), procedural traveler rig, input and third-person camera. `src/main.tsx`: UI and state. `src/audio.ts`: local Web Audio synthesizer. `src/logic.ts`: movement, names and timer logic shared by browser and server. `src/i18n.ts` + `src/locales/`: translations. `src/net.ts`: shared-lake client. `server/`: realtime server. Docs capture concept, experience and decisions.

## Current limitations
This is a **vertical slice**, not the six-zone online world. No persistence, chat, imported character animation or realistic 3D assets. Camera does not avoid the pavilion; trees right next to it are hidden. Procedural traveler (no imported rig). Mobile control pad is available on narrow screens. Procedural environment is stylized rather than photorealistic. Audio availability depends on browser gesture policies. Without WebGL a static fallback message is shown. Production JS bundle is ~1 MB (285 kB gzip).

## Ethical intent
The experience is inspired by contemplative themes and does not promise healing, enlightenment or spiritual attainment. No user reflections are stored or transmitted.
