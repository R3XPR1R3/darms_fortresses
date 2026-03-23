import type { DraftState, GameState } from "@darms/shared-types";
import { HeroId } from "@darms/shared-types";
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
    })),
  };
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

  // Check if draft is complete (all players have picked)
  const isLastPick = nextStep >= draft.draftOrder.length;

  if (isLastPick) {
    // Last player picked — auto-ban remaining 2 cards (1 up, 1 down)
    rng.shuffle(remaining);
    const finalFaceUp = remaining[0];
    const finalFaceDown = remaining[1];

    return {
      ...state,
      players: newPlayers,
      draft: {
        ...draft,
        availableHeroes: [],
        faceUpBans: [...draft.faceUpBans, ...(finalFaceUp ? [finalFaceUp] : [])],
        faceDownBans: [...draft.faceDownBans, ...(finalFaceDown ? [finalFaceDown] : [])],
        currentStep: nextStep,
      },
      phase: "turns",
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

/** Get the player index whose turn it is to draft, or null if draft is done */
export function currentDrafter(state: GameState): number | null {
  if (state.phase !== "draft" || !state.draft) return null;
  const step = state.draft.currentStep;
  if (step >= state.draft.draftOrder.length) return null;
  return state.draft.draftOrder[step];
}
