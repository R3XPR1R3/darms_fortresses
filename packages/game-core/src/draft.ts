import type { DraftState, GameState } from "@darms/shared-types";
import { HeroId, HEROES, CompanionId, COMPANIONS } from "@darms/shared-types";
import type { Rng } from "./rng.js";

const ALL_HEROES: HeroId[] = Object.values(HeroId);

/**
 * Initialize the draft for a new day.
 *
 * Flow (4 players):
 *   1. Shuffle all 8 heroes
 *   2. Auto-ban: 1 face-up + 1 face-down (unless Royal Guard overrides)
 *   3. Sequential picks based on crown order
 *   4. All players sequentially pick 1 companion from a pool of 3
 *
 * Royal Guard modifier: if a player has royalGuardDraft flag,
 *   no initial auto-ban — first drafter picks from all 8,
 *   then 2 are auto-banned (1 up + 1 down).
 */
export function initDraft(state: GameState, rng: Rng): GameState {
  const heroes = [...ALL_HEROES];
  rng.shuffle(heroes);

  // Check if any player has Royal Guard draft modifier
  const hasRoyalGuard = state.players.some((p) => p.royalGuardDraft);

  let faceUpBans: HeroId[] = [];
  let faceDownBans: HeroId[] = [];

  if (!hasRoyalGuard) {
    // Normal: auto-ban before draft: first card face-up, second face-down
    const faceUpBan = heroes.pop()!;
    const faceDownBan = heroes.pop()!;
    faceUpBans = [faceUpBan];
    faceDownBans = [faceDownBan];
  }
  // If Royal Guard: no initial bans, all 8 heroes available

  // Draft order: starting from crown holder, clockwise
  // If Royal Guard player exists, they go first
  const playerCount = state.players.length;
  const draftOrder: number[] = [];

  if (hasRoyalGuard) {
    // Royal Guard player(s) draft first, then normal order
    const rgIdx = state.players.findIndex((p) => p.royalGuardDraft);
    draftOrder.push(rgIdx);
    for (let i = 0; i < playerCount; i++) {
      const idx = (state.crownHolder + i) % playerCount;
      if (idx !== rgIdx) draftOrder.push(idx);
    }
  } else {
    for (let i = 0; i < playerCount; i++) {
      draftOrder.push((state.crownHolder + i) % playerCount);
    }
  }

  const draft: DraftState = {
    availableHeroes: heroes,
    faceUpBans,
    faceDownBans,
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
    // Reset hero assignments and companion state
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
      companionDisabled: false,
      royalGuardDraft: false, // consumed
    })),
  };
}

/** Get the hero color for a player */
function getPlayerHeroColor(state: GameState, playerIdx: number): string | null {
  const hero = state.players[playerIdx].hero;
  if (!hero) return null;
  return HEROES.find((h) => h.id === hero)?.color ?? null;
}

/**
 * Check if a companion can be picked by a player (hero color restriction).
 * Color-restricted companions can only be picked by heroes of matching color.
 */
function canPickCompanion(companionId: CompanionId, heroColor: string | null): boolean {
  const def = COMPANIONS.find((c) => c.id === companionId);
  if (!def?.heroColor) return true; // no restriction
  return def.heroColor === heroColor;
}

/**
 * Generate a shared pool of 3 companion choices for the sequential draft.
 * Shuffles all 16 companions and picks 3 unique ones.
 */
function generateCompanionPool(rng: Rng, banned: CompanionId[] = []): CompanionId[] {
  const excluded = new Set(banned);
  const allCompanions = COMPANIONS.map((c) => c.id).filter((id) => !excluded.has(id));
  const shuffled = [...allCompanions];
  rng.shuffle(shuffled);
  return shuffled.slice(0, 3);
}

/**
 * Pick a replacement companion for the pool, avoiding already-in-pool and already-picked companions.
 */
