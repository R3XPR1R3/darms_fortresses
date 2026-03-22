import type { GameState, AbilityPayload, PlayerState, LogEntry } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS } from "@darms/shared-types";
import type { Rng } from "./rng.js";

function addLog(state: GameState, message: string): LogEntry[] {
  return [...state.log, { day: state.day, message }];
}

function findPlayerByHero(players: PlayerState[], heroId: HeroId): number {
  return players.findIndex((p) => p.hero === heroId);
}

/**
 * Apply passive hero bonuses at the start of a player's turn.
 * Called automatically when a player begins their turn.
 */
export function applyPassiveAbility(state: GameState, playerIdx: number, rng: Rng): GameState {
  const player = state.players[playerIdx];
  if (!player.hero) return state;

  const newPlayers = [...state.players];
  let log = state.log;
  let newCrownHolder = state.crownHolder;
  let newDeck = state.deck;

  // Check if this hero was targeted by thief
  const thiefIdx = state.players.findIndex(
    (p) => p.hero === HeroId.Thief && p.robbedHeroId === player.hero,
  );
  if (thiefIdx !== -1 && player.gold > 0) {
    const stolenGold = player.gold;
    newPlayers[playerIdx] = { ...player, gold: 0 };
    newPlayers[thiefIdx] = {
      ...state.players[thiefIdx],
      gold: state.players[thiefIdx].gold + stolenGold,
    };
    log = addLog({ ...state, log }, `${state.players[thiefIdx].name} украл ${stolenGold} золота у ${player.name}`);
    // Re-read player after modification
  }

  const p = newPlayers[playerIdx];

  switch (player.hero) {
    case HeroId.King: {
      const yellowCount = p.builtDistricts.filter((d) =>
        d.colors.includes("yellow"),
      ).length;
      if (yellowCount > 0) {
        newPlayers[playerIdx] = { ...p, gold: p.gold + yellowCount };
        log = addLog({ ...state, log }, `${p.name} (Король) +${yellowCount} золота за жёлтые кварталы`);
      }
      newCrownHolder = playerIdx;
      break;
    }
    case HeroId.Cleric: {
      const blueCount = p.builtDistricts.filter((d) =>
        d.colors.includes("blue"),
      ).length;
      if (blueCount > 0) {
        newPlayers[playerIdx] = { ...p, gold: p.gold + blueCount };
        log = addLog({ ...state, log }, `${p.name} (Клерик) +${blueCount} золота за синие кварталы`);
      }
      break;
    }
    case HeroId.Merchant: {
      const greenCount = p.builtDistricts.filter((d) =>
        d.colors.includes("green"),
      ).length;
      const bonus = greenCount + 1; // +1 passive bonus
      newPlayers[playerIdx] = { ...p, gold: p.gold + bonus };
      log = addLog({ ...state, log }, `${p.name} (Торговец) +${bonus} золота (${greenCount} зелёных +1 бонус)`);
      break;
    }
    case HeroId.Architect: {
      // Draw 2 extra cards
      newDeck = [...state.deck];
      const drawn = newDeck.splice(0, Math.min(2, newDeck.length));
      newPlayers[playerIdx] = {
        ...p,
        hand: [...p.hand, ...drawn],
        buildsRemaining: 3,
      };
      if (drawn.length > 0) {
        log = addLog({ ...state, log }, `${p.name} (Архитектор) берёт ${drawn.length} карты, может строить до 3`);
      }
      break;
    }
    case HeroId.General: {
      const redCount = p.builtDistricts.filter((d) =>
        d.colors.includes("red"),
      ).length;
      if (redCount > 0) {
        newPlayers[playerIdx] = { ...p, gold: p.gold + redCount };
        log = addLog({ ...state, log }, `${p.name} (Генерал) +${redCount} золота за красные кварталы`);
      }
      break;
    }
    default:
      break;
  }

  return {
    ...state,
    players: newPlayers,
    crownHolder: newCrownHolder,
    deck: newDeck,
    log,
  };
}

/**
 * Execute an active hero ability.
 */
