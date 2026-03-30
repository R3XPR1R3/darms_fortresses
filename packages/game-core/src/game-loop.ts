import type { GameState, GameAction, DistrictCard } from "@darms/shared-types";
import { CompanionId, COMPANIONS, HEROES, HeroId, FLAME_CARD_NAME, PURPLE_CARD_TEMPLATES } from "@darms/shared-types";
import { createRng, type Rng } from "./rng.js";
import { initDraft, draftPick, companionPick, purpleCardPick } from "./draft.js";
import { buildTurnOrder, takeIncome, pickIncomeCard, buildDistrict, advanceTurn, currentPlayer } from "./turns.js";
import { useAbility, checkWinCondition } from "./abilities.js";
import { generateRandomCard, generateDifferentColorCard, generateCard } from "./deck.js";

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
  targetHeroId?: HeroId,
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
      // Bard can only target unrevealed players in turn phase.
      if (state.turnOrder && state.phase === "turns") {
        const posInOrder = state.turnOrder.indexOf(targetIdx);
        if (posInOrder !== -1 && posInOrder <= state.currentTurnIndex) return null;
      }
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

    case CompanionId.Cannoneer: {
      // Burns a card from hand, lowers HP of a random opponent district by 2
      if (!targetCardId) return null;
      const heroColor = getHeroColor(state, playerIdx);
      if (heroColor !== "red") return null;
      const cardIdx = player.hand.findIndex((c) => c.id === targetCardId);
      if (cardIdx === -1) return null;
      const burnedCard = player.hand[cardIdx];
      const newHand = [...player.hand];
      newHand.splice(cardIdx, 1);

      // Find opponents with built districts
      const opponents = state.players
        .map((p, i) => ({ p, i }))
        .filter((x) => x.i !== playerIdx && x.p.builtDistricts.length > 0 && !x.p.assassinated);
      if (opponents.length === 0) return null;
      const oppPick = opponents[rng.int(0, opponents.length - 1)];
      const opp = state.players[oppPick.i];
      const damageable = opp.builtDistricts
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => d.purpleAbility !== "stronghold");
      if (damageable.length === 0) return null;
      const distIdx = damageable[rng.int(0, damageable.length - 1)].i;
      const targetDist = opp.builtDistricts[distIdx];
      const newHp = targetDist.hp - 2;
      const newOppDistricts = [...opp.builtDistricts];
      let discardPile = state.discardPile;
      let msg: string;
      if (newHp < 1) {
        newOppDistricts.splice(distIdx, 1);
        discardPile = [...discardPile, targetDist];
        msg = `${player.name} — канонир: сжёг ${burnedCard.name}, разрушил ${targetDist.name} у ${opp.name}!`;
      } else {
        newOppDistricts[distIdx] = { ...targetDist, hp: newHp };
        msg = `${player.name} — канонир: сжёг ${burnedCard.name}, повредил ${targetDist.name} у ${opp.name} (HP ${targetDist.hp}→${newHp})`;
      }
      newPlayers[playerIdx] = { ...player, hand: newHand, companionUsed: true };
      newPlayers[oppPick.i] = { ...opp, builtDistricts: newOppDistricts };
      return { ...addLog({ ...state, players: newPlayers, discardPile }, msg), rng: rng.getSeed() };
    }

    case CompanionId.Reconstructor: {
      // For 2 gold, builds a destroyed district from discard pile. Leaves pool.
      if (player.gold < 2) return null;
      if (state.discardPile.length === 0) return null;
      const pile = [...state.discardPile];
      const pickIdx = rng.int(0, pile.length - 1);
      const rebuilt = { ...pile[pickIdx], hp: pile[pickIdx].cost };
      pile.splice(pickIdx, 1);
      newPlayers[playerIdx] = {
        ...player,
        gold: player.gold - 2,
        builtDistricts: [...player.builtDistricts, rebuilt],
        companionUsed: true,
      };
      let s = addLog({ ...state, players: newPlayers, discardPile: pile }, `${player.name} — реконструктор: восстановил ${rebuilt.name}!`);
      s = { ...s, bannedCompanions: [...s.bannedCompanions, CompanionId.Reconstructor], rng: rng.getSeed() };
      return checkWinCondition(s);
    }

    case CompanionId.DubiousDealer: {
      // Recolors all cards and districts to random color. Leaves pool.
      const BASE_COLORS = ["yellow", "blue", "green", "red"] as const;
      const newColor = BASE_COLORS[rng.int(0, 3)];
      const recolor = (cards: DistrictCard[]) => cards.map((c) => ({ ...c, colors: [newColor] as DistrictCard["colors"] }));
      const recolorPlayers = state.players.map((p) => ({
        ...p,
        hand: recolor(p.hand),
        builtDistricts: recolor(p.builtDistricts),
      }));
      recolorPlayers[playerIdx] = { ...recolorPlayers[playerIdx], companionUsed: true };
      let s = addLog({ ...state, players: recolorPlayers }, `${player.name} — сомнительный делец: всё стало ${newColor}!`);
      s = { ...s, bannedCompanions: [...s.bannedCompanions, CompanionId.DubiousDealer], rng: rng.getSeed() };
      return s;
    }

    case CompanionId.SorcererApprentice: {
      // For 2 gold, builds a random discarded district
      if (player.gold < 2) return null;
      if (state.discardPile.length === 0) return null;
      const pile = [...state.discardPile];
      const pickIdx = rng.int(0, pile.length - 1);
      const built = { ...pile[pickIdx], hp: pile[pickIdx].cost };
      pile.splice(pickIdx, 1);
      newPlayers[playerIdx] = {
        ...player,
        gold: player.gold - 2,
        builtDistricts: [...player.builtDistricts, built],
        companionUsed: true,
      };
      let s = addLog({ ...state, players: newPlayers, discardPile: pile }, `${player.name} — ученик чародея: построил ${built.name} из сброса`);
      s = { ...s, rng: rng.getSeed() };
      return checkWinCondition(s);
    }

    case CompanionId.StrangeMerchant: {
      // Discards a card from hand and gets its cost in gold. Green only. Leaves pool.
      if (!targetCardId) return null;
      const heroColor = getHeroColor(state, playerIdx);
      if (heroColor !== "green") return null;
      const cardIdx = player.hand.findIndex((c) => c.id === targetCardId);
      if (cardIdx === -1) return null;
      const sold = player.hand[cardIdx];
      const newHand = [...player.hand];
      newHand.splice(cardIdx, 1);
      newPlayers[playerIdx] = {
        ...player,
        hand: newHand,
        gold: player.gold + sold.cost,
        companionUsed: true,
      };
      let s = addLog({ ...state, players: newPlayers }, `${player.name} — странный торговец: продал ${sold.name} за ${sold.cost}💰`);
      s = { ...s, bannedCompanions: [...s.bannedCompanions, CompanionId.StrangeMerchant], rng: rng.getSeed() };
      return s;
    }

    case CompanionId.Pyromancer: {
      // Burns a card from hand and replaces it with a Flame card
      if (!targetCardId) return null;
      const cardIdx = player.hand.findIndex((c) => c.id === targetCardId);
      if (cardIdx === -1) return null;
      const burned = player.hand[cardIdx];
      const newHand = [...player.hand];
      const flameCard: DistrictCard = {
        id: `flame-${Date.now()}-${rng.int(0, 9999)}`,
        name: FLAME_CARD_NAME,
        cost: 2,
        originalCost: 2,
        hp: 0,
        colors: ["red"],
        baseColors: ["red"],
      };
      newHand[cardIdx] = flameCard;
      newPlayers[playerIdx] = { ...player, hand: newHand, companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — пиромант: ${burned.name} → ${FLAME_CARD_NAME}`), rng: rng.getSeed() };
    }

    case CompanionId.SunFanatic: {
      // For 2 gold: replace next player's companion with a random one. Blue hero only.
      if (player.gold < 2) return null;
      const heroColor = getHeroColor(state, playerIdx);
      if (heroColor !== "blue") return null;
      // Find next player in turn order
      if (!state.turnOrder) return null;
      const myPos = state.turnOrder.indexOf(playerIdx);
      if (myPos === -1) return null;
      let nextIdx = -1;
      for (let i = myPos + 1; i < state.turnOrder.length; i++) {
        if (!state.players[state.turnOrder[i]].assassinated) {
          nextIdx = state.turnOrder[i];
          break;
        }
      }
      if (nextIdx === -1) return null;
      const nextPlayer = state.players[nextIdx];
      // Pick a random replacement companion
      const excluded = new Set(state.players.map((p) => p.companion).filter(Boolean) as CompanionId[]);
      const available = COMPANIONS.map((c) => c.id).filter((id) => !excluded.has(id) && !state.bannedCompanions.includes(id));
      let newCompanion: CompanionId | null = null;
      if (available.length > 0) {
        newCompanion = available[rng.int(0, available.length - 1)];
      }
      newPlayers[playerIdx] = { ...player, gold: player.gold - 2, companionUsed: true };
      if (newCompanion) {
        newPlayers[nextIdx] = { ...nextPlayer, companion: newCompanion, companionUsed: false };
      }
      const cName = newCompanion ? (COMPANIONS.find((c) => c.id === newCompanion)?.name ?? "?") : "ничего";
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — фанатик солнца: заменил компаньона ${nextPlayer.name} на ${cName}`), rng: rng.getSeed() };
    }

    case CompanionId.Sniper: {
      // Permanently removes target player's companion from the pool
      if (!targetPlayerId) return null;
      const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
      if (targetIdx === -1 || targetIdx === playerIdx) return null;
      const target = state.players[targetIdx];
      if (!target.companion) return null;
      const removedId = target.companion;
      const removedName = COMPANIONS.find((c) => c.id === removedId)?.name ?? "?";
      newPlayers[playerIdx] = { ...player, companionUsed: true };
      newPlayers[targetIdx] = { ...target, companion: null, companionUsed: true };
      return {
        ...addLog({ ...state, players: newPlayers }, `${player.name} — снайпер: навсегда убрал ${removedName} у ${target.name}!`),
        bannedCompanions: [...state.bannedCompanions, removedId],
        rng: rng.getSeed(),
      };
    }

    case CompanionId.Fisherman: {
      // For 1 gold, builds a random cost-2 district (allows duplicates)
      if (player.gold < 1) return null;
      const newCard = generateRandomCard(2, rng);
      newCard.hp = 2;
      newPlayers[playerIdx] = {
        ...player,
        gold: player.gold - 1,
        builtDistricts: [...player.builtDistricts, newCard],
        companionUsed: true,
      };
      let s = addLog({ ...state, players: newPlayers }, `${player.name} — рыбак: построил ${newCard.name} (2💰)`);
      s = { ...s, rng: rng.getSeed() };
      return checkWinCondition(s);
    }

    case CompanionId.UnluckyMage: {
      // Discards a card from hand — all own built districts become that card
      if (!targetCardId) return null;
      const cardIdx = player.hand.findIndex((c) => c.id === targetCardId);
      if (cardIdx === -1) return null;
      const template = player.hand[cardIdx];
      const newHand = [...player.hand];
      newHand.splice(cardIdx, 1);
      const newDistricts = player.builtDistricts.map((d) => ({
        ...d,
        name: template.name,
        cost: template.cost,
        colors: template.colors,
        // keep existing hp
      }));
      newPlayers[playerIdx] = { ...player, hand: newHand, builtDistricts: newDistricts, companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — неудачный маг: все постройки стали ${template.name}!`), rng: rng.getSeed() };
    }

    case CompanionId.Designer: {
      // Mark a built district to transform into a purple card at next purple draft
      if (!targetCardId) return null;
      const cardIdx = player.builtDistricts.findIndex((c) => c.id === targetCardId);
      if (cardIdx === -1) return null;
      const markedCard = player.builtDistricts[cardIdx];
      newPlayers[playerIdx] = { ...player, designerMarkedCardId: targetCardId, companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — дизайнер: пометил ${markedCard.name} для превращения`), rng: rng.getSeed() };
    }

    case CompanionId.Innkeeper: {
      // Reveals opponents' purple cards — effect is purely visual (log reveals them)
      const reveals: string[] = [];
      for (let i = 0; i < state.players.length; i++) {
        if (i === playerIdx) continue;
        const p = state.players[i];
        const purples = p.hand.filter((c) => c.colors.includes("purple"));
        if (purples.length > 0) {
          reveals.push(`${p.name}: ${purples.map((c) => c.name).join(", ")}`);
        }
      }
      newPlayers[playerIdx] = { ...player, companionUsed: true };
      const revealMsg = reveals.length > 0 ? reveals.join("; ") : "ни у кого нет фиолетовых карт";
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — трактирщик: ${revealMsg}`), rng: rng.getSeed() };
    }

    case CompanionId.Peacemaker: {
      // Destroy all cannons, TNT storages, and cults on the table (no card effects trigger!)
      let discardPile = [...state.discardPile];
      let log = state.log;
      const destroyed: string[] = [];
      for (let i = 0; i < state.players.length; i++) {
        const p = state.players[i];
        const toRemove = p.builtDistricts.filter((d) =>
          d.purpleAbility === "cannon" || d.purpleAbility === "tnt_storage" || d.purpleAbility === "cult"
        );
        if (toRemove.length > 0) {
          const remaining = p.builtDistricts.filter((d) =>
            d.purpleAbility !== "cannon" && d.purpleAbility !== "tnt_storage" && d.purpleAbility !== "cult"
          );
          discardPile = [...discardPile, ...toRemove];
          newPlayers[i] = { ...newPlayers[i] ?? p, builtDistricts: remaining };
          for (const d of toRemove) destroyed.push(`${d.name} (${p.name})`);
        }
      }
      newPlayers[playerIdx] = { ...newPlayers[playerIdx] ?? player, companionUsed: true };
      const msg = destroyed.length > 0 ? `разрушил: ${destroyed.join(", ")}` : "ничего не разрушено";
      let s = addLog({ ...state, players: newPlayers, discardPile }, `${player.name} — миротворец: ${msg}`);
      s = { ...s, bannedCompanions: [...s.bannedCompanions, CompanionId.Peacemaker], rng: rng.getSeed() };
      return s;
    }

    case CompanionId.NightShadow: {
      // Pay 2g, assassinate an unrevealed hero
      if (player.gold < 2) return null;
      if (!targetHeroId) return null;
      // Can't target self
      if (targetHeroId === player.hero) return null;
      const targetIdx = state.players.findIndex((p) => p.hero === targetHeroId);
      if (targetIdx !== -1) {
        // Check hero hasn't been revealed yet (not had turn)
        if (state.turnOrder) {
          const posInOrder = state.turnOrder.indexOf(targetIdx);
          if (posInOrder !== -1 && posInOrder <= state.currentTurnIndex) return null;
        }
        newPlayers[targetIdx] = { ...state.players[targetIdx], assassinated: true };
      }
      newPlayers[playerIdx] = { ...player, gold: player.gold - 2, companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — ночная тень: убийство за 2💰...`), rng: rng.getSeed() };
    }

    case CompanionId.Contractor: {
      // Set assassin contract target hero for this day.
      if (!targetHeroId) return null;
      if (targetHeroId === player.hero) return null;
      newPlayers[playerIdx] = { ...player, contractorTargetHeroId: targetHeroId, companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — заказчик: цель назначена (${targetHeroId})`), rng: rng.getSeed() };
    }

    case CompanionId.Investor: {
      newPlayers[playerIdx] = { ...player, gold: player.gold + 2, companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — инвестор: +2💰`), rng: rng.getSeed() };
    }

    case CompanionId.Trainer: {
      const roll = rng.int(0, 3);
      // 0 assassin-like, 1 thief-like, 2 sorcerer-like, 3 architect-like
      if (roll === 0) {
        const candidates = state.players
          .map((p, i) => ({ p, i }))
          .filter(({ p, i }) => i !== playerIdx && p.hero && !p.assassinated)
          .filter(({ i }) => {
            if (!state.turnOrder) return true;
            const pos = state.turnOrder.indexOf(i);
            return pos === -1 || pos > state.currentTurnIndex;
          });
        if (candidates.length > 0) {
          const pick = candidates[rng.int(0, candidates.length - 1)];
          newPlayers[pick.i] = { ...newPlayers[pick.i], assassinated: true };
          newPlayers[playerIdx] = { ...newPlayers[playerIdx], companionUsed: true };
          return { ...addLog({ ...state, players: newPlayers }, `${player.name} — тренер: получена способность убийцы`), rng: rng.getSeed() };
        }
      } else if (roll === 1) {
        const candidates = state.players
          .filter((p, i) => i !== playerIdx && p.hero && p.hero !== HeroId.Assassin && !p.assassinated);
        if (candidates.length > 0) {
          const target = candidates[rng.int(0, candidates.length - 1)];
          newPlayers[playerIdx] = { ...newPlayers[playerIdx], robbedHeroId: target.hero, companionUsed: true };
          return { ...addLog({ ...state, players: newPlayers }, `${player.name} — тренер: получена способность вора`), rng: rng.getSeed() };
        }
      } else if (roll === 2) {
        // Sorcerer draw mode
        let newDeck = [...state.deck];
        let hand = [...player.hand];
        for (let i = 0; i < 2 && hand.length > 0; i++) {
          const idx = rng.int(0, hand.length - 1);
          hand.splice(idx, 1);
        }
        const drawn = newDeck.splice(0, Math.min(3, newDeck.length));
        newPlayers[playerIdx] = { ...newPlayers[playerIdx], hand: [...hand, ...drawn], companionUsed: true };
        return { ...addLog({ ...state, players: newPlayers, deck: newDeck }, `${player.name} — тренер: получена способность чародея`), rng: rng.getSeed() };
      } else {
        newPlayers[playerIdx] = { ...newPlayers[playerIdx], buildsRemaining: player.buildsRemaining + 2, companionUsed: true };
        return { ...addLog({ ...state, players: newPlayers }, `${player.name} — тренер: получена способность архитектора`), rng: rng.getSeed() };
      }
      newPlayers[playerIdx] = { ...newPlayers[playerIdx], companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — тренер: эффект не сработал`), rng: rng.getSeed() };
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
    case CompanionId.Gravedigger:
    case CompanionId.Jester:
    case CompanionId.Knight:
    case CompanionId.Nobility:
    case CompanionId.TreasureTrader:
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
    case "purple_card_pick": {
      const result = purpleCardPick(state, action.playerId, action.cardIndex);
      if (!result) return null;
      if (result.phase === "turns" && !result.purpleDraft) {
        return buildTurnOrder(result, rng);
      }
      return result;
    }
    case "income":
      return takeIncome(state, action.playerId, action.choice);
    case "income_pick":
      return pickIncomeCard(state, action.playerId, action.cardId);

    case "build": {
      return buildDistrict(state, action.playerId, action.cardId);
    }

    case "ability":
      return useAbility(state, action.playerId, action.ability, rng);

    case "use_companion":
      return useCompanion(state, action.playerId, action.targetPlayerId, action.targetCardId, action.targetHeroId);

    case "activate_building":
      return activateBuilding(state, action.playerId, action.cardId, rng);

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

/**
 * Activate a purple building on the table.
 */
function activateBuilding(
  state: GameState,
  playerId: string,
  cardId: string,
  rng: Rng,
): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;
  const player = state.players[playerIdx];
  if (player.assassinated) return null;

  const cardIdx = player.builtDistricts.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) return null;
  const card = player.builtDistricts[cardIdx];
  if (!card.purpleAbility) return null;

  const newPlayers = [...state.players];

  switch (card.purpleAbility) {
    case "cannon": {
      // For 1 gold, shoot random opponent district HP-1
      const heroColor = getHeroColor(state, playerIdx);
      if (heroColor !== "red") return null;
      if (player.gold < 1) return null;
      const opponents = state.players
        .map((p, i) => ({ p, i }))
        .filter((x) => x.i !== playerIdx && x.p.builtDistricts.length > 0 && !x.p.assassinated);
      if (opponents.length === 0) return null;
      const opp = opponents[rng.int(0, opponents.length - 1)];
      const target = state.players[opp.i];
      const validTargets = target.builtDistricts
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => d.purpleAbility !== "stronghold");
      if (validTargets.length === 0) return null;
      const distIdx = validTargets[rng.int(0, validTargets.length - 1)].i;
      const dist = target.builtDistricts[distIdx];
      const newHp = dist.hp - 1;
      const newOppDistricts = [...target.builtDistricts];
      let discardPile = state.discardPile;
      let msg: string;
      if (newHp < 1) {
        newOppDistricts.splice(distIdx, 1);
        discardPile = [...discardPile, dist];
        msg = `${player.name} — пушка: разрушил ${dist.name} у ${target.name}!`;
      } else {
        newOppDistricts[distIdx] = { ...dist, hp: newHp };
        msg = `${player.name} — пушка: ${dist.name} у ${target.name} HP ${dist.hp}→${newHp}`;
      }
      newPlayers[playerIdx] = { ...player, gold: player.gold - 1 };
      newPlayers[opp.i] = { ...target, builtDistricts: newOppDistricts };
      return { ...addLog({ ...state, players: newPlayers, discardPile }, msg), rng: rng.getSeed() };
    }
    case "cult": {
      // Can be used only by Cleric. Replaces a random district of a random opponent with cult.
      if (player.hero !== HeroId.Cleric) return null;
      const opponents = state.players
        .map((p, i) => ({ p, i }))
        .filter((x) => x.i !== playerIdx && x.p.builtDistricts.length > 0);
      if (opponents.length === 0) return null;
      const opp = opponents[rng.int(0, opponents.length - 1)];
      const target = state.players[opp.i];
      const distIdx = rng.int(0, target.builtDistricts.length - 1);
      const replaced = target.builtDistricts[distIdx];
      const newOppDistricts = [...target.builtDistricts];
      newOppDistricts[distIdx] = {
        ...card,
        id: `cult-copy-${Date.now()}-${rng.int(0, 9999)}`,
      };
      newPlayers[opp.i] = { ...target, builtDistricts: newOppDistricts };
      return {
        ...addLog(
          { ...state, players: newPlayers },
          `🕯️ ${player.name} активировал Секту: ${replaced.name} у ${target.name} превращён в Секту`,
        ),
        rng: rng.getSeed(),
      };
    }

    case "crypt": {
      // Self-destroy for 2 gold — get 2 random purple cards
      if (player.gold < 2) return null;
      const newDistricts = [...player.builtDistricts];
      newDistricts.splice(cardIdx, 1);
      // Generate 2 random purple cards
      const purpleCards: DistrictCard[] = [];
      for (let i = 0; i < 2; i++) {
        const tpl = PURPLE_CARD_TEMPLATES[rng.int(0, PURPLE_CARD_TEMPLATES.length - 1)];
        purpleCards.push({
          id: `purple-gen-${Date.now()}-${rng.int(0, 9999)}`,
          name: tpl.name,
          cost: tpl.cost,
          originalCost: tpl.cost,
          hp: tpl.cost,
          colors: tpl.colors as DistrictCard["colors"],
          baseColors: tpl.colors as DistrictCard["colors"],
          purpleAbility: tpl.ability,
        });
      }
      newPlayers[playerIdx] = {
        ...player,
        gold: player.gold - 2,
        builtDistricts: newDistricts,
        hand: [...player.hand, ...purpleCards],
      };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — склеп: уничтожен, получено 2 фиолетовые карты`), rng: rng.getSeed() };
    }

    case "tnt_storage": {
      // Self-destroy for 2 gold — destroys 2 random districts for each player
      if (player.gold < 2) return null;
      const newDistricts = [...player.builtDistricts];
      newDistricts.splice(cardIdx, 1);
      newPlayers[playerIdx] = { ...player, gold: player.gold - 2, builtDistricts: newDistricts };
      let discardPile = [...state.discardPile, card];
      let log = state.log;

      for (let i = 0; i < state.players.length; i++) {
        const p = newPlayers[i];
        const pDistricts = [...p.builtDistricts];
        const destroyed: string[] = [];
        for (let d = 0; d < 2 && pDistricts.length > 0; d++) {
          const candidates = pDistricts
            .map((dist, idx) => ({ dist, idx }))
            .filter(({ dist }) => dist.purpleAbility !== "stronghold");
          if (candidates.length === 0) break;
          const idx = candidates[rng.int(0, candidates.length - 1)].idx;
          destroyed.push(pDistricts[idx].name);
          discardPile = [...discardPile, pDistricts[idx]];
          pDistricts.splice(idx, 1);
        }
        if (destroyed.length > 0) {
          newPlayers[i] = { ...newPlayers[i], builtDistricts: pDistricts };
          log = [...log, { day: state.day, message: `🧨 ${p.name} потерял: ${destroyed.join(", ")}` }];
        }
      }
      return { ...state, players: newPlayers, discardPile, log, rng: rng.getSeed() };
    }

    default:
      return null;
  }
}

export { currentPlayer };
