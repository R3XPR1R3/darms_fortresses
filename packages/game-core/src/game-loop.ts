import type { GameState, GameAction, DistrictCard } from "@darms/shared-types";
import { CompanionId, COMPANIONS, HEROES, HeroId, FLAME_CARD_NAME, PURPLE_CARD_TEMPLATES, MAX_HAND_CARDS, WIN_DISTRICTS } from "@darms/shared-types";
import { createRng, type Rng } from "./rng.js";
import { initDraft, draftPick, companionPick, companionSkip } from "./draft.js";
import { buildTurnOrder, takeIncome, pickIncomeCard, buildDistrict, advanceTurn, currentPlayer, canAddDistrict, pushBuiltDistrict, markCompanionGone } from "./turns.js";
import { createPurpleFromAbility } from "./setup.js";
import { playPurplePlaceholder, pickFromPurpleOffer } from "./placeholder.js";
import { useAbility, checkWinCondition } from "./abilities.js";
import { generateRandomCard, generateDifferentColorCard, generateCard } from "./deck.js";

function addLog(state: GameState, message: string): GameState {
  return { ...state, log: [...state.log, { day: state.day, message }] };
}

function enforceHandLimit(state: GameState): GameState {
  let changed = false;
  const players = state.players.map((p) => {
    if (p.hand.length <= MAX_HAND_CARDS) return p;
    changed = true;
    const overflow = p.hand.length - MAX_HAND_CARDS;
    return { ...p, hand: p.hand.slice(0, MAX_HAND_CARDS), __overflow: overflow } as typeof p & { __overflow?: number };
  });
  if (!changed) return state;

  let log = state.log;
  const normalized = players.map((p) => {
    const overflow = (p as { __overflow?: number }).__overflow ?? 0;
    if (overflow > 0) {
      log = [...log, { day: state.day, message: `💥 ${p.name}: ${overflow} карт(ы) рассыпались (лимит руки ${MAX_HAND_CARDS})` }];
    }
    const { __overflow, ...plain } = p as typeof p & { __overflow?: number };
    return plain;
  });
  return { ...state, players: normalized, log };
}

/** Check if a companion is functional (not disabled by Saboteur) */
function companionActive(state: GameState, playerIdx: number): boolean {
  const p = state.players[playerIdx];
  return !!p.companion && !p.companionDisabled && !p.assassinated;
}