export function useAbility(
  state: GameState,
  playerId: string,
  ability: AbilityPayload,
  rng: Rng,
): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;
  const player = state.players[playerIdx];
  if (player.abilityUsed) return null;

  const newPlayers = [...state.players];
  let log = state.log;
  let newDeck = state.deck;

  switch (ability.hero) {
    case "assassin": {
      if (player.hero !== HeroId.Assassin) return null;
      const targetIdx = findPlayerByHero(state.players, ability.targetHeroId);
      if (targetIdx !== -1) {
        newPlayers[targetIdx] = { ...state.players[targetIdx], assassinated: true };
        log = addLog({ ...state, log }, `${player.name} убил ${HEROES.find((h) => h.id === ability.targetHeroId)!.name}`);
      }
      newPlayers[playerIdx] = { ...newPlayers[playerIdx], abilityUsed: true };
      break;
    }
    case "thief": {
      if (player.hero !== HeroId.Thief) return null;
      // Can't target assassin or self
      if (ability.targetHeroId === HeroId.Thief || ability.targetHeroId === HeroId.Assassin) return null;
      newPlayers[playerIdx] = { ...player, robbedHeroId: ability.targetHeroId, abilityUsed: true };
      log = addLog({ ...state, log }, `${player.name} собирается обокрасть ${HEROES.find((h) => h.id === ability.targetHeroId)!.name}`);
      break;
    }
    case "sorcerer": {
      if (player.hero !== HeroId.Sorcerer) return null;
      if (ability.mode === "draw") {
        // Draw 2 cards
        newDeck = [...state.deck];
        const drawn = newDeck.splice(0, Math.min(2, newDeck.length));
        newPlayers[playerIdx] = {
          ...player,
          hand: [...player.hand, ...drawn],
          abilityUsed: true,
        };
        log = addLog({ ...state, log }, `${player.name} (Чародей) взял 2 карты`);
      } else {
        // Swap hands
        const targetIdx = state.players.findIndex((p) => p.id === ability.targetPlayerId);
        if (targetIdx === -1 || targetIdx === playerIdx) return null;
        const targetHand = [...state.players[targetIdx].hand];
        const myHand = [...player.hand];
        newPlayers[playerIdx] = { ...player, hand: targetHand, abilityUsed: true };
        newPlayers[targetIdx] = { ...state.players[targetIdx], hand: myHand };
        log = addLog({ ...state, log }, `${player.name} (Чародей) обменялся рукой с ${state.players[targetIdx].name}`);
      }
      break;
    }
    case "general": {
      if (player.hero !== HeroId.General) return null;
      const targetIdx = state.players.findIndex((p) => p.id === ability.targetPlayerId);
      if (targetIdx === -1 || targetIdx === playerIdx) return null;

      const target = state.players[targetIdx];
      const cardIdx = target.builtDistricts.findIndex((c) => c.id === ability.cardId);
      if (cardIdx === -1) return null;

      const card = target.builtDistricts[cardIdx];

      // Cleric's districts are immune to destruction
      if (target.hero === HeroId.Cleric) return null;

      // Cost to destroy = card cost
      if (player.gold < card.cost) return null;

      const newTargetDistricts = [...target.builtDistricts];
      newTargetDistricts.splice(cardIdx, 1);

      newPlayers[playerIdx] = { ...player, gold: player.gold - card.cost, abilityUsed: true };
      newPlayers[targetIdx] = { ...target, builtDistricts: newTargetDistricts };
      log = addLog({ ...state, log }, `${player.name} (Генерал) разрушил ${card.name} у ${target.name} за ${card.cost} золота`);
      break;
    }
    // Passive abilities — no active action needed
    case "king":
    case "cleric":
    case "merchant":
    case "architect":
      newPlayers[playerIdx] = { ...player, abilityUsed: true };
      break;
    default:
      return null;
  }

  return { ...state, players: newPlayers, deck: newDeck, log };
}

/** Check if any player has reached 8 districts (win condition) */
export function checkWinCondition(state: GameState): GameState {
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.builtDistricts.length >= WIN_DISTRICTS && !p.finishedFirst) {
      const newPlayers = [...state.players];
      newPlayers[i] = { ...p, finishedFirst: true };
      return {
        ...state,
        players: newPlayers,
        log: addLog(state, `${p.name} построил ${WIN_DISTRICTS} кварталов! Последний день.`),
      };
    }
  }
  return state;
}

/** Calculate final scores and determine winner. Called at end of last day. */
export function calculateScores(state: GameState): GameState {
  let maxScore = -1;
  let winnerIdx = -1;

  const log = [...state.log];

  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    let score = 0;

    // Sum of district costs
    for (const d of p.builtDistricts) {
      score += d.cost;
    }

    // Bonus for finishing first
    if (p.finishedFirst) score += 4;

    // Bonus for having all 4 colors
    const colors = new Set(p.builtDistricts.flatMap((d) => d.colors));
    if (colors.has("yellow") && colors.has("blue") && colors.has("green") && colors.has("red")) {
      score += 3;
    }

    log.push({ day: state.day, message: `${p.name}: ${score} очков` });

    if (score > maxScore) {
      maxScore = score;
      winnerIdx = i;
    }
  }

  return {
    ...state,
    winner: winnerIdx,
    phase: "end",
    log,
  };
}
