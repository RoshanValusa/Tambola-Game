# Tambola — Real-Time Multiplayer Housie

Production-ready, server-authoritative Tambola/Housie web app supporting up to **50 concurrent players per room** over WebSockets. Backend is the single source of truth — tickets, number calls, and claim validation happen exclusively on the server. Frontend is a glossy dark/neon React UI.

```
Client (React + Vite)  ──── WebSocket (Socket.IO) ────►  Backend (Node + Express + Socket.IO)
                                                              ├── In-memory Room Registry (hot state)
                                                              └── Postgres (game history only)
```

## Repo layout

```
.
├── backend/              Node + Express + Socket.IO + TS
├── frontend/             React + Vite + TS + Tailwind + Framer Motion + Zustand
├── packages/shared/      Shared event names, payloads, DTOs (typed wire contract)
├── render.yaml           Deployment blueprint (Render)
└── package.json          npm workspaces root
```

## Architecture

- **Server-authoritative**: clients never generate tickets, never decide called numbers, never validate their own claims. Every claim is re-validated against the server's `calledNumbers ∩ ticket`.
- **Single instance, in-memory rooms** (`Map<roomId, Room>`); domain events fan out via Socket.IO `io.to(roomId)` for minimal broadcasts. The room service emits domain events through an `EventEmitter`, decoupling it from the transport layer (Redis adapter can be added later without refactor).
- **Hybrid guest auth**: `POST /api/auth/guest` issues a 7-day JWT (`{ userId, displayName, kind }`). Socket.IO middleware verifies the same token on connection.
- **60-second reconnect grace**: on disconnect, the player slot is held; rejoining with the same JWT restores ticket and game state. After grace, lobby slots are freed; mid-game, the slot is logged but the ticket is preserved for record.
- **Anti-cheat**:
  - Tickets generated server-side via a backtracking algorithm with full Tambola invariants (3×9, 15 numbers, 5/row, sorted columns, 1–3 numbers per column, correct ranges).
  - All five claim types validated by a pure validator (`claim.validator.ts`).
  - Bogus claim → that player disqualified from **that specific prize** for the rest of the game (configurable).
  - First-come-first-served single winner per prize.
  - Per-event rate limiting on the socket (`claim_win`: 3/sec, `start_game`: 1/sec).
  - All payloads zod-validated on the server.
  - Helmet + CORS allowlist + per-IP REST rate limit.
- **Database is write-once at game end.** Real-time state never touches Postgres.

## Quickstart (local)

```powershell
# Install everything (npm workspaces)
npm install

# Build the shared types package once (or after edits)
npm run build --workspace packages/shared

# Configure env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env

# Run backend (http://localhost:4000)
npm run dev:backend

# In another terminal — run frontend (http://localhost:5173)
npm run dev:frontend
```

Open two browser windows on `http://localhost:5173`, create a room in one, join with the 6-character code in the other, then click **Start Game**.

## Tests

```powershell
npm test
```

Includes:
- 10,000-iteration ticket invariant suite
- Claim validator matrix (all 5 prize types, valid + invalid + already-awarded + disqualified paths)
- Room-code collision suite

## REST API

| Method | Path                        | Auth   | Body / Params                | Response                                |
|--------|-----------------------------|--------|------------------------------|-----------------------------------------|
| GET    | `/healthz`                  | -      | -                            | `{ ok, ts }`                            |
| POST   | `/api/auth/guest`           | -      | `{ displayName }`            | `{ token, user }`                       |
| POST   | `/api/rooms`                | Bearer | -                            | `{ roomId, code, hostId }`              |
| GET    | `/api/rooms/:code/exists`   | -      | -                            | `{ code, state, playerCount, ... }`     |

## Socket.IO events

**Client → Server** (with ack `{ ok, data?, error? }`):
`join_room`, `leave_room`, `start_game`, `configure_room`, `claim_win`, `end_game`.

