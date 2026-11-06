# Realtime contract — the shared lake

**Value:** quiet co-presence. You see other wanderers walking or sitting by the same lake and their lanterns. There is no chat, emote, profile, follower, score or ranking. The solo experience stays complete without it.

## Opt-in and fallback
- Off by default. Turned on with the people button in the top bar or **Settings → Share the lake**.
- If `VITE_REALTIME_URL` is missing in a production build, the option is not shown at all.
- If the server is unreachable or drops, the client returns to the visitor's own lake (local lanterns) and shows one message. It retries with exponential backoff plus jitter (1 s → 30 s max), and the welcome message resyncs state when it reconnects.

## Privacy
- Sent: two name indices (random, not chosen as text), position, facing, a sitting flag, and lantern requests.
- Not sent: accounts, text, reflections, device data.
- Server: in memory only. No persistence and no IP logging. IPs live in memory only to count connections per address.

## Moderation
No free text exists anywhere in the protocol. Names come from fixed word lists, so nothing needs moderating.

## Transport
WebSocket, JSON text frames, max 512 bytes per message (`maxPayload`). Binary frames close the connection with code 1003 (ws library default). Malformed JSON closes with 1007.

## Rooms
- A room is a "lake" of at most **12** wanderers. Joining auto-assigns the first lake with space.
- An empty lake is deleted, together with its lanterns.

## Messages
Client → server:

| t | fields | rules |
|---|---|---|
| `hello` | `v:1`, `name:[adj,noun]` | must be first; indices are integers 0–15, otherwise close 1008. Without a hello within 5 s → close 1008 |
| `move` | `x,z,f` (numbers), `s` (bool) | non-finite values are ignored. The position is clamped with the shared `clampWalkPosition` (lake, world edge, pavilion). The client sends at ≤10 Hz, only when the pose changed |
| `lantern` | — | at most 1 per 3 s per wanderer, otherwise `notice{code:'slow'}`. The server creates the lantern; the lake holds at most 40 |
| `name` | `name:[adj,noun]` | at most 1 per 2 s |

Server → client:

| t | fields |
|---|---|
| `welcome` | `id`, `room`, `peers:[{id,name,x,z,f,s}]`, `lanterns:[{id,x,z,born}]` |
| `join` | `peer` (also used as an update after a rename) |
| `leave` | `id` |
| `state` | `peers:[{id,x,z,f,s}]`: only poses that changed, broadcast at 10 Hz |
| `lantern` | `lantern` |
| `notice` | `code` (`slow`) |

## Limits
| What | Limit |
|---|---|
| Messages per connection | 20/s; extra messages are dropped |
| Connections per IP | 4 (close 1013) |
| Clients per server | 500 (close 1013) |
| Origin allow-list | `ALLOWED_ORIGINS` |

## Presence expiry
- The server pings every 10 s and browsers answer automatically.
- A client that misses a heartbeat is terminated, within about 20 s, and the others receive `leave`.

## Rendering
- Other wanderers appear as a cooler, translucent version of the same figure, with their name in the viewer's language.
- Poses are eased (exponential damping), and walking speed is inferred from movement for the walk cycle.
- The visitor's own lanterns and the shared ones are separate lists. Turning sharing off brings back the local lanterns.

## Known limits
- No anti-teleport: a client may jump anywhere on the walkable ring. Nothing is competitive, so the effect is cosmetic.
- Single process, in memory: a server restart clears lakes. Scaling beyond one process would need sticky rooms or a shared store.
- Behind a reverse proxy, set `TRUST_PROXY=1`. The per-IP limit then uses the last `X-Forwarded-For` entry, the one the proxy appends. Earlier entries are client-supplied and are ignored.
- Plain HTTP `GET /health` returns `ok`, for host health checks. Any other HTTP path returns 426.
- No load test has been run yet.

## Tests
`tests/realtime.test.mjs` runs a real server against real WebSocket clients. It covers:
- join and leave
- pose clamping
- shared lanterns and the 3 s rate limit
- rename
- late joiners receiving existing lanterns
- invalid input ignored, invalid hello refused
- room overflow into a new lake
- per-IP limit
