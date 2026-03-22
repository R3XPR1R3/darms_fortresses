# Project Structure (v0)

This document defines the initial repository boundaries.

## Architecture boundaries

### apps/client
Responsibilities:
- Render board, hand, turn controls, match UI.
- Keep presentation state separate from game rules.
- Consume server snapshots/events.

### apps/server
Responsibilities:
- Matchmaking/lobby orchestration.
- Authoritative match execution.
- Persistence hooks (profiles, economy, progression).

### apps/admin-tools
Responsibilities:
- Content management workflows.
- Balance and economy configuration.
- Moderation controls.

### packages/game-core
Responsibilities:
- Pure deterministic game rules.
- Turn/day resolution and ability validation.
- Hidden tie-break logic for equal speed heroes.

### packages/game-data
Responsibilities:
- Load and validate static content.
- Hero/card/companion schemas.
- Rotation and ruleset selection.

### packages/shared-types
Responsibilities:
- Shared contracts for API/events/state snapshots.
- Validation-friendly serializable structures.

### packages/match-simulation
Responsibilities:
- Offline balance simulation.
- Bot policy harness.
- Regression scenarios for economy/meta checks.
