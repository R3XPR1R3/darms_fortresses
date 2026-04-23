import type { DraftState, GameState, CompanionSlot } from "@darms/shared-types";
import { HeroId, HEROES, CompanionId, COMPANIONS } from "@darms/shared-types";
import type { Rng } from "./rng.js";

const ALL_HEROES: HeroId[] = Object.values(HeroId);

function splitBansKeepingLeaderFaceDown(heroes: HeroId[]): { faceUp: HeroId | null; faceDown: HeroId | null } {
  if (heroes.length === 0) return { faceUp: null, faceDown: null };
  if (heroes.length === 1) return { faceUp: null, faceDown: heroes[0] };
  const nonLeaderIdx = heroes.findIndex((h) => h !== HeroId.King);
  if (nonLeaderIdx === -1) {
    return { faceUp: null, faceDown: heroes[0] };
  }
  const faceUp = heroes[nonLeaderIdx];
  const other = heroes.find((_, idx) => idx !== nonLeaderIdx) ?? null;
  return { faceUp, faceDown: other };
}

/**
 * Initialize the draft for a new day.
 */
export function initDraft(state: GameState, rng: Rng): GameState {
  const heroes = [...ALL_HEROES];
  rng.shuffle(heroes);

  const hasRoyalGuard = state.players.some((p) => p.royalGuardDraft);

  let faceUpBans: HeroId[] = [];
  let faceDownBans: HeroId[] = [];

  if (!hasRoyalGuard) {
    const candidates = [heroes.pop()!, heroes.pop()!];
    const split = splitBansKeepingLeaderFaceDown(candidates);
    faceUpBans = split.faceUp ? [split.faceUp] : [];
    faceDownBans = split.faceDown ? [split.faceDown] : [];
  }

  const playerCount = state.players.length;
  const draftOrder: number[] = [];

  if (hasRoyalGuard) {
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
    players: state.players.map((p) => ({
      ...p,
      hero: null,
      assassinated: false,
      robbedHeroId: null,
      incomeTaken: false,
      incomeOffer: null,
      buildsRemaining: 0,
      abilityUsed: false,
      companion: null,
      companionUsed: false,
      companionDisabled: false,
      royalGuardDraft: false,
      pendingPurpleOffer: null,
    })),
  };
}

function getPlayerHeroColor(state: GameState, playerIdx: number): string | null {
  const hero = state.players[playerIdx].hero;
  if (!hero) return null;
  return HEROES.find((h) => h.id === hero)?.color ?? null;
}

/**
 * Check if a companion can be picked by a player (hero color restriction).
 */
function canPickCompanion(companionId: CompanionId, heroColor: string | null): boolean {
  const def = COMPANIONS.find((c) => c.id === companionId);
  if (!def?.heroColor) return true;
  return def.heroColor === heroColor;
}

/** Get the currently-selectable companion IDs for a player (personal pool filtered). */
export function getAvailableCompanionIds(slots: CompanionSlot[]): CompanionId[] {
  return slots.filter((s) => s.state === "available").map((s) => s.id);
}

/** Any available slot can be picked without hero color restriction breaking it? */
function pickableCount(slots: CompanionSlot[], heroColor: string | null): number {
  return slots.filter((s) => s.state === "available" && canPickCompanion(s.id, heroColor)).length;
}

/**
 * After a hero pick completes the hero phase, set up companion phase (or skip to turns).
 */
function afterHeroDraft(state: GameState, draft: DraftState, rng: Rng): GameState {
  if (state.day < 4) {
    return {
      ...state,
      phase: "turns",
      draft: { ...draft, currentStep: draft.draftOrder.length, draftPhase: "hero" },
      rng: rng.getSeed(),
    };
  }

  // Move to companion draft phase (day 4+). Companion choices are derived per step
  // from each player's own pool.
  const firstPlayerIdx = draft.draftOrder[0];
  const firstSlots = state.players[firstPlayerIdx].companionDeck;
  const firstOffer = getAvailableCompanionIds(firstSlots);

  return {
    ...state,
    draft: {
      ...draft,
      currentStep: 0,
      companionChoices: [firstOffer],
      draftPhase: "companion",
    },
    rng: rng.getSeed(),
  };
}

