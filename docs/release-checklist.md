# Release checklist

- [x] Implement solo interactive world, lanterns, sitting, sound, keyboard/mobile controls
- [x] Add low-graphics and reduced-motion options
- [x] Add source, setup instructions, pure-logic tests
- [x] npm install, `tsc --noEmit`, `vite build` and `npm test` (8 tests) pass locally (2026-11-06, Node 24, Windows)
- [x] Desktop Chrome smoke test: enter, walk, drag camera, release lanterns, sit, Escape — no console errors
- [ ] Bundle is ~1 MB (285 kB gzip); consider code-splitting three.js if first load is slow on phones
- [x] Shared lake: server + client implemented, 4 integration tests with real sockets; two-tab Chrome test (join, names in VI, shared lantern, server stop → solo fallback → auto-reconnect)
- [x] Deployment config: GitHub Pages workflow, Render blueprint (wss via Render TLS, ALLOWED_ORIGINS, TRUST_PROXY, /health)
- [ ] First deploy verified on github.io + onrender.com
- [ ] Shared lake: load test (target 12 per lake, many lakes)
- [ ] Native-speaker review of ja.json and es.json
- [ ] Cross-browser device testing (Chrome, Safari, Firefox, Android/iOS)
- [ ] Screen-reader and keyboard accessibility audit of 3D scene
- [ ] Performance measurements on representative phones
- [ ] Formal Buddhist content review before educational content is added
