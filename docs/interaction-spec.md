# Interaction specification

- Enter: dismiss overlay; never require login. While the overlay is shown the camera slowly orbits (not under reduced motion); movement is disabled.
- Move: WASD/arrows or mobile directional controls, relative to the camera view. Smooth acceleration/deceleration; the traveler turns to face the walking direction. Bounded by the world edge, kept out of the lake and out of the pavilion.
- Look: drag on the scene or hold Q/E to orbit; vertical drag tilts (clamped). Wheel or two-finger pinch zooms (3.5–14 m). Camera stays inside the forest edge (24 m); if there is no room behind, it cranes up rather than pushing in, and trees right next to the camera are hidden.
- Tap the water: a ripple spreads from the tap point (ignored if the pointer was dragged). Lantern landings also make a ripple. No ripples under reduced motion.
- Release a light: a lantern settles onto the lake and drifts gently; cap at 40 on the lake. No user-entered message or network storage.
- Sit: traveler sits facing the lake, breathing slows, camera eases to a wide view; compact timer panel (3/5/10 min, begin/pause/leave). Escape or "Leave quietly" ends it freely. Bell when sound is enabled.
- Escape closes any open dialog.
- Sound: off by default. A quiet "Play soft music" link under the actions (and the speaker button) turns on lake ambience + generative music tuned to A = 432 Hz. Settings: music, alpha binaural pulse (headphones), volume. Bowl strike on sitting start/end, chime on lantern release. Details: docs/audio-plan.md.
- Settings: low graphics (no reflections, shadows, sparkles; fewer lotus/reeds/trees) and reduced motion (static flora/lanterns, no walk bob, near-instant camera, no orbit drift).
- No WebGL: a static message is shown; UI remains usable.

- Name: a random two-word name ("Quiet Heron" / "Diệc Lặng") is shown above the figure and under the actions; the shuffle button picks another.
- Language: selector on the welcome screen and in Settings (English, Tiếng Việt, 日本語, Español); defaults to the browser language.
- Share the lake (opt-in): people button or Settings toggle. Other wanderers appear as translucent figures with names; their lanterns join yours. Status line shows how many others are nearby. Connection loss returns you to your own lake with one message and retries automatically. See docs/realtime-contract.md.

No login, chat, AI counselor or persistence. Nothing personal is collected.
