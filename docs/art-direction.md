# Art direction

Stylized cinematic realism. Misty teal water, moss green forest, muted rose lotus petals, honey-gold lanterns, simple octagonal wooden pavilion. Primitive-based original 3D geometry avoids unlicensed assets. Dynamic scene with a light fog and warm directional sunlight. WebGL performance takes priority over photorealism. Ambient sound is generated via Web Audio; no copyrighted recordings.

## V0.1 scene upgrade (2026-11-06)
Reflective water (drei MeshReflectorMaterial; plain material in low mode), pointed lathe-shaped lotus petals in two rings with notched pads, gently bobbing; swaying reeds along the shore, shore stones, slow warm light motes. Traveler: slim, abstract, genderless porcelain figure (matte #ece4d6) with a thin sage scarf, no face or hair; walk bob/sway/arm swing, idle head turn, breathing; seated pose with crossed legs. No halo or reward glow.

## Open sky (2026-11-07)
- Clear blue day. A gradient sky dome (deep blue overhead, pale at the horizon) replaces the hazy physical sky, which washed out to white under tone mapping.
- 14 drifting clouds (7 in low graphics mode). Each is one sprite with a canvas-painted texture: soft puffs with a blue-grey underside, generated at runtime with no image download. Clouds are static under reduced motion.
- Low rolling hills at about 105-140 m fade into the pale fog for depth.
- The ground extends to 160 m.
- The default camera pitch is lower (0.22), so the horizon and sky sit higher in the frame.
