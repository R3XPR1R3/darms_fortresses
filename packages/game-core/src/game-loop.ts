import type { GameState, GameAction } from "@darms/shared-types";
import { CompanionId } from "@darms/shared-types";
import { createRng, type Rng } from "./rng.js";
import { initDraft, draftPick, companionPick } from "./draft.js";
import { buildTurnOrder, takeIncome, buildDistrict, advanceTurn, currentPlayer } from "./turns.js";
import { useAbility } from "./abilities.js";

function addLog(state: GameState, message: string): GameState {
  return { ...state, log: [...state.log, { day: state.day, message }] };
}

/**
 * Apply companion ability during turns.
 * Farmer: +1 gold.
 */
function useCompanion(state: GameState, playerId: string): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;
  const player = state.players[playerIdx];
  if (player.companionUsed || !player.companion) return null;
  if (player.assassinated) return null;

  const newPlayers = [...state.players];

  switch (player.companion) {
    case CompanionId.Farmer: {
      newPlayers[playerIdx] = { ...player, gold: player.gold + 1, companionUsed: true };
      return addLog({ ...state, players: newPlayers }, `${player.name} — фермер приносит +1 золото`);
    }
    default:
      return null;
  }
}

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
    case "companion_pick": {
      const result = companionPick(state, action.playerId, action.companionId, rng);
      if (!result) return null;
      // If companion draft just ended (phase switched to turns), build turn order
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

    case "use_companion":
      return useCompanion(state, action.playerId);

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
