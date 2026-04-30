import type { GameState, AbilityPayload, PlayerState, LogEntry, DistrictCard } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS, CompanionId, PURPLE_CARD_TEMPLATES, MAX_HAND_CARDS } from "@darms/shared-types";
import type { Rng } from "./rng.js";

function addLog(state: GameState, message: string): LogEntry[] {
  return [...state.log, { day: state.day, message }];
}

/**
 * Trigger Salvage Yard payouts when one of player's districts has been destroyed.
 * Counts every salvage_yard the owner has on the table and grants +1🃏 + ⌈cost/2⌉💰
 * per salvage_yard. Pure function — call right after the destruction has been
 * persisted into newPlayers.
 *
 * @param destroyed list of cards that were just destroyed for this owner.
 */
export function applySalvageTriggers(
  state: GameState,
  ownerIdx: number,
  destroyed: DistrictCard[],
): GameState {
  if (destroyed.length === 0) return state;
  const owner = state.players[ownerIdx];
  const salvageCount = owner.builtDistricts.filter((d) => d.purpleAbility === "salvage_yard").length;
  // Salvage Yard triggers even if it itself was the destroyed card — count it in.
  const triggerCount = salvageCount + destroyed.filter((d) => d.purpleAbility === "salvage_yard").length;
  if (triggerCount === 0) return state;

  let newDeck = [...state.deck];
  let goldGained = 0;
  const drawn: DistrictCard[] = [];
  for (const card of destroyed) {
    const goldPerSalvage = Math.ceil(card.cost / 2);
    for (let s = 0; s < triggerCount; s++) {
      goldGained += goldPerSalvage;
      if (newDeck.length > 0) {
        drawn.push(newDeck.shift()!);
      }
    }
  }
  const newPlayers = [...state.players];
  newPlayers[ownerIdx] = {
    ...owner,
    gold: owner.gold + goldGained,
    hand: [...owner.hand, ...drawn],
  };
  const log = [...state.log, {
    day: state.day,
    message: `♻️ ${owner.name} — утиль цех (×${triggerCount}): +${drawn.length}🃏 +${goldGained}💰`,
  }];
  return { ...state, players: newPlayers, deck: newDeck, log };
}

/**
 * When a player gets assassinated, fire any onAssassinated triggers they have:
 *  - Royal Healer companion: +2🃏 +2💰 immediately.
 *  - Hospital is checked at action time, not here (it lets the player still act).
 */
export function applyAssassinatedTriggers(
  state: GameState,
  victimIdx: number,
): GameState {
  const victim = state.players[victimIdx];
  if (!victim) return state;
  let newState = state;
  if (victim.companion === CompanionId.RoyalHealer && !victim.companionDisabled) {
    const newDeck = [...state.deck];
    const drawn: DistrictCard[] = [];
    for (let i = 0; i < 2 && newDeck.length > 0; i++) {
      drawn.push(newDeck.shift()!);
    }
    const newPlayers = [...state.players];
    newPlayers[victimIdx] = {
      ...victim,
      gold: victim.gold + 2,
      hand: [...victim.hand, ...drawn],
    };
    newState = {
      ...state,
      players: newPlayers,
      deck: newDeck,
      log: [...state.log, { day: state.day, message: `⚕️ ${victim.name} — королевский лекарь: +${drawn.length}🃏 +2💰` }],
    };
  }
  return newState;
}

/** True if the player can still take limited actions while assassinated (Hospital). */
export function hasHospital(p: PlayerState): boolean {
  return p.builtDistricts.some((d) => d.purpleAbility === "hospital");
}

/**
 * True if the player should still get a (limited) turn even when assassinated.
 * Only Hospital (the building) grants this — it lets the owner still take
 * income and use their companion this turn. Royal Healer is just an
 * on-assassination bonus (+2🃏 +2💰) and does NOT keep the turn alive: the
 * dead player still skips their turn after the bonus fires.
 */
