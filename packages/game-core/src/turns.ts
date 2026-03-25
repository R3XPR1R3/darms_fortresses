import type { GameState } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS } from "@darms/shared-types";
import type { Rng } from "./rng.js";
import { applyPassiveAbility, checkWinCondition, calculateScores } from "./abilities.js";

/**
 * Build the turn order for the current day based on hero speeds.
 * Lower speed = goes first. Ties broken randomly.
 * Also resets per-turn state and applies passive abilities for first player.
 */
export function buildTurnOrder(state: GameState, rng: Rng): GameState {
  const indexed = state.players
    .map((p, i) => ({ idx: i, hero: p.hero }))
    .filter((p) => p.hero !== null && !state.players[p.idx].assassinated);

  indexed.sort((a, b) => {
    const speedA = HEROES.find((h) => h.id === a.hero)!.speed;
    const speedB = HEROES.find((h) => h.id === b.hero)!.speed;
    if (speedA !== speedB) return speedA - speedB;
    return rng.next() - 0.5;
  });

  // Reset per-turn state
  const newPlayers = state.players.map((p) => ({
    ...p,
    incomeTaken: false,
    buildsRemaining: p.hero === HeroId.Architect ? 3 : 1,
    abilityUsed: false,
  }));

  let newState: GameState = {
    ...state,
    players: newPlayers,
    turnOrder: indexed.map((p) => p.idx),
    currentTurnIndex: 0,
    rng: rng.getSeed(),
  };

  // Apply passive ability for the first player
  if (indexed.length > 0) {
    newState = applyPassiveAbility(newState, indexed[0].idx, rng);
  }

  return newState;
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
  if (player.assassinated) return null;
  if (player.incomeTaken) return null;

  if (choice === "gold") {
    const newPlayers = [...state.players];
    newPlayers[playerIdx] = {
      ...player,
      gold: player.gold + 1,
      incomeTaken: true,
    };
    return { ...state, players: newPlayers };
  }

  if (state.deck.length === 0) return null;

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
 * Architect can build up to 3 per turn, others 1.
 */
export function buildDistrict(
  state: GameState,
  playerId: string,
  cardId: string,
): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;

  const player = state.players[playerIdx];
  if (player.assassinated) return null;
  if (player.buildsRemaining <= 0) return null;

  const cardIdx = player.hand.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) return null;

  const card = player.hand[cardIdx];
  if (player.gold < card.cost) return null;

  if (player.builtDistricts.some((d) => d.name === card.name)) return null;

  const newHand = [...player.hand];
  newHand.splice(cardIdx, 1);

  const newPlayers = [...state.players];
  newPlayers[playerIdx] = {
    ...player,
    gold: player.gold - card.cost,
    hand: newHand,
    builtDistricts: [...player.builtDistricts, card],
    buildsRemaining: player.buildsRemaining - 1,
  };

  let newState = { ...state, players: newPlayers };
  newState = checkWinCondition(newState);
  return newState;
}

/**
 * Advance to the next player's turn, or end the day if all done.
 */
export function advanceTurn(state: GameState, rng: Rng): GameState {
  if (!state.turnOrder) return state;

  const turnOrder = state.turnOrder;
  let nextIdx = state.currentTurnIndex + 1;
  let log = state.log;

  // Skip assassinated players — but still process theft against them
  let players = [...state.players];
  while (nextIdx < turnOrder.length && players[turnOrder[nextIdx]].assassinated) {
    const killedIdx = turnOrder[nextIdx];
    const killed = players[killedIdx];
    const killedHeroName = HEROES.find((h) => h.id === killed.hero)?.name ?? "???";
    log = [...log, { day: state.day, message: `💀 ${killedHeroName} (${killed.name}) был убит! Ход пропущен.` }];

    // Thief still steals from assassinated players
    const thiefIdx = players.findIndex(
      (p) => p.hero === HeroId.Thief && p.robbedHeroId === killed.hero,
    );
    if (thiefIdx !== -1 && killed.gold > 0) {
      const stolenGold = killed.gold;
      players = [...players];
      players[killedIdx] = { ...killed, gold: 0 };
      players[thiefIdx] = { ...players[thiefIdx], gold: players[thiefIdx].gold + stolenGold };
      log = [...log, { day: state.day, message: `${players[thiefIdx].name} украл ${stolenGold} золота у убитого ${killed.name}` }];
    }

    nextIdx++;
  }
  state = { ...state, players, log };

  if (nextIdx >= turnOrder.length) {
    // Re-check: if a player was marked finishedFirst but districts were destroyed
    // below the threshold, clear the flag — the game continues
    let playersCheck = [...state.players];
    let flagCleared = false;
    for (let i = 0; i < playersCheck.length; i++) {
      if (playersCheck[i].finishedFirst && playersCheck[i].builtDistricts.length < WIN_DISTRICTS) {
        playersCheck[i] = { ...playersCheck[i], finishedFirst: false };
        flagCleared = true;
      }
    }
    if (flagCleared) {
      state = { ...state, players: playersCheck };
    }

    const someoneFinished = state.players.some((p) => p.finishedFirst && p.builtDistricts.length >= WIN_DISTRICTS);
    if (someoneFinished) {
      return calculateScores({ ...state, log });
    }

    // Day is over — go back to draft for next day
    return {
      ...state,
      log,
      phase: "draft",
      draft: null,
      currentTurnIndex: 0,
      turnOrder: null,
      day: state.day + 1,
    };
  }

  // Apply passive for next player
  const nextPlayerIdx = turnOrder[nextIdx];
  let newState: GameState = { ...state, log, currentTurnIndex: nextIdx };
  newState = applyPassiveAbility(newState, nextPlayerIdx, rng);

  return newState;
}

/** Get the player index whose turn it is, or null */
export function currentPlayer(state: GameState): number | null {
  if (state.phase !== "turns" || !state.turnOrder) return null;
  if (state.currentTurnIndex >= state.turnOrder.length) return null;
  return state.turnOrder[state.currentTurnIndex];
}
