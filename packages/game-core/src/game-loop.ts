import type { GameState, GameAction } from "@darms/shared-types";
import { createRng, type Rng } from "./rng.js";
import { initDraft, draftPick } from "./draft.js";
import { buildTurnOrder, takeIncome, buildDistrict, advanceTurn, currentPlayer } from "./turns.js";
import { useAbility } from "./abilities.js";

/**
 * High-level game loop: processes a single action and returns new state.
 * Maintains its own Rng from the state seed.
 */
export function processAction(state: GameState, action: GameAction): GameState | null {
  const rng = createRng(state.rng);

  switch (action.type) {
    case "draft_pick": {
      const result = draftPick(state, action.playerId, action.heroId, rng);
      if (!result) return null;
      // If draft just ended (phase switched to turns), build turn order
      if (result.phase === "turns") {
        return buildTurnOrder(result, rng);
      }
      return result;
    }
    case "income":
      return takeIncome(state, action.playerId, action.choice);

    case "build":
      return buildDistrict(state, action.playerId, action.cardId);

    case "ability":
      return useAbility(state, action.playerId, action.ability, rng);

    case "end_turn":
      return advanceTurn(state, rng);

    default:
      return null;
  }
}

/** Start a new day's draft */
export function startDraft(state: GameState): GameState {
  const rng = createRng(state.rng);
  return initDraft(state, rng);
}

export { currentPlayer };