function pickReplacementCompanion(
  currentPool: CompanionId[],
  alreadyPicked: CompanionId[],
  rng: Rng,
  banned: CompanionId[] = [],
): CompanionId | null {
  const excluded = new Set([...currentPool, ...alreadyPicked, ...banned]);
  const available = COMPANIONS.map((c) => c.id).filter((id) => !excluded.has(id));
  if (available.length === 0) return null;
  rng.shuffle(available);
  return available[0];
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
    // Last player picked — auto-ban remaining cards
    rng.shuffle(remaining);

    // Royal Guard mode: after first pick, ban 2 (1 up, 1 down)
    // Normal mode: ban remaining 2
    const hasRoyalGuard = remaining.length > 2;

    let finalFaceUp: HeroId[] = [];
    let finalFaceDown: HeroId[] = [];

    if (hasRoyalGuard && remaining.length >= 2) {
      // Royal Guard: ban 1 up + 1 down from remaining, rest stay banned
      finalFaceUp = remaining.slice(0, 1);
      finalFaceDown = remaining.slice(1, 2);
      // Any extras also go to face-down bans
      if (remaining.length > 2) {
        finalFaceDown = [...finalFaceDown, ...remaining.slice(2)];
      }
    } else {
      finalFaceUp = remaining[0] ? [remaining[0]] : [];
      finalFaceDown = remaining[1] ? [remaining[1]] : [];
    }

    // Skip companion draft before day 4
    if (state.day < 4) {
      return {
        ...state,
        players: newPlayers,
        draft: {
          ...draft,
          availableHeroes: [],
          faceUpBans: [...draft.faceUpBans, ...finalFaceUp],
          faceDownBans: [...draft.faceDownBans, ...finalFaceDown],
          currentStep: draft.draftOrder.length, // mark draft as done
          companionChoices: null,
          draftPhase: "hero",
        },
        phase: "turns",
        rng: rng.getSeed(),
      };
    }

    // Move to companion draft phase (day 4+)
    const companionPool = generateCompanionPool(rng, state.bannedCompanions);

    return {
      ...state,
      players: newPlayers,
      draft: {
        ...draft,
        availableHeroes: [],
        faceUpBans: [...draft.faceUpBans, ...finalFaceUp],
        faceDownBans: [...draft.faceDownBans, ...finalFaceDown],
        currentStep: 0, // reset step for companion draft
        companionChoices: [companionPool],
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
 * Process a companion pick during draft (sequential, same order as hero draft).
 * After a companion is picked, it's removed from the pool and replaced with a new one.
 * Color-restricted companions can only be picked by heroes of matching color.
 */
export function companionPick(
  state: GameState,
  playerId: string,
  companionId: CompanionId,
  rng: Rng,
): GameState | null {
  const draft = state.draft;
  if (!draft || state.phase !== "draft") return null;
  if (draft.draftPhase !== "companion") return null;

  // Check it's this player's turn (sequential)
  const expectedPlayerIdx = draft.draftOrder[draft.currentStep];
  if (expectedPlayerIdx === undefined) return null;
  const player = state.players[expectedPlayerIdx];
  if (player.id !== playerId) return null;

  // Check companion is in the offered pool
  const pool = draft.companionChoices?.[0];
  if (!pool || !pool.includes(companionId)) return null;

  // Check hero color restriction
  const heroColor = getPlayerHeroColor(state, expectedPlayerIdx);
  if (!canPickCompanion(companionId, heroColor)) return null;

  // Collect already-picked companions (for replacement exclusion)
  const alreadyPicked = state.players
    .filter((p) => p.companion !== null)
    .map((p) => p.companion!);
  alreadyPicked.push(companionId);

  const newPlayers = [...state.players];
  newPlayers[expectedPlayerIdx] = { ...newPlayers[expectedPlayerIdx], companion: companionId };

  // Remove picked companion from pool and add a replacement
  let newPool = pool.filter((c) => c !== companionId);
  const replacement = pickReplacementCompanion(newPool, alreadyPicked, rng, state.bannedCompanions);
  if (replacement) newPool.push(replacement);

  const nextStep = draft.currentStep + 1;
  const allPicked = nextStep >= draft.draftOrder.length;

  if (allPicked) {
    return {
      ...state,
      players: newPlayers,
      draft: { ...draft, companionChoices: null, currentStep: nextStep },
      phase: "turns",
      rng: rng.getSeed(),
    };
  }

  return {
    ...state,
    players: newPlayers,
    draft: { ...draft, companionChoices: [newPool], currentStep: nextStep },
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