/**
 * Process a hero pick during draft.
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

  const expectedPlayerIdx = draft.draftOrder[draft.currentStep];
  const player = state.players[expectedPlayerIdx];
  if (player.id !== playerId) return null;

  if (!draft.availableHeroes.includes(heroId)) return null;

  const remaining = draft.availableHeroes.filter((h) => h !== heroId);
  const nextStep = draft.currentStep + 1;

  const newPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, hero: heroId } : p,
  );

  const isLastPick = nextStep >= draft.draftOrder.length;

  if (isLastPick) {
    rng.shuffle(remaining);
    const hasRoyalGuard = remaining.length > 2;

    let finalFaceUp: HeroId[] = [];
    let finalFaceDown: HeroId[] = [];

    if (hasRoyalGuard && remaining.length >= 2) {
      const split = splitBansKeepingLeaderFaceDown(remaining.slice(0, 2));
      finalFaceUp = split.faceUp ? [split.faceUp] : [];
      finalFaceDown = split.faceDown ? [split.faceDown] : [];
      if (remaining.length > 2) {
        finalFaceDown = [...finalFaceDown, ...remaining.slice(2)];
      }
    } else {
      const split = splitBansKeepingLeaderFaceDown(remaining.slice(0, 2));
      finalFaceUp = split.faceUp ? [split.faceUp] : [];
      finalFaceDown = split.faceDown ? [split.faceDown] : [];
    }

    const updatedDraft: DraftState = {
      ...draft,
      availableHeroes: [],
      faceUpBans: [...draft.faceUpBans, ...finalFaceUp],
      faceDownBans: [...draft.faceDownBans, ...finalFaceDown],
      currentStep: 0,
      companionChoices: null,
      draftPhase: "hero",
    };

    const baseState: GameState = {
      ...state,
      players: newPlayers,
      draft: updatedDraft,
      rng: rng.getSeed(),
    };

    return afterHeroDraft(baseState, updatedDraft, rng);
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
 * Process a companion pick during draft — from the player's OWN 3-slot pool.
 * Picked slot goes to "sleeping" until end of day.
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

  const expectedPlayerIdx = draft.draftOrder[draft.currentStep];
  if (expectedPlayerIdx === undefined) return null;
  const player = state.players[expectedPlayerIdx];
  if (player.id !== playerId) return null;

  const slotIdx = player.companionDeck.findIndex(
    (s) => s.id === companionId && s.state === "available",
  );
  if (slotIdx === -1) return null;

  const heroColor = getPlayerHeroColor(state, expectedPlayerIdx);
  if (!canPickCompanion(companionId, heroColor)) return null;

  const newPlayers = [...state.players];
  const newSlots = [...player.companionDeck];
  newSlots[slotIdx] = { ...newSlots[slotIdx], state: "sleeping" };
  newPlayers[expectedPlayerIdx] = {
    ...player,
    companion: companionId,
    companionDeck: newSlots,
  };

  return advanceCompanionDraft(state, draft, newPlayers, rng);
}

/**
 * Player explicitly skips companion selection (personal pool exhausted for this day).
 * Only valid when no companion in their slots is both available AND color-pickable.
 */
export function companionSkip(
  state: GameState,
  playerId: string,
  rng: Rng,
): GameState | null {
  const draft = state.draft;
  if (!draft || state.phase !== "draft") return null;
  if (draft.draftPhase !== "companion") return null;

  const expectedPlayerIdx = draft.draftOrder[draft.currentStep];
  if (expectedPlayerIdx === undefined) return null;
  const player = state.players[expectedPlayerIdx];
  if (player.id !== playerId) return null;

  const heroColor = getPlayerHeroColor(state, expectedPlayerIdx);
  if (pickableCount(player.companionDeck, heroColor) > 0) return null;

  const newPlayers = [...state.players];
  newPlayers[expectedPlayerIdx] = { ...player, companion: null };
  return advanceCompanionDraft(state, draft, newPlayers, rng);
}

function advanceCompanionDraft(
  state: GameState,
  draft: DraftState,
  newPlayers: GameState["players"],
  rng: Rng,
): GameState {
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

  const nextPlayerIdx = draft.draftOrder[nextStep];
  const nextOffer = getAvailableCompanionIds(newPlayers[nextPlayerIdx].companionDeck);

  return {
    ...state,
    players: newPlayers,
    draft: { ...draft, companionChoices: [nextOffer], currentStep: nextStep },
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
