# Decisions

1. One complete playable zone before adding more scenes.
2. Procedural original geometry rather than external 3D assets.
3. Solo-first: no backend in MVP.
4. No spiritual gamification, chat or ranking.
5. Ambient audio is opt-in and synthesized in browser.
6. Multiplayer deferred until validated user need and moderation design.
7. (2026-11-06) Third-person orbit camera: drag / Q·E to look, wheel / pinch to zoom; movement is camera-relative. Sitting eases into a wide, slow view over the lake (no drift under reduced motion).
8. (2026-11-06) Lanterns use emissive + additive glow instead of per-lantern point lights — adding lights changed the light count and forced shader recompiles (visible stutter).
9. (2026-11-06) Lotus field, petals and reeds are instanced meshes (3–4 draw calls instead of ~1000).
10. (2026-11-06) Traveler is an abstract, genderless porcelain figure (no face, hair or clothing cues; a thin sage scarf marks the front) — anyone can project themselves onto it, and it avoids monastic attire. No halo or glow when sitting: stillness is not shown as an achievement.
11. (2026-11-06) Pavilion moved back from the shore so the lakeside loop is always walkable; avatar collides with it.
12. ~~Multiplayer deferred~~ → superseded by 15 at the owner's request (2026-11-06).
13. (2026-11-06) Random wanderer names = two indices into per-language adjective/noun lists (16×16). A name re-localizes with the UI, contains no user text, and is regenerated on demand. Not persisted.
14. (2026-11-06) i18n without a library: locale JSON in i18next format (`{{var}}`, `_one/_other`), plurals via built-in `Intl.PluralRules`, language names via `Intl.DisplayNames`. EN, VI, JA, ES. Choice is remembered in localStorage (per-viewer convenience only). Move to i18next only if namespaces, lazy loading or translator tooling are needed — the files are already compatible.
15. (2026-11-06) Shared lake (multiplayer) as opt-in quiet co-presence: authoritative Node `ws` server, memory only, no free text (nothing to moderate). Contract: docs/realtime-contract.md. Server imports `src/logic.ts` directly (Node ≥22.18 type stripping), so walking rules are shared, not duplicated.
16. (2026-11-06) Free hosting: GitHub Pages (static, via Actions) + Render free web service (WebSocket server). Accepted trade-off: cold start after idle and in-memory reset. Vite `base: './'` so one build works on any path.
17. (2026-11-06) Music is generative Web Audio (A4 = 432 Hz, pentatonic chimes, drone) plus an optional 10 Hz binaural alpha layer — no files, no licensing, no embedded players (YouTube/Spotify would add tracking cookies). Described as sound texture only; no healing claims.