export function canActWhileAssassinated(p: PlayerState): boolean {
  return hasHospital(p);
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
  // Assassinated players don't get hero passives (Hospital/Royal Healer let
  // them act but explicitly forbid the hero passive). Companion-only effects
  // also gate themselves on companionDisabled.
  if (player.assassinated) return state;

  const newPlayers = [...state.players];
  let log = state.log;
  let newCrownHolder = state.crownHolder;
  let newDeck = state.deck;

  // Check if this hero was targeted by thief
  const thiefIdx = state.players.findIndex(
    (p) => p.hero === HeroId.Thief && p.robbedHeroId === player.hero,
  );
  if (thiefIdx !== -1) {
    const thief = state.players[thiefIdx];
    const thiefHasBandit = thief.companion === CompanionId.Bandit && !thief.companionDisabled;
    const thiefHasBurglar = thief.companion === CompanionId.Burglar && !thief.companionDisabled;

    if (thiefHasBandit && player.builtDistricts.length > 0) {
      // Bandit converts the gold-theft into a General-style raid: pick up to 4
      // unique random districts; each one loses 1 cost (= HP/score). Stronghold
      // is immune to both damage and gold transfer. Districts whose cost falls
      // below 1 are destroyed (Salvage Yard fires for each). The thief gains
      // exactly 1 gold per non-stronghold district hit, so victim has 3 dmg-able
      // districts → +3 gold even if the 4th pick was the stronghold.
      const numShots = Math.min(4, player.builtDistricts.length);
      // Fisher-Yates partial shuffle for unique picks.
      const indices: number[] = [];
      for (let i = 0; i < player.builtDistricts.length; i++) indices.push(i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        const tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
      }
      const picked = indices.slice(0, numShots).sort((a, b) => b - a);
      const newDistricts = [...player.builtDistricts];
      const destroyedHere: DistrictCard[] = [];
      let banditGold = 0;
      const damagedNames: string[] = [];
      for (const idx of picked) {
        const d = newDistricts[idx];
        if (!d) continue;
        if (d.purpleAbility === "stronghold") continue; // immune to damage AND theft
        const newCost = d.cost - 1;
        banditGold += 1;
        if (newCost < 1) {
          destroyedHere.push(d);
          newDistricts.splice(idx, 1);
          damagedNames.push(`${d.name} разрушен`);
        } else {
          newDistricts[idx] = { ...d, cost: newCost, hp: newCost };
          damagedNames.push(`${d.name} (${d.cost}→${newCost})`);
        }
      }
      newPlayers[playerIdx] = { ...player, builtDistricts: newDistricts };
      newPlayers[thiefIdx] = { ...thief, gold: thief.gold + banditGold };
      let newDiscardPile = state.discardPile;
      if (destroyedHere.length > 0) {
        newDiscardPile = [...state.discardPile, ...destroyedHere];
      }
      log = addLog({ ...state, log }, `🗡️ ${thief.name} — разбойник: ${numShots} удар(ов) по ${player.name}: ${damagedNames.join(", ")}; +${banditGold}💰`);
      // Apply Salvage Yard triggers for any of the victim's districts destroyed.
      if (destroyedHere.length > 0) {
        const tmpState: GameState = { ...state, players: newPlayers, discardPile: newDiscardPile, log };
        const after = applySalvageTriggers(tmpState, playerIdx, destroyedHere);
        newPlayers.splice(0, newPlayers.length, ...after.players);
        log = after.log;
        newDiscardPile = after.discardPile;
      }
      // Stash discard-pile change on `state` so the function's final spread picks it up.
      state = { ...state, discardPile: newDiscardPile };
    } else if (player.gold > 0 || thiefHasBurglar) {
      const stolenGold = player.gold;
      newPlayers[playerIdx] = { ...player, gold: 0 };
      let thiefAfter = { ...thief, gold: thief.gold + stolenGold };

      // Burglar: also steal one random card from victim's hand.
      if (thiefHasBurglar && newPlayers[playerIdx].hand.length > 0) {
        const victimHand = [...newPlayers[playerIdx].hand];
        const stolenIdx = rng.int(0, victimHand.length - 1);
        const stolenCard = victimHand[stolenIdx];
        victimHand.splice(stolenIdx, 1);
        newPlayers[playerIdx] = { ...newPlayers[playerIdx], hand: victimHand };
        thiefAfter = { ...thiefAfter, hand: [...thiefAfter.hand, stolenCard] };
        log = addLog({ ...state, log }, `🦝 ${thief.name} — домушник: украл ${stolenCard.name} у ${player.name}`);
      }

      newPlayers[thiefIdx] = thiefAfter;
      if (stolenGold > 0) {
        log = addLog({ ...state, log }, `${thief.name} украл ${stolenGold} золота у ${player.name}`);
      }
    }
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
      // City Gates: King auto-builds gates for free at start of their turn (hard-capped).
      const kingPlayer = newPlayers[playerIdx];
      const gateIdx = kingPlayer.hand.findIndex((d) => d.purpleAbility === "city_gates");
      if (gateIdx !== -1 && kingPlayer.builtDistricts.length < WIN_DISTRICTS) {
        const hand = [...kingPlayer.hand];
        const card = hand[gateIdx];
        hand.splice(gateIdx, 1);
        const built = { ...card, cost: 8, originalCost: 8, hp: 8 };
        const next = { ...kingPlayer, hand };
        // Guard: only add if still under cap.
        if (next.builtDistricts.length < WIN_DISTRICTS) {
          newPlayers[playerIdx] = { ...next, builtDistricts: [...next.builtDistricts, built] };
          log = addLog({ ...state, log }, `${p.name} (Лидер) автоматически выставил Врата в город`);
        } else {
          newPlayers[playerIdx] = next;
        }
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

  // Interceptor: if this player is at turnOrder[0] (going first this day),
  // draw +2 cards. The matching speed-bump for the next player happens in
  // buildTurnOrder when the order is built, so by the time this passive
  // fires the slowdown has already taken effect.
  if (cp.companion === CompanionId.Interceptor && !cp.companionDisabled) {
    const isFirst = state.turnOrder && state.turnOrder.length > 0 && state.turnOrder[0] === playerIdx;
    if (isFirst) {
      newDeck = [...state.deck];
      const drawn = newDeck.splice(0, Math.min(2, newDeck.length));
      const freeSlots = Math.max(0, MAX_HAND_CARDS - cp.hand.length);
      const accepted = drawn.slice(0, freeSlots);
      const overflow = drawn.length - accepted.length;
      newPlayers[playerIdx] = { ...newPlayers[playerIdx], hand: [...cp.hand, ...accepted] };
      if (accepted.length > 0) {
        log = addLog({ ...state, log }, `${cp.name} — перехватчик: +${accepted.length}🃏 (идёт первым)`);
      }
      if (overflow > 0) {
        log = addLog({ ...state, log }, `💥 ${cp.name}: ${overflow} карт(ы) рассыпались (лимит руки ${MAX_HAND_CARDS})`);
      }
    }
  }

  // Farmer: scaling early-game stipend. If you have NO building of cost ≥ 3,
  // +2 gold at the start of your turn. Stops paying out once you've built
  // anything sizeable, so it's a comeback / catch-up tool, not perma-income.
  if (cp.companion === CompanionId.Farmer && !cp.companionDisabled) {
    const hasBigBuilding = cp.builtDistricts.some((d) => d.cost >= 3);
    if (!hasBigBuilding) {
      newPlayers[playerIdx] = { ...cp, gold: cp.gold + 2 };
      log = addLog({ ...state, log }, `${cp.name} — фермер: нет построек ≥3💰 → +2💰`);
    }
  }

  // Artist: all 4 colors on table → +6 gold (the all-colors condition is
  // expensive to set up — it usually delays a turn or two, so the payoff
  // is bumped from +4 to +6 to make the build worth pursuing).
  if (cp.companion === CompanionId.Artist && !cp.companionDisabled) {
    const colors = new Set(cp.builtDistricts.flatMap((d) => d.colors));
    if (colors.has("yellow") && colors.has("blue") && colors.has("green") && colors.has("red")) {
      newPlayers[playerIdx] = { ...cp, gold: cp.gold + 6 };
      log = addLog({ ...state, log }, `${cp.name} — художник: все 4 цвета → +6💰`);
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

  // Knight: takes UP TO 3 gold from richest and hands the same amount to the
  // poorest. If the richest has fewer than 3, everyone they have is taken
  // (transfer = min(3, richest.gold)), so the effect scales gracefully early
  // game when nobody's rich yet but still bites at peak gold.
  if (cp.companion === CompanionId.Knight && !cp.companionDisabled) {
    let richestIdx = -1, poorestIdx = -1;
    let maxGold = -1, minGold = Infinity;
    for (let j = 0; j < newPlayers.length; j++) {
      if (newPlayers[j].gold > maxGold) { maxGold = newPlayers[j].gold; richestIdx = j; }
      if (newPlayers[j].gold < minGold) { minGold = newPlayers[j].gold; poorestIdx = j; }
    }
    if (richestIdx !== -1 && poorestIdx !== -1 && richestIdx !== poorestIdx && maxGold > 0) {
      const transfer = Math.min(3, maxGold);
      newPlayers[richestIdx] = { ...newPlayers[richestIdx], gold: newPlayers[richestIdx].gold - transfer };
      newPlayers[poorestIdx] = { ...newPlayers[poorestIdx], gold: newPlayers[poorestIdx].gold + transfer };
      log = addLog({ ...state, log }, `${cp.name} — рыцарь: ${newPlayers[richestIdx].name} −${transfer}💰 → ${newPlayers[poorestIdx].name} +${transfer}💰`);
    }
  }

  // Tyrant: at start of turn, fire 1 shot per yellow district at random opponent district.
  if (cp.companion === CompanionId.Tyrant && !cp.companionDisabled) {
    const yellowCount = cp.builtDistricts.filter((d) => d.colors.includes("yellow")).length;
    if (yellowCount > 0) {
      let destroyedNames: string[] = [];
      for (let shot = 0; shot < yellowCount; shot++) {
        const opponents = newPlayers
          .map((p, i) => ({ p, i }))
          .filter((x) => x.i !== playerIdx && x.p.builtDistricts.length > 0 && !x.p.assassinated);
        if (opponents.length === 0) break;
        const oppPick = opponents[rng.int(0, opponents.length - 1)];
        const opp = newPlayers[oppPick.i];
        const damageable = opp.builtDistricts
          .map((d, i) => ({ d, i }))
          .filter(({ d }) => d.purpleAbility !== "stronghold");
        if (damageable.length === 0) continue;
        const distPick = damageable[rng.int(0, damageable.length - 1)];
        const dist = opp.builtDistricts[distPick.i];
        const newCost = dist.cost - 1;
        const newOppDistricts = [...opp.builtDistricts];
        if (newCost < 1) {
          newOppDistricts.splice(distPick.i, 1);
          destroyedNames.push(dist.name);
        } else {
          newOppDistricts[distPick.i] = { ...dist, cost: newCost, hp: newCost };
        }
        newPlayers[oppPick.i] = { ...opp, builtDistricts: newOppDistricts };
      }
      log = addLog({ ...state, log }, `👑 ${cp.name} — тиран: ${yellowCount} выстрел(ов)${destroyedNames.length > 0 ? `, разрушено: ${destroyedNames.join(", ")}` : ""}`);
    }
  }

  // Nobility: richest gets +4 cards, non-richest get -1 card AND -2 gold.
  // Steeper swing than the old +1 / -1 / -1g version to make the "stay
  // richest" pressure actually mean something — being a step behind costs.
  if (cp.companion === CompanionId.Nobility && !cp.companionDisabled) {
    let maxGold = -1;
    let richestIdx = -1;
    for (let j = 0; j < newPlayers.length; j++) {
      if (newPlayers[j].gold > maxGold) { maxGold = newPlayers[j].gold; richestIdx = j; }
    }
    if (richestIdx !== -1) {
      // Richest gets +4 cards (capped by deck supply + hand limit elsewhere).
      const drawCount = Math.min(4, newDeck.length);
      if (drawCount > 0) {
        const drawn = newDeck.splice(0, drawCount);
        newPlayers[richestIdx] = { ...newPlayers[richestIdx], hand: [...newPlayers[richestIdx].hand, ...drawn] };
      }
      // Non-richest lose 1 card and 2 gold.
      for (let j = 0; j < newPlayers.length; j++) {
        if (j === richestIdx) continue;
        const p = newPlayers[j];
        const newHand = [...p.hand];
        if (newHand.length > 0) {
          newHand.splice(rng.int(0, newHand.length - 1), 1);
        }
        newPlayers[j] = { ...p, hand: newHand, gold: Math.max(0, p.gold - 2) };
      }
      log = addLog({ ...state, log }, `${cp.name} — знать: ${newPlayers[richestIdx].name} +${drawCount}🃏, остальные −1🃏 −2💰`);
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

        // Royal Healer: victim immediately gets +2🃏 +2💰 before assassin proceeds.
        const victim = newPlayers[targetIdx];
        if (victim.companion === CompanionId.RoyalHealer && !victim.companionDisabled) {
          let nd = state.deck;
          const drawn: typeof victim.hand = [];
          if (newDeck === state.deck) newDeck = [...state.deck];
          for (let i = 0; i < 2 && newDeck.length > 0; i++) {
            drawn.push(newDeck.shift()!);
          }
          newPlayers[targetIdx] = {
            ...victim,
            gold: victim.gold + 2,
            hand: [...victim.hand, ...drawn],
          };
          log = addLog({ ...state, log }, `⚕️ ${victim.name} — королевский лекарь: +${drawn.length}🃏 +2💰 перед смертью`);
        }

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
      const robbedHeroName = HEROES.find((h) => h.id === ability.targetHeroId)?.name ?? "???";
      newPlayers[playerIdx] = { ...player, robbedHeroId: ability.targetHeroId, abilityUsed: true };
      log = addLog({ ...state, log }, `🪙 Вор выбрал ${robbedHeroName}`);
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

      // General spends gold to deal damage to district cost (which is HP/value).
      if (player.gold < 1) return null;
      const damage = Math.min(player.gold, card.cost);

      const newTargetDistricts = [...target.builtDistricts];
      const newCost = card.cost - damage;

      let newDiscardPile = state.discardPile;
      let destroyedThisAction: DistrictCard[] = [];
      if (newCost < 1) {
        // District destroyed — add to discard pile
        newTargetDistricts.splice(cardIdx, 1);
        newDiscardPile = [...state.discardPile, card];
        destroyedThisAction = [card];
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
        // District damaged but survives — its cost (= HP/value) drops.
        newTargetDistricts[cardIdx] = { ...card, cost: newCost, hp: newCost };
        log = addLog({ ...state, log }, `${player.name} (Генерал) повредил ${card.name} у ${target.name} (${card.cost}→${newCost}) за ${damage} золота`);
      }

      newPlayers[playerIdx] = { ...player, gold: player.gold - damage, abilityUsed: true };
      newPlayers[targetIdx] = { ...newPlayers[targetIdx] ?? target, builtDistricts: newTargetDistricts };
      newDeck = state.deck; // preserve deck
      let result: GameState = { ...state, players: newPlayers, deck: newDeck, discardPile: newDiscardPile, log };
      if (destroyedThisAction.length > 0) {
        result = applySalvageTriggers(result, targetIdx, destroyedThisAction);
      }
      return result;
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
 *  Scoring: sum of each district's current cost (the unified HP/value/cost number). */
export function calculateScores(state: GameState): GameState {
  let maxScore = -1;
  let winnerIdx = -1;

  const log = [...state.log];

  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    let score = 0;

    // Sum of each district's current cost (= HP/value).
    for (const d of p.builtDistricts) {
      score += Math.max(0, d.cost);
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
