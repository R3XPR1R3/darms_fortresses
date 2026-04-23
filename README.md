# Darms: Fortresses

Online multiplayer card strategy game for 4-6 players. Build districts, pick heroes, outmaneuver opponents.

## How to play

- Each day, **draft a hero** with a unique ability (8 heroes, 2 banned per round)
- **Build districts** by paying gold from your hand
- **First to 8 districts** (or 3 altars) triggers the final day
- **Highest score wins** (sum of district HP + bonuses)

### Hero roles

| Hero | Speed | Color | Ability |
|------|-------|-------|---------|
| Assassin | 1 | — | Kill a hero: they skip their turn |
| Specialist | 2 | — | Steal all gold from a hero |
| Strategist | 3 | — | Discard 2 / draw 3, or swap hands |
| Leader | 4 | Yellow | Crown + income per yellow district |
| Cleric | 5 | Blue | Protection + income per blue district |
| Treasurer | 6 | Green | +1 bonus gold + income per green district |
| Architect | 7 | — | Draw 2 extra, build up to 3 |
| General | 8 | Red | Destroy districts + income per red district |

### District colors

- **Yellow** — nobility (Leader gets income)
- **Blue** — clergy (Cleric gets income)
- **Green** — trade (Treasurer gets income)
- **Red** — military (General gets income)
- **Purple** — special buildings with unique effects

### Special mechanics

- **Companions** (from day 4) — helpers with passive or active abilities
- **Purple draft** (days 3, 6, 9, 12) — pick 1 of 3 special purple cards
- **Spells** — one-time cards (Ignite, Gold Rain, Holy Day, Flood, Plague)
- **Altars** — alternative win condition: build 3 different altars

## Project layout

```
apps/
  client/       — Vite-based browser client (TypeScript + DOM)
  server/       — Node.js WebSocket game server
  admin-tools/  — internal tools (stub)
packages/
  game-core/    — deterministic game rules engine
  shared-types/ — shared DTO/types between client & server
  game-data/    — game content schema (stub)
  match-simulation/ — bot & balance simulation
infra/
  docker/       — Dockerfile, docker-compose, supervisord
content/        — versioned game content (cards, heroes, cosmetics)
docs/           — architecture & design docs
tests/          — unit/integration/simulation tests
```

## Tech stack

- **Runtime**: Node.js 20+, pnpm 9 workspaces
- **Client**: Vite + TypeScript (vanilla DOM, no framework)
- **Server**: WebSocket (ws) + deterministic game loop
- **Deploy**: Docker multi-stage build, nginx + supervisord, Cloudflare tunnel
- **CI/CD**: GitHub Actions (test + deploy to Raspberry Pi)

## Development

```bash
pnpm install
pnpm run build        # build all packages
pnpm run test         # run tests
npm run build         # npm wrapper (calls pnpm workspace build)
```

> Note: if `npm` prints `Unknown env config "http-proxy"`, this is an environment-level npm warning, not a project build error.

### Local development

```bash
cd apps/client && pnpm dev    # client at http://localhost:3000
cd apps/server && pnpm dev    # server at ws://localhost:4000
```

### Raspberry Pi Control Center

For Raspberry deployment and live operations, use the built-in control center:

```bash
bash infra/control-center.sh
```

It provides:
- persistent config storage (Google OAuth / JWT / deploy env) that survives updates
- start/stop/rebuild actions for docker stack
- live server logs + match history + live latest match tail
- campaign JSON skeleton generation + custom art registration
- helper flow for committing/pushing changes into a PR branch

### Wallet admin (console)

Player resources can be managed from terminal:

```bash
pnpm run wallet:admin -- list
pnpm run wallet:admin -- get 1
pnpm run wallet:admin -- set 1 250 10
pnpm run wallet:admin -- add-gold 1 75
```

### Docker

```bash
cd infra/docker
docker compose up --build     # builds & runs everything on port 80
```

## Languages

The game supports English (EN), Russian (RU), and Indonesian (ID). Language is switchable in-game.
