# Darms: Fortresses

Initial repository scaffold for the online strategy/card game project.

## Project layout

- `apps/client` — game client (UI, input, presentation).
- `apps/server` — authoritative multiplayer backend.
- `apps/admin-tools` — internal tools (content, balance, moderation).
- `packages/game-core` — deterministic game rules engine.
- `packages/game-data` — game content schema + static data loading.
- `packages/shared-types` — shared DTO/types between client/server/tools.
- `packages/match-simulation` — bot and balance simulation utilities.
- `content` — versioned game content (cards, heroes, campaigns, cosmetics).
- `docs` — architecture, design, ops and content docs.
- `infra` — docker/CI/deployment building blocks.
- `tools/scripts` — helper scripts for workflows.
- `tests` — unit/integration/simulation tests.

## Next steps

1. Pick the primary runtime/toolchain for apps and packages.
2. Implement deterministic turn engine in `packages/game-core`.
3. Define content JSON schemas and validation in `packages/game-data`.
4. Build minimal playable loop (bot match) before networked lobby.
