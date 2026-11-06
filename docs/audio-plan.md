# Audio plan

Everything is synthesized in the browser with Web Audio (`src/audio.ts`). There are no audio files, no streaming and no third-party players, so there is nothing to license or attribute and nothing that tracks the listener.

## Rules
- **Off by default.** Audio starts only after a click: the "♪ Play soft music" link under the actions, the speaker button in the top bar, or Settings.
- **Nothing depends on sound.** Every interaction works muted.
- **Muting** fades out over about 0.4 s, then suspends the AudioContext so it uses no CPU.
- **Volume** is a 0–1 slider in Settings. Each layer can be switched off on its own.
- **No health claims.** The 432 Hz tuning and the alpha pulse are described as sound textures, never as healing or treatment. This follows PROJECT_BRIEF: "does not promise healing".

## Layers
| Layer | Sound | Level (before volume) | Default |
|---|---|---|---|
| Lake | Brown-noise water whose low-pass rises and falls at 0.11 Hz like small waves. Band-passed wind swelling at 0.05 Hz. A two- or three-note bird call every 9–25 s, panned at random | 0.55 | on with sound |
| Soft music | Drone on A2/E3/A3, each breathing at its own slow rate. A minor pentatonic chimes (A3–A5) at random every 3–9 s through a damped feedback delay, panned at random, so the music never repeats exactly. Tuned to **A4 = 432 Hz** | 0.7 | on with the link |
| Alpha binaural pulse | 216 Hz in the left ear, 226 Hz in the right, giving a perceived 10 Hz beat. Needs headphones | 0.5 × 0.06 | off |

## Event sounds
| Sound | When | How |
|---|---|---|
| Singing-bowl strike | Starting a sitting session and when it completes | Inharmonic partials 1, 2.76, 5.4 and 8.93 × 216 Hz, 7 s decay |
| Single pentatonic chime | Releasing a lantern; turning sound on | One chime at a random pentatonic pitch |

## Verification (2026-11-06, Chrome, localhost)
- **Analyser tap on the master output, 5 s after the link click:** RMS ≈ 0.05, with the spectral peak at ~105 Hz (the A2 drone at 108 Hz; bin width 11.7 Hz).
- **Volume:** 0.7 → 0.2 dropped RMS 0.05 → 0.016. Muting dropped it to 0.0007 and the context changed to `suspended`. The music link reappeared.
- **Alpha, measured per channel with a 32k FFT:**
  - Left ear: 216 Hz at −51 dB, 226 Hz at −71 dB.
  - Right ear: 226 Hz at −49 dB, 216 Hz at −60 dB. The remaining 216 Hz on the right is the drone's A3, which plays in both ears.
- **Unit test:** `tests/audio.test.mjs` checks the 432 Hz tuning and the 10 Hz beat.

## Future (not built)
- Optional CC0 field recordings from Freesound, with a license log in this file.
- A breath-paced swell during sitting sessions.
