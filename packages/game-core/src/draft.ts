import type { DraftState, GameState } from "@darms/shared-types";
import { HeroId, CompanionId, COMPANIONS } from "@darms/shared-types";
import type { Rng } from "./rng.js";

const ALL_HEROES: HeroId[] = Object.values(HeroId);

/**
 * Initialize the draft for a new day.
 *
 * Flow (4 players):
 *   1. Shuffle all 8 heroes
 *   2. Auto-ban: 1 face-up + 1 face-down (random, no player choice)
 *   3. P1 (crown holder) picks 1 of 6
 *   4. P2 picks 1 of 5
 *   5. P3 picks 1 of 4
 *   6. P4 picks 1 of 3, then remaining 2 auto-ban (1 up + 1 down)
 *   7. All players simultaneously pick 1 companion from 3 offered
 */
export function initDraft(state: GameState, rng: Rng): GameState {
  const heroes = [...ALL_HEROES];
  rng.shuffle(heroes);

  // Auto-ban before draft: first card face-up, second face-down
  const faceUpBan = heroes.pop()!;
  const faceDownBan = heroes.pop()!;

  // Draft order: starting from crown holder, clockwise
  const playerCount = state.players.length;
  const draftOrder: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    draftOrder.push((state.crownHolder + i) % playerCount);
  }

  const draft: DraftState = {
    availableHeroes: heroes, // 6 remaining
    faceUpBans: [faceUpBan],
    faceDownBans: [faceDownBan],
    draftOrder,
    currentStep: 0,
    companionChoices: null,
    draftPhase: "hero",
  };

  return {
    ...state,
    phase: "draft",
    draft,
    rng: rng.getSeed(),
    // Reset hero assignments
    players: state.players.map((p) => ({
      ...p,
      hero: null,
      assassinated: false,
      robbedHeroId: null,
      incomeTaken: false,
      buildsRemaining: 0,
      abilityUsed: false,
      companion: null,
      companionUsed: false,
    })),
  };
}

/**
 * Generate companion choices for all players (3 per player).
 * For now there's only 1 companion, so all get [Farmer, Farmer, Farmer].
 * When more companions are added, this will randomly offer 3 distinct ones.
 */
function generateCompanionChoices(playerCount: number, _rng: Rng): CompanionId[][] {
  const allCompanions = COMPANIONS.map((c) => c.id);
  const choices: CompanionId[][] = [];
  for (let i = 0; i < playerCount; i++) {
    // Offer 3 choices — pad with duplicates if not enough companions yet
    const pool = [...allCompanions];
    while (pool.length < 3) pool.push(allCompanions[0]);
    choices.push(pool.slice(0, 3));
  }
  return choices;
}

/**
 * Process a hero pick during draft.
 * Returns new state, or null if the pick is invalid.
 */
export function draftPick(
  state: GameState,
  playerId: string,
  heroId: HeroId,
  rng: Rng,
): GameState | null {
  const draft = state.draft;
  if (!draft || state.phase !== "draft") return null;
  if (draft.draftPhase !== "hero") return null;

  // Check it's this player's turn
  const expectedPlayerIdx = draft.draftOrder[draft.currentStep];
  const player = state.players[expectedPlayerIdx];
  if (player.id !== playerId) return null;

  // Check hero is available
  if (!draft.availableHeroes.includes(heroId)) return null;

  const remaining = draft.availableHeroes.filter((h) => h !== heroId);
  const nextStep = draft.currentStep + 1;

  // Update player's hero
  const newPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, hero: heroId } : p,
  );

  // Check if hero draft is complete (all players have picked)
  const isLastPick = nextStep >= draft.draftOrder.length;

  if (isLastPick) {
    // Last player picked — auto-ban remaining 2 cards (1 up, 1 down)
    rng.shuffle(remaining);
    const finalFaceUp = remaining[0];
    const finalFaceDown = remaining[1];

    // Move to companion draft phase
    const companionChoices = generateCompanionChoices(state.players.length, rng);

    return {
      ...state,
      players: newPlayers,
      draft: {
        ...draft,
        availableHeroes: [],
        faceUpBans: [...draft.faceUpBans, ...(finalFaceUp ? [finalFaceUp] : [])],
        faceDownBans: [...draft.faceDownBans, ...(finalFaceDown ? [finalFaceDown] : [])],
        currentStep: 0, // reset step for companion draft
        companionChoices,
        draftPhase: "companion",
      },
      rng: rng.getSeed(),
    };
  }

  return {
    ...state,
    players: newPlayers,
    draft: {
      ...draft,
      availableHeroes: remaining,
      currentStep: nextStep,
    },
    rng: rng.getSeed(),
  };
}

/**
 * Process a companion pick during draft.
 * All players pick simultaneously — state transitions to turns when all have picked.
 */
export function companionPick(
  state: GameState,
  playerId: string,
  companionId: CompanionId,
  _rng: Rng,
): GameState | null {
  const draft = state.draft;
  if (!draft || state.phase !== "draft") return null;
  if (draft.draftPhase !== "companion") return null;

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;

  // Already picked?
  if (state.players[playerIdx].companion !== null) return null;

  // Check offered
  const offered = draft.companionChoices?.[playerIdx];
  if (!offered || !offered.includes(companionId)) return null;

  const newPlayers = [...state.players];
  newPlayers[playerIdx] = { ...newPlayers[playerIdx], companion: companionId };

  // Check if all players have picked
  const allPicked = newPlayers.every((p) => p.companion !== null);

  if (allPicked) {
    return {
      ...state,
      players: newPlayers,
      draft: { ...draft, companionChoices: null },
      phase: "turns",
      rng: state.rng,
    };
  }

  return {
    ...state,
    players: newPlayers,
  };
}

/** Get the player index whose turn it is to draft, or null if draft is done */
export function currentDrafter(state: GameState): number | null {
  if (state.phase !== "draft" || !state.draft) return null;
  if (state.draft.draftPhase === "companion") return null; // simultaneous
  const step = state.draft.currentStep;
  if (step >= state.draft.draftOrder.length) return null;
  return state.draft.draftOrder[step];
}
