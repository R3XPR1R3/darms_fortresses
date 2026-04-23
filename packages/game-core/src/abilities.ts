import type { GameState, AbilityPayload, PlayerState, LogEntry } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS, CompanionId, PURPLE_CARD_TEMPLATES, MAX_HAND_CARDS } from "@darms/shared-types";
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
 * Also applies passive companion bonuses (Artist, Royal Guard).
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
      // City Gates: King auto-builds gates for free at start of their turn.
      const gateIdx = newPlayers[playerIdx].hand.findIndex((d) => d.purpleAbility === "city_gates");
      if (gateIdx !== -1 && newPlayers[playerIdx].builtDistricts.length < WIN_DISTRICTS) {
        const hand = [...newPlayers[playerIdx].hand];
        const card = hand[gateIdx];
        hand.splice(gateIdx, 1);
        const built = { ...card, cost: 8, originalCost: 8, hp: 8 };
        const builtDistricts = [...newPlayers[playerIdx].builtDistricts, built];
        newPlayers[playerIdx] = { ...newPlayers[playerIdx], hand, builtDistricts };
        log = addLog({ ...state, log }, `${p.name} (Лидер) автоматически выставил Врата в город`);
      }
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
        log = addLog({ ...state, log }, `${p.name} (Казначей) +${bonus} золота (${greenCount} зелёных +1 бонус)`);
      break;
    }
    case HeroId.Architect: {
      // Draw 2 extra cards
      newDeck = [...state.deck];
      const drawn = newDeck.splice(0, Math.min(2, newDeck.length));
      const freeSlots = Math.max(0, MAX_HAND_CARDS - p.hand.length);
      const accepted = drawn.slice(0, freeSlots);
      const overflow = drawn.length - accepted.length;
      newPlayers[playerIdx] = {
        ...p,
        hand: [...p.hand, ...accepted],
        buildsRemaining: 3,
      };
      if (drawn.length > 0) {
        log = addLog({ ...state, log }, `${p.name} (Архитектор) берёт ${accepted.length} карты, может строить до 3`);
      }
      if (overflow > 0) {
        log = addLog({ ...state, log }, `💥 ${p.name}: ${overflow} карт(ы) рассыпались (лимит руки ${MAX_HAND_CARDS})`);
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

  // --- Passive companion bonuses ---
  const cp = newPlayers[playerIdx];

  // Artist: all 4 colors on table → +4 gold
  if (cp.companion === CompanionId.Artist && !cp.companionDisabled) {
    const colors = new Set(cp.builtDistricts.flatMap((d) => d.colors));
    if (colors.has("yellow") && colors.has("blue") && colors.has("green") && colors.has("red")) {
      newPlayers[playerIdx] = { ...cp, gold: cp.gold + 4 };
      log = addLog({ ...state, log }, `${cp.name} — художник: все 4 цвета → +4💰`);
    }
  }

  // Royal Guard: +2 gold if has yellow district
  if (cp.companion === CompanionId.RoyalGuard && !cp.companionDisabled) {
    const updated = newPlayers[playerIdx];
    const hasYellow = updated.builtDistricts.some((d) => d.colors.includes("yellow"));
    if (hasYellow) {
      newPlayers[playerIdx] = { ...updated, gold: updated.gold + 2 };
      log = addLog({ ...state, log }, `${updated.name} — королевский страж: +2💰 за жёлтый квартал`);
    }
  }

  // Knight: takes 1 gold from richest, gives to poorest
  if (cp.companion === CompanionId.Knight && !cp.companionDisabled) {
    let richestIdx = -1, poorestIdx = -1;
    let maxGold = -1, minGold = Infinity;
    for (let j = 0; j < newPlayers.length; j++) {
      if (newPlayers[j].gold > maxGold) { maxGold = newPlayers[j].gold; richestIdx = j; }
      if (newPlayers[j].gold < minGold) { minGold = newPlayers[j].gold; poorestIdx = j; }
    }
    if (richestIdx !== -1 && poorestIdx !== -1 && richestIdx !== poorestIdx && maxGold > 0) {
      newPlayers[richestIdx] = { ...newPlayers[richestIdx], gold: newPlayers[richestIdx].gold - 1 };
      newPlayers[poorestIdx] = { ...newPlayers[poorestIdx], gold: newPlayers[poorestIdx].gold + 1 };
      log = addLog({ ...state, log }, `${cp.name} — рыцарь: ${newPlayers[richestIdx].name} −1💰 → ${newPlayers[poorestIdx].name} +1💰`);
    }
  }

  // Nobility: richest gets +1 card, non-richest get -1 card -1 gold
  if (cp.companion === CompanionId.Nobility && !cp.companionDisabled) {
    let maxGold = -1;
    let richestIdx = -1;
    for (let j = 0; j < newPlayers.length; j++) {
      if (newPlayers[j].gold > maxGold) { maxGold = newPlayers[j].gold; richestIdx = j; }
    }
    if (richestIdx !== -1) {
      // Richest gets +1 card
      if (newDeck.length > 0) {
        const drawn = newDeck.splice(0, 1);
        newPlayers[richestIdx] = { ...newPlayers[richestIdx], hand: [...newPlayers[richestIdx].hand, ...drawn] };
      }
      // Non-richest lose 1 card and 1 gold
      for (let j = 0; j < newPlayers.length; j++) {
        if (j === richestIdx) continue;
        const p = newPlayers[j];
        const newHand = [...p.hand];
        if (newHand.length > 0) {
          newHand.splice(rng.int(0, newHand.length - 1), 1);
        }
        newPlayers[j] = { ...p, hand: newHand, gold: Math.max(0, p.gold - 1) };
      }
      log = addLog({ ...state, log }, `${cp.name} — знать: ${newPlayers[richestIdx].name} +1🃏, остальные −1🃏 −1💰`);
    }
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
  if (player.assassinated) return null;
  if (player.abilityUsed) return null;

  const newPlayers = [...state.players];
  let log = state.log;
  let newDeck = state.deck;

  switch (ability.hero) {
    case "assassin": {
      if (player.hero !== HeroId.Assassin) return null;
      // Can only target unrevealed heroes (those who haven't had their turn yet)
      if (ability.targetHeroId === HeroId.Assassin) return null;
      const targetIdx = findPlayerByHero(state.players, ability.targetHeroId);
      const targetHeroName = HEROES.find((h) => h.id === ability.targetHeroId)?.name ?? "???";
      if (targetIdx !== -1) {
        // Check if target hero has already been revealed (had their turn)
        if (state.turnOrder) {
          const posInOrder = state.turnOrder.indexOf(targetIdx);
          if (posInOrder !== -1 && posInOrder <= state.currentTurnIndex) return null;
        }
        newPlayers[targetIdx] = { ...state.players[targetIdx], assassinated: true };

        // Marauder companion: steal victim's cards
        if (player.companion === CompanionId.Marauder && !player.companionDisabled) {
          const victim = state.players[targetIdx];
          if (victim.hand.length > 0) {
            newPlayers[playerIdx] = {
              ...newPlayers[playerIdx],
              hand: [...player.hand, ...victim.hand],
              abilityUsed: true,
            };
            newPlayers[targetIdx] = { ...newPlayers[targetIdx], hand: [] };
          }
        }

        // Contractor companion:
        // if assassin killed the contracted hero target — steal ALL victim's cards.
        if (
          player.companion === CompanionId.Contractor
          && !player.companionDisabled
          && player.contractorTargetHeroId
          && player.contractorTargetHeroId === ability.targetHeroId
        ) {
          const victim = state.players[targetIdx];
          if (victim.hand.length > 0) {
            newPlayers[playerIdx] = {
              ...newPlayers[playerIdx],
              hand: [...(newPlayers[playerIdx].hand ?? player.hand), ...victim.hand],
              abilityUsed: true,
            };
            newPlayers[targetIdx] = { ...newPlayers[targetIdx], hand: [] };
          }
        }

        // Gravedigger companion: gain victim's passive color income
        if (player.companion === CompanionId.Gravedigger && !player.companionDisabled) {
          const victim = state.players[targetIdx];
          const victimHeroDef = victim.hero ? HEROES.find((h) => h.id === victim.hero) : null;
          if (victimHeroDef?.color) {
            const colorCount = player.builtDistricts.filter((d) => d.colors.includes(victimHeroDef.color!)).length;
            if (colorCount > 0) {
              newPlayers[playerIdx] = { ...newPlayers[playerIdx], gold: (newPlayers[playerIdx].gold ?? player.gold) + colorCount };
              newPlayers[playerIdx] = { ...newPlayers[playerIdx], abilityUsed: true };
            }
          }
        }
      }
      log = addLog({ ...state, log }, `🗡️ Убийца выбрал ${targetHeroName}`);
      newPlayers[playerIdx] = { ...newPlayers[playerIdx], abilityUsed: true };
      break;
    }
    case "thief": {
      if (player.hero !== HeroId.Thief) return null;
      // Can't target assassin or self
      if (ability.targetHeroId === HeroId.Thief || ability.targetHeroId === HeroId.Assassin) return null;
      newPlayers[playerIdx] = { ...player, robbedHeroId: ability.targetHeroId, abilityUsed: true };
      log = addLog({ ...state, log }, `${player.name} готовит ограбление...`);
      break;
    }
    case "sorcerer": {
      if (player.hero !== HeroId.Sorcerer) return null;
      if (ability.mode === "draw") {
        // Discard 2 random cards from hand, then draw 2 from deck
        newDeck = [...state.deck];
        let newHand = [...player.hand];
        const discarded: string[] = [];
        for (let i = 0; i < 2 && newHand.length > 0; i++) {
          const idx = rng.int(0, newHand.length - 1);
          discarded.push(newHand[idx].name);
          newHand.splice(idx, 1);
        }
        const drawn = newDeck.splice(0, Math.min(2, newDeck.length));
        const freeSlots = Math.max(0, MAX_HAND_CARDS - newHand.length);
        const accepted = drawn.slice(0, freeSlots);
        const overflow = drawn.length - accepted.length;
        newHand = [...newHand, ...accepted];
        newPlayers[playerIdx] = {
          ...player,
          hand: newHand,
          abilityUsed: true,
        };
        log = addLog({ ...state, log }, `${player.name} (Чародей) сбросил ${discarded.length} карт, взял ${accepted.length}`);
        if (overflow > 0) {
          log = addLog({ ...state, log }, `💥 ${player.name}: ${overflow} карт(ы) рассыпались (лимит руки ${MAX_HAND_CARDS})`);
        }
      } else {
        // Swap hands — can target any player (including assassinated)
        if (!ability.targetPlayerId) return null;
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
      // Stronghold cannot be damaged or destroyed
      if (card.purpleAbility === "stronghold") return null;

      // General spends gold to deal damage to district HP
      if (player.gold < 1) return null;
      const damage = Math.min(player.gold, card.hp);

      const newTargetDistricts = [...target.builtDistricts];
      const newHp = card.hp - damage;

      // Fort: defender's other districts have -1 effective HP, but on destroy gets gold back
      const hasFort = target.builtDistricts.some((d) => d.purpleAbility === "fort" && d.id !== card.id);

      let newDiscardPile = state.discardPile;
      let fortGoldRefund = 0;
      if (newHp < 1) {
        // District destroyed — add to discard pile
        newTargetDistricts.splice(cardIdx, 1);
        newDiscardPile = [...state.discardPile, card];
        // Fort: defender gets gold spent on destruction
        if (hasFort && card.purpleAbility !== "fort") {
          fortGoldRefund = damage;
        }
        log = addLog({ ...state, log }, `${player.name} (Генерал) разрушил ${card.name} у ${target.name} за ${damage} золота`);
        // Crypt: on destroy → owner gets 2 random purple cards
        if (card.purpleAbility === "crypt") {
          const purpleCards: typeof target.hand = [];
          for (let i = 0; i < 2; i++) {
            const tpl = PURPLE_CARD_TEMPLATES[rng.int(0, PURPLE_CARD_TEMPLATES.length - 1)];
            purpleCards.push({
              id: `purple-crypt-${Date.now()}-${rng.int(0, 9999)}`,
              name: tpl.name,
              cost: tpl.cost,
              originalCost: tpl.cost,
              hp: tpl.cost,
              colors: [...tpl.colors] as typeof target.hand[number]["colors"],
              baseColors: [...tpl.colors] as typeof target.hand[number]["colors"],
              purpleAbility: tpl.ability as typeof target.hand[number]["purpleAbility"],
            });
          }
          const updatedTarget = newPlayers[targetIdx] ?? { ...target, builtDistricts: newTargetDistricts };
          newPlayers[targetIdx] = {
            ...target,
            builtDistricts: newTargetDistricts,
            hand: [...updatedTarget.hand ?? target.hand, ...purpleCards],
          };
          log = addLog({ ...state, log }, `⚰️ Склеп ${target.name} разрушен — получено 2 фиолетовые карты`);
        }
      } else {
        // District damaged but survives
        newTargetDistricts[cardIdx] = { ...card, hp: newHp };
        log = addLog({ ...state, log }, `${player.name} (Генерал) повредил ${card.name} у ${target.name} (${card.hp}→${newHp} HP) за ${damage} золота`);
      }

      newPlayers[playerIdx] = { ...player, gold: player.gold - damage, abilityUsed: true };
      newPlayers[targetIdx] = { ...newPlayers[targetIdx] ?? target, builtDistricts: newTargetDistricts, gold: (newPlayers[targetIdx]?.gold ?? target.gold) + fortGoldRefund };
      newDeck = state.deck; // preserve deck
      return { ...state, players: newPlayers, deck: newDeck, discardPile: newDiscardPile, log };
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
    const altarCount = p.builtDistricts.filter((d) =>
      d.purpleAbility === "altar_darkness"
    ).length;
    if (altarCount >= 4 && !p.finishedFirst) {
      const newPlayers = [...state.players];
      newPlayers[i] = { ...p, finishedFirst: true };
      return {
        ...state,
        players: newPlayers,
        log: addLog(state, `${p.name} построил 4 алтаря тьмы! Последний день.`),
      };
    }
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

/** Calculate final scores and determine winner. Called at end of last day.
 *  Scoring: sum of district HP (not cost). */
export function calculateScores(state: GameState): GameState {
  let maxScore = -1;
  let winnerIdx = -1;

  const log = [...state.log];

  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    let score = 0;

    // Sum of district HP (current HP on the table)
    const hasFort = p.builtDistricts.some((d) => d.purpleAbility === "fort");
    for (const d of p.builtDistricts) {
      // Fort: other buildings worth -1
      const fortPenalty = (hasFort && d.purpleAbility !== "fort") ? 1 : 0;
      score += Math.max(0, d.hp - fortPenalty);
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
