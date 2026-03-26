import type { GameState, GameAction } from "@darms/shared-types";
import { CompanionId, HEROES } from "@darms/shared-types";
import { createRng, type Rng } from "./rng.js";
import { initDraft, draftPick, companionPick } from "./draft.js";
import { buildTurnOrder, takeIncome, buildDistrict, advanceTurn, currentPlayer } from "./turns.js";
import { useAbility } from "./abilities.js";
import { generateRandomCard, generateDifferentColorCard } from "./deck.js";

function addLog(state: GameState, message: string): GameState {
  return { ...state, log: [...state.log, { day: state.day, message }] };
}

/** Check if a companion is functional (not disabled by Saboteur) */
function companionActive(state: GameState, playerIdx: number): boolean {
  const p = state.players[playerIdx];
  return !!p.companion && !p.companionDisabled && !p.assassinated;
}

/** Get the hero color for a player */
function getHeroColor(state: GameState, playerIdx: number): string | null {
  const hero = state.players[playerIdx].hero;
  if (!hero) return null;
  const def = HEROES.find((h) => h.id === hero);
  return def?.color ?? null;
}

/**
 * Apply companion ability during turns.
 */
function useCompanion(
  state: GameState,
  playerId: string,
  targetPlayerId?: string,
  targetCardId?: string,
): GameState | null {
  const rng = createRng(state.rng);
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;
  const player = state.players[playerIdx];
  if (player.companionUsed || !player.companion) return null;
  if (player.assassinated) return null;
  if (player.companionDisabled) return null;

  const newPlayers = [...state.players];
  let newDeck = state.deck;
  let newState = state;

  switch (player.companion) {
    case CompanionId.Farmer: {
      newPlayers[playerIdx] = { ...player, gold: player.gold + 1, companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers, rng: rng.getSeed() }, `${player.name} — фермер приносит +1 золото`), rng: rng.getSeed() };
    }

    case CompanionId.Hunter: {
      // Costs 2 gold, target opponent discards 2 random cards
      if (player.gold < 2) return null;
      if (!targetPlayerId) return null;
      const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
      if (targetIdx === -1 || targetIdx === playerIdx) return null;
      const target = state.players[targetIdx];
      const targetHand = [...target.hand];
      const discarded: string[] = [];
      for (let i = 0; i < 2 && targetHand.length > 0; i++) {
        const idx = rng.int(0, targetHand.length - 1);
        discarded.push(targetHand[idx].name);
        targetHand.splice(idx, 1);
      }
      newPlayers[playerIdx] = { ...player, gold: player.gold - 2, companionUsed: true };
      newPlayers[targetIdx] = { ...target, hand: targetHand };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — охотник: ${target.name} сбросил ${discarded.length} карт`), rng: rng.getSeed() };
    }

    case CompanionId.Mason: {
      // Costs 1 gold, splits most expensive card in hand into two
      if (player.gold < 1) return null;
      if (player.hand.length === 0) return null;
      const sorted = [...player.hand].sort((a, b) => b.cost - a.cost);
      const expensive = sorted[0];
      const handWithout = player.hand.filter((c) => c.id !== expensive.id);

      let card1, card2;
      if (expensive.cost <= 1) {
        // Cost 1: generate two random 1-cost cards
        card1 = generateRandomCard(1, rng);
        card2 = generateRandomCard(1, rng);
      } else {
        // Split: e.g. 5→2+3, 4→2+2, 3→1+2, 2→1+1
        const half = Math.floor(expensive.cost / 2);
        const other = expensive.cost - half;
        card1 = generateRandomCard(half, rng);
        card2 = generateRandomCard(other, rng);
      }
      newPlayers[playerIdx] = {
        ...player,
        gold: player.gold - 1,
        hand: [...handWithout, card1, card2],
        companionUsed: true,
      };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — каменщик: ${expensive.name} (${expensive.cost}) → ${card1.cost} + ${card2.cost}`), rng: rng.getSeed() };
    }

    case CompanionId.Saboteur: {
      // Disable target player's companion for this day
      if (!targetPlayerId) return null;
      const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
      if (targetIdx === -1 || targetIdx === playerIdx) return null;
      const target = state.players[targetIdx];
      newPlayers[playerIdx] = { ...player, companionUsed: true };
      newPlayers[targetIdx] = { ...target, companionDisabled: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — диверсант: компаньон ${target.name} отключён!`), rng: rng.getSeed() };
    }

    case CompanionId.Blacksmith: {
      // Swap a district on any player's table for another of same cost, different color
      if (!targetPlayerId || !targetCardId) return null;
      const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
      if (targetIdx === -1) return null;
      const target = { ...state.players[targetIdx] };
      const cardIdx = target.builtDistricts.findIndex((c) => c.id === targetCardId);
      if (cardIdx === -1) return null;
      const oldCard = target.builtDistricts[cardIdx];
      const newCard = generateDifferentColorCard(oldCard.cost, oldCard.colors.filter((c) => c !== "purple"), rng);
      newCard.hp = oldCard.cost; // fresh HP

      const newDistricts = [...target.builtDistricts];
      newDistricts[cardIdx] = newCard;

      // Check if new card is a duplicate on that player's table
      const isDuplicate = newDistricts.filter((d) => d.name === newCard.name).length > 1;
      let goldBonus = 0;
      if (isDuplicate) goldBonus = 3;

      newPlayers[targetIdx] = { ...target, builtDistricts: newDistricts };
      newPlayers[playerIdx] = { ...player, gold: player.gold + goldBonus, companionUsed: true };
      const bonusMsg = goldBonus > 0 ? ` (+${goldBonus}💰 дубликат!)` : "";
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — кузнец: ${oldCard.name} → ${newCard.name} у ${target.name}${bonusMsg}`), rng: rng.getSeed() };
    }

    case CompanionId.Bard: {
      // Remove target player's companion. Cost = 1 + bardUsageCount
      const cost = 1 + state.bardUsageCount;
      if (player.gold < cost) return null;
      if (!targetPlayerId) return null;
      const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
      if (targetIdx === -1 || targetIdx === playerIdx) return null;
      const target = state.players[targetIdx];
      if (!target.companion) return null;
      newPlayers[playerIdx] = { ...player, gold: player.gold - cost, companionUsed: true };
      newPlayers[targetIdx] = { ...target, companion: null, companionUsed: true };
      return {
        ...addLog({ ...state, players: newPlayers }, `${player.name} — бард: убрал компаньона у ${target.name} за ${cost}💰`),
        bardUsageCount: state.bardUsageCount + 1,
        rng: rng.getSeed(),
      };
    }

    case CompanionId.Alchemist: {
      // Upgrade own built district to random +1 cost (max 5)
      if (!targetCardId) return null;
      const cardIdx = player.builtDistricts.findIndex((c) => c.id === targetCardId);
      if (cardIdx === -1) return null;
      const oldCard = player.builtDistricts[cardIdx];
      if (oldCard.cost >= 5) return null; // already max
      const newCost = oldCard.cost + 1;
      const newCard = generateRandomCard(newCost, rng);
      newCard.hp = newCost;
      const newDistricts = [...player.builtDistricts];
      newDistricts[cardIdx] = newCard;
      newPlayers[playerIdx] = { ...player, builtDistricts: newDistricts, companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — алхимик: ${oldCard.name} (${oldCard.cost}) → ${newCard.name} (${newCost})`), rng: rng.getSeed() };
    }

    // Passive companions — should not be used via action
    case CompanionId.Treasurer:
    case CompanionId.Official:
    case CompanionId.SunPriestess:
    case CompanionId.Courier:
    case CompanionId.RoyalGuard:
    case CompanionId.Swindler:
    case CompanionId.Artist:
    case CompanionId.Druid:
    case CompanionId.Marauder:
      return null;

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
      return useCompanion(state, action.playerId, action.targetPlayerId, action.targetCardId);

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
