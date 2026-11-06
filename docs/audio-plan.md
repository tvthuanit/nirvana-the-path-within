# Audio plan

Everything is synthesized in the browser with Web Audio (`src/audio.ts`). There are no audio files, no streaming and no third-party players, so there is nothing to license or attribute and nothing that tracks the listener. The room reverb is also synthesized: its impulse response is decaying stereo noise generated when the page runs.

## Rules
- **Off by default.** Audio starts only after a click: the "♪ Play soft music" link under the actions, the speaker button in the top bar, or Settings.
- **The music link plays music only.** Lake sounds are a separate, opt-in layer. An earlier version mixed loud water and wind noise in by default, and listeners said it sounded like a storm.
- **Nothing depends on sound.** Every interaction works muted.
- **Muting** fades out over about 0.4 s, then suspends the AudioContext so it uses no CPU.
- **Volume** is a 0–1 slider in Settings. Each layer can be switched off on its own.
- **No health claims.** The 432 Hz tuning and the alpha pulse are described as sound textures, never as healing or treatment. This follows PROJECT_BRIEF: "does not promise healing".

## Music: four generative pieces, tuned to A4 = 432 Hz
Choose a piece in Settings, or use the skip button next to the "now playing" line. Every piece is randomized inside fixed rules, so none repeats exactly.

| Piece | What plays |
|---|---|
| Lotus Dawn | Warm pad progression Am – F – C – G, 10 s per chord. Each chord note is two detuned sines with a 3 s swell. Over it, one or two A minor pentatonic chimes per bar |
| Moon over Water | A quiet pad Am – Em – F – C under a slow arpeggio of soft plucks (sine plus 2nd and 3rd harmonics, 3 s decay), one every 1.2 s, about 28 % of notes left as rests |
| Singing Bowls | Bowl strikes (inharmonic partials 1, 2.76, 5.4, 8.93) on A2, E3, A3, D4 or E4 every 6–10 s with 11 s tails, over a faint A–E drone |
| Deep Rest | Very slow open chords Fmaj7 – Cmaj7 – Am7 – Gadd9, 16 s each, with a 5 s swell. Nothing else |

All music passes through a gentle low-pass at 3.2 kHz and a synthesized room reverb (75 % dry, 50 % wet).

## Other layers
| Layer | Sound | Level (before volume) | Default |
|---|---|---|---|
| Lake sounds | Brown noise low-passed at about 260 Hz, with the cutoff drifting at 0.09 Hz like small waves. Two or three bird notes every 10–24 s. No wind | 0.22 | off |
| Alpha binaural pulse | 216 Hz in the left ear, 226 Hz in the right, giving a perceived 10 Hz beat. Needs headphones | 0.5 × 0.06 | off |

## Event sounds
| Sound | When |
|---|---|
| Singing-bowl strike on A3 (216 Hz, 7 s decay) | A sitting session starts or completes |
| Single pentatonic chime | A lantern is released; sound is turned on |

## Verification (2026-11-06, Chrome, localhost)
Measurements come from an analyser tap on the master output.

**Noise check.** Spectral flatness over 100 Hz–4 kHz:
- 0 for all four pieces, meaning purely tonal with no broadband noise left. The previous version sounded like wind because water and wind noise dominated.
- Spectral peaks land on 432 Hz-tuned notes: 217 ≈ A3 (216), 258 ≈ C4 (257), 322 ≈ E4 (324), 105 ≈ A2 (108). The bin width is about 6 Hz.

**Loudness at volume 0.7.** RMS ranged from about 0.03 to 0.06 across the pieces (Moon 0.047, Deep Rest at full swell 0.061, Bowls 0.03 after raising the bowl level). The highest peak was 0.24, so nothing clips.

**Settings dialog.** At 730 px viewport height it now scrolls, so every control stays reachable. The volume slider is 140 px wide.

**Earlier checks, still valid:**
- Alpha, per channel: left 216 Hz at −51 dB and 226 Hz at −71 dB; right 226 Hz at −49 dB.
- Muting suspends the AudioContext.

**Unit tests.** `tests/audio.test.mjs` checks the 432 Hz tuning, the 10 Hz beat, and that every piece has a name in every language.

## Future (not built)
- Optional CC0 field recordings from Freesound, with a license log in this file.
- A breath-paced swell during sitting sessions.
