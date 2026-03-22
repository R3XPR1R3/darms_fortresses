import type { GameState } from "@darms/shared-types";
import { HEROES } from "@darms/shared-types";
import type { Rng } from "./rng.js";

/**
 * Build the turn order for the current day based on hero speeds.
 * Lower speed = goes first. Ties broken randomly.
 */
export function buildTurnOrder(state: GameState, rng: Rng): GameState {
  const indexed = state.players
    .map((p, i) => ({ idx: i, hero: p.hero }))
    .filter((p) => p.hero !== null && !state.players[p.idx].assassinated);

  // Sort by hero speed, random tiebreak
  indexed.sort((a, b) => {
    const speedA = HEROES.find((h) => h.id === a.hero)!.speed;
    const speedB = HEROES.find((h) => h.id === b.hero)!.speed;
    if (speedA !== speedB) return speedA - speedB;
    return rng.next() - 0.5; // random tiebreak
  });

  return {
    ...state,
    turnOrder: indexed.map((p) => p.idx),
    currentTurnIndex: 0,
    rng: rng.getSeed(),
  };
}

/**
 * Process income action: take 1 gold OR draw 1 card from deck.
 */
export function takeIncome(
  state: GameState,
  playerId: string,
  choice: "card" | "gold",
): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;

  const player = state.players[playerIdx];
  if (player.incomeTaken) return null; // already took income

  if (choice === "gold") {
    const newPlayers = [...state.players];
    newPlayers[playerIdx] = {
      ...player,
      gold: player.gold + 1,
      incomeTaken: true,
    };
    return { ...state, players: newPlayers };
  }

  // Draw a card
  if (state.deck.length === 0) return null; // no cards left

  const newDeck = [...state.deck];
  const drawn = newDeck.shift()!;
  const newPlayers = [...state.players];
  newPlayers[playerIdx] = {
    ...player,
    hand: [...player.hand, drawn],
    incomeTaken: true,
  };

  return { ...state, players: newPlayers, deck: newDeck };
}

/**
 * Build a district from hand. Costs gold equal to card cost.
 * Default: 1 build per turn (Architect gets up to 3 via hero ability).
 */
export function buildDistrict(
  state: GameState,
  playerId: string,
  cardId: string,
): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;

  const player = state.players[playerIdx];
  if (player.hasBuilt) return null; // already built (non-architect)

  const cardIdx = player.hand.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) return null; // card not in hand

  const card = player.hand[cardIdx];
  if (player.gold < card.cost) return null; // can't afford

  // Check for duplicate built district
  if (player.builtDistricts.some((d) => d.name === card.name)) return null;

  const newHand = [...player.hand];
  newHand.splice(cardIdx, 1);

  const newPlayers = [...state.players];
  newPlayers[playerIdx] = {
    ...player,
    gold: player.gold - card.cost,
    hand: newHand,
    builtDistricts: [...player.builtDistricts, card],
    hasBuilt: true,
  };

  return { ...state, players: newPlayers };
}

/**
 * Advance to the next player's turn, or end the day if all done.
 */
export function advanceTurn(state: GameState): GameState {
  if (!state.turnOrder) return state;

  const nextIdx = state.currentTurnIndex + 1;
  if (nextIdx >= state.turnOrder.length) {
    // Day is over — go back to draft for next day
    return {
      ...state,
      phase: "draft",
      currentTurnIndex: 0,
      turnOrder: null,
      day: state.day + 1,
    };
  }

  return { ...state, currentTurnIndex: nextIdx };
}

/** Get the player index whose turn it is, or null */
export function currentPlayer(state: GameState): number | null {
  if (state.phase !== "turns" || !state.turnOrder) return null;
  if (state.currentTurnIndex >= state.turnOrder.length) return null;
  return state.turnOrder[state.currentTurnIndex];
}