**Server → Client**:
`room_snapshot`, `player_joined`, `player_left`, `lobby_update`, `host_changed`, `game_started`, `number_called`, `claim_result`, `game_ended`, `error`.

All event names + payload TypeScript types are defined in `packages/shared/src/events.ts` so the wire format is shared between backend and frontend.

## Deployment (Render)

A blueprint is provided in [render.yaml](render.yaml).

1. Create a Postgres on **Neon** or **Supabase** → copy the `DATABASE_URL`.
2. Push this repo to GitHub.
3. In Render, **New → Blueprint** and select the repo. Render reads `render.yaml`.
4. Set the secrets:
   - `tambola-backend.CORS_ORIGIN` = your frontend URL (e.g. `https://tambola-frontend.onrender.com`)
   - `tambola-backend.DATABASE_URL` = your Postgres URL (optional — leave blank to skip persistence)
   - `tambola-frontend.VITE_API_URL` = your backend URL (e.g. `https://tambola-backend.onrender.com`)
   - `tambola-frontend.VITE_SOCKET_URL` = same as `VITE_API_URL`
5. Deploy. The backend runs migrations on boot.

Frontend can also be deployed to **Vercel** (it's a vanilla Vite SPA — set the same two `VITE_*` env vars).

## Environment variables

### Backend (`backend/.env`)

| Variable               | Default                      | Description                                                |
|------------------------|------------------------------|------------------------------------------------------------|
| `PORT`                 | `4000`                       |                                                            |
| `NODE_ENV`             | `development`                |                                                            |
| `LOG_LEVEL`            | `info`                       | pino level                                                 |
| `JWT_SECRET`           | (dev fallback)               | **Required in production**                                 |
| `JWT_EXPIRES_IN`       | `7d`                         |                                                            |
| `CORS_ORIGIN`          | `http://localhost:5173`      | Comma-separated allowlist                                  |
| `CALL_DEFAULT_MS`      | `5000`                       | Default number-calling interval                            |
| `RECONNECT_GRACE_MS`   | `60000`                      | Disconnect grace before lobby eviction                     |
| `ROOM_IDLE_TTL_MS`     | `1800000`                    | Idle rooms purged after this                               |
| `MAX_PLAYERS_PER_ROOM` | `50`                         |                                                            |
| `DATABASE_URL`         | _(empty)_                    | Leave blank to skip persistence                            |

### Frontend (`frontend/.env`)

| Variable          | Default                  |
|-------------------|--------------------------|
| `VITE_API_URL`    | `http://localhost:4000`  |
| `VITE_SOCKET_URL` | `http://localhost:4000`  |

## Anti-cheat at a glance

| Threat                                              | Mitigation                                                      |
|-----------------------------------------------------|------------------------------------------------------------------|
| Forged claim for un-called numbers                  | Server re-runs `validateClaim` against its own `calledNumbers`   |
| Replaying another user's `start_game`               | Token-derived `userId` checked against `room.hostId`             |
| Spamming claim events                               | Per-socket rate limiter (3/sec)                                  |
| Mutating ticket on the client                       | Ticket is generated and stored only on the server                |
| Joining a started game                              | `state !== 'lobby'` rejected with `ROOM_LOCKED`                  |
| Crossing 50-player cap                              | `players.size >= maxPlayers` rejected with `ROOM_FULL`           |
| Predicting the next number                          | `crypto.randomInt`-driven Fisher–Yates shuffle of the pool       |
| Re-claiming a prize someone else already won        | Pre-check `winners[type].length > 0`                             |
| Repeated bogus claims                               | Per-prize disqualification                                       |

## Roadmap (out of scope for v1)

- Chat / voice
- Spectator mode
- Multi-ticket per player (config flag `ticketsPerPlayer` reserved)
- Tournament / multi-round
- Leaderboards (Postgres schema is forward-compatible)
- Redis adapter for horizontal scale (transport already decoupled from domain events)

## License

MIT