/** Generate a random purple building (from the 11-card registry). */
function randomPurpleBuilding(rng: Rng): DistrictCard | null {
  const tpl = PURPLE_CARD_TEMPLATES[rng.int(0, PURPLE_CARD_TEMPLATES.length - 1)];
  if (!tpl) return null;
  const card = createPurpleFromAbility(tpl.ability);
  return card;
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
      const newCost = targetDist.cost - 2;
      const newOppDistricts = [...opp.builtDistricts];
      let discardPile = state.discardPile;
      let msg: string;
      if (newCost < 1) {
        newOppDistricts.splice(distIdx, 1);
        discardPile = [...discardPile, targetDist];
        msg = `${player.name} — канонир: сжёг ${burnedCard.name}, разрушил ${targetDist.name} у ${opp.name}!`;
      } else {
        newOppDistricts[distIdx] = { ...targetDist, cost: newCost, hp: newCost };
        msg = `${player.name} — канонир: сжёг ${burnedCard.name}, повредил ${targetDist.name} у ${opp.name} (${targetDist.cost}→${newCost})`;
      }
      newPlayers[playerIdx] = { ...player, hand: newHand, companionUsed: true };
      newPlayers[oppPick.i] = { ...opp, builtDistricts: newOppDistricts };
      return { ...addLog({ ...state, players: newPlayers, discardPile }, msg), rng: rng.getSeed() };
    }

    case CompanionId.Reconstructor: {
      // For 2 gold, builds a destroyed district from discard pile. Leaves pool.
      if (player.gold < 2) return null;
      if (!canAddDistrict(player)) return null;
      if (state.discardPile.length === 0) return null;
      const pile = [...state.discardPile];
      const pickIdx = rng.int(0, pile.length - 1);
      const rebuilt = { ...pile[pickIdx], hp: pile[pickIdx].cost };
      pile.splice(pickIdx, 1);
      newPlayers[playerIdx] = markCompanionGone(
        pushBuiltDistrict({ ...player, gold: player.gold - 2, companionUsed: true }, rebuilt),
        CompanionId.Reconstructor,
      );
      let s = addLog({ ...state, players: newPlayers, discardPile: pile }, `${player.name} — реконструктор: восстановил ${rebuilt.name}!`);
      s = { ...s, rng: rng.getSeed() };
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
      recolorPlayers[playerIdx] = markCompanionGone(
        { ...recolorPlayers[playerIdx], companionUsed: true },
        CompanionId.DubiousDealer,
      );
      let s = addLog({ ...state, players: recolorPlayers }, `${player.name} — сомнительный делец: всё стало ${newColor}!`);
      s = { ...s, rng: rng.getSeed() };
      return s;
    }

    case CompanionId.SorcererApprentice: {
      // For 2 gold, builds a random discarded district
      if (player.gold < 2) return null;
      if (!canAddDistrict(player)) return null;
      if (state.discardPile.length === 0) return null;
      const pile = [...state.discardPile];
      const pickIdx = rng.int(0, pile.length - 1);
      const built = { ...pile[pickIdx], hp: pile[pickIdx].cost };
      pile.splice(pickIdx, 1);
      newPlayers[playerIdx] = pushBuiltDistrict(
        { ...player, gold: player.gold - 2, companionUsed: true },
        built,
      );
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
      newPlayers[playerIdx] = markCompanionGone(
        { ...player, hand: newHand, gold: player.gold + sold.cost, companionUsed: true },
        CompanionId.StrangeMerchant,
      );
      let s = addLog({ ...state, players: newPlayers }, `${player.name} — странный торговец: продал ${sold.name} за ${sold.cost}💰`);
      s = { ...s, rng: rng.getSeed() };
      return s;
    }

    case CompanionId.Pyromancer: {
      // Burns a random card from any chosen player's hand (revealed or not).
      // The Pyromancer's owner picks the target player (targetPlayerId) — the
      // burned card is rolled randomly from that player's hand to keep things
      // hidden if the target hasn't acted yet. Replaces the rolled card with 🔥 Flame.
      if (!targetPlayerId) return null;
      const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
      if (targetIdx === -1) return null;
      const target = state.players[targetIdx];
      if (target.hand.length === 0) return null;
      const cardIdx = rng.int(0, target.hand.length - 1);
      const burned = target.hand[cardIdx];
      const newTargetHand = [...target.hand];
      const flameCard: DistrictCard = {
        id: `flame-${Date.now()}-${rng.int(0, 9999)}`,
        name: FLAME_CARD_NAME,
        cost: 2,
        originalCost: 2,
        hp: 0,
        colors: ["red"],
        baseColors: ["red"],
      };
      newTargetHand[cardIdx] = flameCard;
      newPlayers[targetIdx] = { ...target, hand: newTargetHand };
      newPlayers[playerIdx] = { ...newPlayers[playerIdx], companionUsed: true };
      const targetIsSelf = targetIdx === playerIdx;
      const msg = targetIsSelf
        ? `${player.name} — пиромант: ${burned.name} → ${FLAME_CARD_NAME}`
        : `${player.name} — пиромант: подбросил ${FLAME_CARD_NAME} в руку ${target.name}`;
      return { ...addLog({ ...state, players: newPlayers }, msg), rng: rng.getSeed() };
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
      // Replacement is picked from the target's OWN personal pool (available slots, excluding their current pick).
      const alternatives = nextPlayer.companionDeck
        .filter((s) => s.state === "available" && s.id !== nextPlayer.companion)
        .map((s) => s.id);
      let newCompanion: CompanionId | null = null;
      if (alternatives.length > 0) {
        newCompanion = alternatives[rng.int(0, alternatives.length - 1)];
      }
      newPlayers[playerIdx] = { ...player, gold: player.gold - 2, companionUsed: true };
      if (newCompanion) {
        newPlayers[nextIdx] = { ...nextPlayer, companion: newCompanion, companionUsed: false };
      }
      const cName = newCompanion ? (COMPANIONS.find((c) => c.id === newCompanion)?.name ?? "?") : "ничего";
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — фанатик солнца: заменил компаньона ${nextPlayer.name} на ${cName}`), rng: rng.getSeed() };
    }

    case CompanionId.Sniper: {
      // Permanently removes target player's companion from THEIR personal pool.
      if (!targetPlayerId) return null;
      const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
      if (targetIdx === -1 || targetIdx === playerIdx) return null;
      const target = state.players[targetIdx];
      if (!target.companion) return null;
      const removedId = target.companion;
      const removedName = COMPANIONS.find((c) => c.id === removedId)?.name ?? "?";
      newPlayers[playerIdx] = { ...player, companionUsed: true };
      newPlayers[targetIdx] = markCompanionGone(
        { ...target, companion: null, companionUsed: true },
        removedId,
      );
      return {
        ...addLog({ ...state, players: newPlayers }, `${player.name} — снайпер: навсегда убрал ${removedName} у ${target.name}!`),
        rng: rng.getSeed(),
      };
    }

    case CompanionId.Fisherman: {
      // For 1 gold, builds a random cost-2 district (allows duplicates)
      if (player.gold < 1) return null;
      if (!canAddDistrict(player)) return null;
      const newCard = generateRandomCard(2, rng);
      newCard.hp = 2;
      newPlayers[playerIdx] = pushBuiltDistrict(
        { ...player, gold: player.gold - 1, companionUsed: true },
        newCard,
      );
      let s = addLog({ ...state, players: newPlayers }, `${player.name} — рыбак: построил ${newCard.name} (2💰)`);
      s = { ...s, rng: rng.getSeed() };
      return checkWinCondition(s);
    }

    case CompanionId.UnluckyMage: {
      // "Unlucky" because the sacrificed card is chosen AT RANDOM from hand —
      // the player has no say. All own built districts then take on the
      // sacrificed card's IDENTITY (name, colors, purpleAbility, spellAbility),
      // but each district KEEPS ITS OWN current cost / HP / value. Otherwise
      // sacrificing an 8-cost City Gates from hand would inflate every cheap
      // district to 8 score, and the companion turns into a strict upgrade
      // instead of the debuff it's labelled as. With the cap, the alt-win
      // path (sacrifice an altar to convert all districts into altars) still
      // works and counts toward the 4-altar win, but you don't multiply value.
      if (player.hand.length === 0) return null;
      const cardIdx = rng.int(0, player.hand.length - 1);
      const template = player.hand[cardIdx];
      const newHand = [...player.hand];
      newHand.splice(cardIdx, 1);
      const newDistricts = player.builtDistricts.map((d) => ({
        id: d.id,
        cost: d.cost,                              // preserve own current value
        hp: d.cost,                                // legacy alias kept in sync
        originalCost: d.originalCost ?? d.cost,    // keep refund baseline
        name: template.name,
        colors: [...template.colors],
        baseColors: template.baseColors ? [...template.baseColors] : [...template.colors],
        purpleAbility: template.purpleAbility,
        spellAbility: template.spellAbility,
      }));
      newPlayers[playerIdx] = { ...player, hand: newHand, builtDistricts: newDistricts, companionUsed: true };
      let s = addLog({ ...state, players: newPlayers }, `${player.name} — неудачный маг: случайно сброшена ${template.name}, все постройки стали ей!`);
      s = { ...s, rng: rng.getSeed() };
      return checkWinCondition(s);
    }

    case CompanionId.Designer: {
      // Convert a chosen own district into a random purple building immediately.
      if (!targetCardId) return null;
      const cardIdx = player.builtDistricts.findIndex((c) => c.id === targetCardId);
      if (cardIdx === -1) return null;
      const oldCard = player.builtDistricts[cardIdx];
      const newCard = randomPurpleBuilding(rng);
      if (!newCard) return null;
      const newDistricts = [...player.builtDistricts];
      newDistricts[cardIdx] = { ...newCard, hp: newCard.cost };
      newPlayers[playerIdx] = { ...player, builtDistricts: newDistricts, companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — дизайнер: ${oldCard.name} → ${newCard.name}`), rng: rng.getSeed() };
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
      newPlayers[playerIdx] = markCompanionGone(
        { ...(newPlayers[playerIdx] ?? player), companionUsed: true },
        CompanionId.Peacemaker,
      );
      const msg = destroyed.length > 0 ? `разрушил: ${destroyed.join(", ")}` : "ничего не разрушено";
      let s = addLog({ ...state, players: newPlayers, discardPile }, `${player.name} — миротворец: ${msg}`);
      s = { ...s, rng: rng.getSeed() };
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
      // Contractor names any hero except face-up bans, Assassin, and already-revealed heroes.
      if (!targetHeroId) return null;
      if (targetHeroId === HeroId.Assassin) return null;
      const faceUpBans = state.draft?.faceUpBans ?? [];
      if (faceUpBans.includes(targetHeroId)) return null;
      // Exclude heroes that already had their turn (revealed)
      if (state.turnOrder) {
        const targetPlayerIdx = state.players.findIndex((p) => p.hero === targetHeroId);
        if (targetPlayerIdx !== -1) {
          const posInOrder = state.turnOrder.indexOf(targetPlayerIdx);
          if (posInOrder !== -1 && posInOrder <= state.currentTurnIndex) return null;
        }
      }
      newPlayers[playerIdx] = { ...player, contractorTargetHeroId: targetHeroId, companionUsed: true };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — заказчик: цель назначена`), rng: rng.getSeed() };
    }

    case CompanionId.TreasureTrader: {
      // Gain a random purple building in hand. Leaves pool.
      const purple = randomPurpleBuilding(rng);
      if (!purple) return null;
      newPlayers[playerIdx] = markCompanionGone(
        { ...player, hand: [...player.hand, purple], companionUsed: true },
        CompanionId.TreasureTrader,
      );
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — торговец сокровищами: получена ${purple.name}`), rng: rng.getSeed() };
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
  const finish = (next: GameState | null): GameState | null => {
    if (!next) return null;
    return enforceHandLimit(next);
  };

  switch (action.type) {
    case "draft_pick": {
      const result = draftPick(state, action.playerId, action.heroId, rng);
      if (!result) return null;
      // If draft just ended (phase switched to turns), build turn order
      if (result.phase === "turns") {
        return finish(buildTurnOrder(result, rng));
      }
      return finish(result);
    }
    case "companion_pick": {
      const result = companionPick(state, action.playerId, action.companionId, rng);
      if (!result) return null;
      if (result.phase === "turns") {
        return finish(buildTurnOrder(result, rng));
      }
      return finish(result);
    }
    case "companion_skip": {
      const result = companionSkip(state, action.playerId, rng);
      if (!result) return null;
      if (result.phase === "turns") {
        return finish(buildTurnOrder(result, rng));
      }
      return finish(result);
    }
    case "purple_placeholder_play": {
      return finish(playPurplePlaceholder(state, action.playerId, action.cardId, rng));
    }
    case "purple_placeholder_pick": {
      return finish(pickFromPurpleOffer(state, action.playerId, action.offerIndex));
    }
    case "income":
      return finish(takeIncome(state, action.playerId, action.choice));
    case "income_pick":
      return finish(pickIncomeCard(state, action.playerId, action.cardId));

    case "build": {
      return finish(buildDistrict(state, action.playerId, action.cardId, action.targetCardId));
    }

    case "ability":
      return finish(useAbility(state, action.playerId, action.ability, rng));

    case "use_companion":
      return finish(useCompanion(state, action.playerId, action.targetPlayerId, action.targetCardId, action.targetHeroId));

    case "activate_building":
      return finish(activateBuilding(state, action.playerId, action.cardId, rng));

    case "end_turn":
      return finish(advanceTurn(state, rng));

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
      const newCost = dist.cost - 1;
      const newOppDistricts = [...target.builtDistricts];
      let discardPile = state.discardPile;
      let msg: string;
      if (newCost < 1) {
        newOppDistricts.splice(distIdx, 1);
        discardPile = [...discardPile, dist];
        msg = `${player.name} — пушка: разрушил ${dist.name} у ${target.name}!`;
      } else {
        newOppDistricts[distIdx] = { ...dist, cost: newCost, hp: newCost };
        msg = `${player.name} — пушка: ${dist.name} у ${target.name} ${dist.cost}→${newCost}`;
      }
      newPlayers[playerIdx] = { ...player, gold: player.gold - 1 };
      newPlayers[opp.i] = { ...target, builtDistricts: newOppDistricts };
      return { ...addLog({ ...state, players: newPlayers, discardPile }, msg), rng: rng.getSeed() };
    }
    case "cult": {
      // Can be used only by Cleric. Once per turn.
      if (player.hero !== HeroId.Cleric) return null;
      if (player.activatedBuildings?.includes(card.id)) return null;
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
      newPlayers[playerIdx] = {
        ...newPlayers[playerIdx] ?? player,
        activatedBuildings: [...(player.activatedBuildings ?? []), card.id],
      };
      return {
        ...addLog(
          { ...state, players: newPlayers },
          `🕯️ ${player.name} активировал Секту: ${replaced.name} у ${target.name} превращён в Секту`,
        ),
        rng: rng.getSeed(),
      };
    }

    case "crypt": {
      // Self-destroy for 2 gold — get 2 random purple buildings.
      if (player.gold < 2) return null;
      const newDistricts = [...player.builtDistricts];
      newDistricts.splice(cardIdx, 1);
      const purpleCards: DistrictCard[] = [];
      for (let i = 0; i < 2; i++) {
        const pc = randomPurpleBuilding(rng);
        if (pc) purpleCards.push(pc);
      }
      newPlayers[playerIdx] = {
        ...player,
        gold: player.gold - 2,
        builtDistricts: newDistricts,
        hand: [...player.hand, ...purpleCards],
      };
      return { ...addLog({ ...state, players: newPlayers }, `${player.name} — склеп: уничтожен, получено 2 фиолетовые постройки`), rng: rng.getSeed() };
    }

    case "tnt_storage": {
      // Self-destroy for 2 gold — deals 8 total damage spread across the
      // surviving districts of EVERY player (TNT-Storage owner included for
      // post-self-destroy ones), one point at a time. Strongholds are immune
      // and never picked. If all damageable districts are wiped before the 8
      // points are spent, the rest is wasted (no overflow). This replaces the
      // old "kill 2 random districts each" rule which was too swingy.
      if (player.gold < 2) return null;
      const newDistricts = [...player.builtDistricts];
      newDistricts.splice(cardIdx, 1);
      newPlayers[playerIdx] = { ...player, gold: player.gold - 2, builtDistricts: newDistricts };
      let discardPile = [...state.discardPile, card];
      let log = state.log;

      // Track damage distribution per (player, district id) for log readability.
      const totalDamage = 8;
      const losses: Map<number, string[]> = new Map();
      for (let dmg = 0; dmg < totalDamage; dmg++) {
        // Build a fresh candidate list each tick so destroyed districts vanish.
        const pool: Array<{ pIdx: number; dIdx: number }> = [];
        for (let i = 0; i < newPlayers.length; i++) {
          const districts = newPlayers[i].builtDistricts;
          for (let j = 0; j < districts.length; j++) {
            if (districts[j].purpleAbility === "stronghold") continue;
            pool.push({ pIdx: i, dIdx: j });
          }
        }
        if (pool.length === 0) break;
        const pick = pool[rng.int(0, pool.length - 1)];
        const owner = newPlayers[pick.pIdx];
        const dList = [...owner.builtDistricts];
        const target = dList[pick.dIdx];
        const newCost = target.cost - 1;
        if (newCost < 1) {
          dList.splice(pick.dIdx, 1);
          discardPile = [...discardPile, target];
          const arr = losses.get(pick.pIdx) ?? [];
          arr.push(target.name);
          losses.set(pick.pIdx, arr);
        } else {
          dList[pick.dIdx] = { ...target, cost: newCost, hp: newCost };
        }
        newPlayers[pick.pIdx] = { ...owner, builtDistricts: dList };
      }

      // Log per-player destruction summary; survivors with damage are reflected
      // in their cost/HP so no extra log line is needed for them.
      losses.forEach((names, pIdx) => {
        log = [...log, { day: state.day, message: `🧨 ${newPlayers[pIdx].name} потерял: ${names.join(", ")}` }];
      });
      log = [...log, { day: state.day, message: `🧨 ${player.name} взорвал Склад тротила: ${totalDamage} урона распределено между постройками` }];
      return { ...state, players: newPlayers, discardPile, log, rng: rng.getSeed() };
    }

    default:
      return null;
  }
}

export { currentPlayer };
