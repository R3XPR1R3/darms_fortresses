import type { GameState, DistrictCard, CardColor } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS, CompanionId, FLAME_CARD_NAME, MAX_HAND_CARDS } from "@darms/shared-types";
import type { Rng } from "./rng.js";
import { applyPassiveAbility, checkWinCondition, calculateScores } from "./abilities.js";
import { addRandomColor } from "./deck.js";

/**
 * Build the turn order for the current day based on hero speeds.
 * Lower speed = goes first. Ties broken randomly.
 * Courier companion: hero speed -2.
 * Also resets per-turn state and applies passive abilities for first player.
 */
export function buildTurnOrder(state: GameState, rng: Rng): GameState {
  const indexed = state.players
    .map((p, i) => ({ idx: i, hero: p.hero }))
    .filter((p) => p.hero !== null && !state.players[p.idx].assassinated);

  indexed.sort((a, b) => {
    let speedA = HEROES.find((h) => h.id === a.hero)!.speed;
    let speedB = HEROES.find((h) => h.id === b.hero)!.speed;

    // Courier companion: speed -2
    const pA = state.players[a.idx];
    if (pA.companion === CompanionId.Courier && !pA.companionDisabled) {
      speedA -= 2;
    }
    // Highway purple building: speed -1
    if (pA.builtDistricts.some((d) => d.purpleAbility === "highway")) {
      speedA -= 1;
    }
    const pB = state.players[b.idx];
    if (pB.companion === CompanionId.Courier && !pB.companionDisabled) {
      speedB -= 2;
    }
    if (pB.builtDistricts.some((d) => d.purpleAbility === "highway")) {
      speedB -= 1;
    }

    if (speedA !== speedB) return speedA - speedB;
    return rng.next() - 0.5;
  });

  // Reset per-turn state
  let newPlayers = state.players.map((p) => ({
    ...p,
    incomeTaken: false,
    incomeOffer: null,
    buildsRemaining: p.hero === HeroId.Architect ? 3 : 1,
    abilityUsed: false,
    companionUsed: false,
    contractorTargetHeroId: null,
    activatedBuildings: [],
  }));

  let log = state.log;

  // Jester (yellow hero): shuffles all players' hands at start of day
  const jesterPlayer = newPlayers.find(
    (p) => p.companion === CompanionId.Jester && !p.companionDisabled
      && HEROES.find((h) => h.id === p.hero)?.color === "yellow",
  );
  if (jesterPlayer) {
    const allCards = newPlayers.flatMap((p) => p.hand);
    rng.shuffle(allCards);
    let offset = 0;
    newPlayers = newPlayers.map((p) => {
      const handSize = p.hand.length;
      const newHand = allCards.slice(offset, offset + handSize);
      offset += handSize;
      return { ...p, hand: newHand };
    });
    log = [...log, { day: state.day, message: `${jesterPlayer.name} — шут: все карты перемешаны!` }];
  }

  let newState: GameState = {
    ...state,
    players: newPlayers,
    turnOrder: indexed.map((p) => p.idx),
    currentTurnIndex: 0,
    log,
    rng: rng.getSeed(),
  };

  // Apply passive ability for the first player
  if (indexed.length > 0) {
    newState = applyPassiveAbility(newState, indexed[0].idx, rng);
  }

  return newState;
}

/**
 * Process income action: take 2 gold OR draw 2 cards (choose 1, return 1 to deck top).
 * Swindler companion: first income gives BOTH (gold + card-draw), then can take income once more.
 * Druid companion: drawn cards become dual-colored.
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

  const hasSwindler = player.companion === CompanionId.Swindler
    && !player.companionDisabled && !player.companionUsed;

  const rng = { int: (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1)) };
  const hasDruid = player.companion === CompanionId.Druid && !player.companionDisabled;
  const drawTwoOffer = (
    deck: typeof state.deck,
  ) => {
    const newDeck = [...deck];
    const drawn: DistrictCard[] = [];
    for (let i = 0; i < 2 && newDeck.length > 0; i++) {
      let card = newDeck.shift()!;
      if (hasDruid) card = addRandomColor(card, rng);
      drawn.push(card);
    }
    return { newDeck, drawn };
  };

  if (hasSwindler) {
    // Swindler: give BOTH gold + card-draw, mark companion used, don't mark income taken
    const offer = drawTwoOffer(state.deck);
    const newPlayers = [...state.players];
    newPlayers[playerIdx] = {
      ...player,
      gold: player.gold + 2,
      incomeOffer: offer.drawn,
      companionUsed: true, // swindler bonus used, but income NOT taken — can take once more
    };
    return {
      ...state,
      players: newPlayers,
      deck: offer.newDeck,
      log: [...state.log, { day: state.day, message: `${player.name} — шулер: +2💰 и выбор из 2 карт` }],
    };
  }

  if (choice === "gold") {
    const newPlayers = [...state.players];
    newPlayers[playerIdx] = {
      ...player,
      gold: player.gold + 2,
      incomeTaken: true,
    };
    return {
      ...state,
      players: newPlayers,
      log: [...state.log, { day: state.day, message: `💰 ${player.name} берёт +2 золота` }],
    };
  }

  if (choice === "card" && player.hand.length >= MAX_HAND_CARDS) {
    return null;
  }

  const offer = drawTwoOffer(state.deck);
  const newPlayers = [...state.players];
  newPlayers[playerIdx] = {
    ...player,
    incomeOffer: offer.drawn,
  };
  return {
    ...state,
    players: newPlayers,
    deck: offer.newDeck,
    log: [...state.log, { day: state.day, message: `🃏 ${player.name} берёт 2 карты (выбирает 1)` }],
  };
}

/** Resolve explicit income card choice from previously offered 2 cards. */
export function pickIncomeCard(
  state: GameState,
  playerId: string,
  cardId: string,
): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;
  const player = state.players[playerIdx];
  if (!player.incomeOffer || player.incomeOffer.length === 0) return null;
  const pickIdx = player.incomeOffer.findIndex((c) => c.id === cardId);
  if (pickIdx === -1) return null;
  const picked = player.incomeOffer[pickIdx];
  const other = player.incomeOffer.find((_, i) => i !== pickIdx) ?? null;

  const newDeck = [...state.deck];
  if (other) newDeck.unshift(other);

  const newPlayers = [...state.players];
  const freeSlots = Math.max(0, MAX_HAND_CARDS - player.hand.length);
  const accepted = freeSlots > 0 ? [picked] : [];
  const overflow = accepted.length === 0 ? 1 : 0;

  let updated = {
    ...player,
    hand: [...player.hand, ...accepted],
    incomeOffer: null,
    incomeTaken: true,
  };
  // Swindler bonus pick does not consume the normal income action.
  if (
    player.companion === CompanionId.Swindler
    && player.companionUsed
    && !player.incomeTaken
  ) {
    updated = { ...updated, incomeTaken: false };
  }

  // Leader auto-builds City Gates if picked into hand.
  if (updated.hero === HeroId.King) {
    const gateIdx = updated.hand.findIndex((d) => d.purpleAbility === "city_gates");
    if (gateIdx !== -1) {
      const hand = [...updated.hand];
      const gate = hand[gateIdx];
      hand.splice(gateIdx, 1);
      updated = {
        ...updated,
        hand,
        builtDistricts: [...updated.builtDistricts, { ...gate, cost: 8, originalCost: 8, hp: 8 }],
      };
    }
  }

  newPlayers[playerIdx] = updated;
  const log = [...state.log, { day: state.day, message: `🃏 ${player.name} выбрал карту` }];
  if (overflow > 0) {
    log.push({ day: state.day, message: `💥 ${player.name}: 1 карт(ы) рассыпались (лимит руки ${MAX_HAND_CARDS})` });
  }
  return { ...state, players: newPlayers, deck: newDeck, log };
}

/**
 * Build a district from hand. Costs gold equal to card cost.
 * Architect can build up to 3 per turn, others 1.
 * Official companion (red hero): allows building duplicates.
 * Sun Priestess companion (blue hero): blue districts cost -1.
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

  // Flame cards can be "played away" for 2 gold (discarded, not built).
  if (card.name === FLAME_CARD_NAME) {
    const flameClearCost = 2;
    if (player.gold < flameClearCost) return null;
    const newHand = [...player.hand];
    newHand.splice(cardIdx, 1);
    const newPlayers = [...state.players];
    newPlayers[playerIdx] = {
      ...player,
      gold: player.gold - flameClearCost,
      hand: newHand,
      buildsRemaining: player.buildsRemaining - 1,
    };
    return { ...state, players: newPlayers };
  }

  // Calculate effective cost
  let effectiveCost = card.cost;
  const heroColor = HEROES.find((h) => h.id === player.hero)?.color ?? null;

  // Monument: always costs 3 to build from hand
  if (card.purpleAbility === "monument") {
    effectiveCost = 3;
  }

  // City Gates can only be built by Leader (King role).
  if (card.purpleAbility === "city_gates" && player.hero !== HeroId.King) {
    return null;
  }

  // Sun Priestess: blue districts cost -1 (only for blue hero)
  if (
    player.companion === CompanionId.SunPriestess
    && !player.companionDisabled
    && heroColor === "blue"
    && card.colors.includes("blue")
  ) {
    effectiveCost = Math.max(0, effectiveCost - 1);
  }

  if (player.gold < effectiveCost) return null;

  // SunFanatic: only blue districts allowed (blue hero)
  if (
    player.companion === CompanionId.SunFanatic
    && !player.companionDisabled
    && heroColor === "blue"
    && !card.colors.includes("blue")
  ) {
    return null;
  }

  // Duplicate check — Official (red hero) allows duplicates; altar_darkness always allows duplicates
  const allowDuplicates =
    card.purpleAbility === "altar_darkness"
    || (player.companion === CompanionId.Official
      && !player.companionDisabled
      && heroColor === "red");

  if (!allowDuplicates && player.builtDistricts.some((d) => d.name === card.name)) return null;

  const newHand = [...player.hand];
  newHand.splice(cardIdx, 1);

  // One-shot spells: cast from hand, do not stay on table.
  if (card.spellAbility) {
    const newPlayers = [...state.players];
    let log = state.log;
    const randomInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

    if (card.spellAbility === "ignite") {
      const opponents = state.players
        .map((p, i) => ({ p, i }))
        .filter((x) => x.i !== playerIdx && x.p.hand.length > 0);
      if (opponents.length > 0) {
        const picked = opponents[randomInt(0, opponents.length - 1)];
        const target = state.players[picked.i];
        const targetHand = [...target.hand];
        const targetCardIdx = randomInt(0, targetHand.length - 1);
        targetHand[targetCardIdx] = {
          id: `flame-spell-${Date.now()}-${randomInt(0, 9999)}`,
          name: FLAME_CARD_NAME,
          cost: 2,
          originalCost: 2,
          hp: 0,
          colors: ["red"],
          baseColors: ["red"],
        };
        newPlayers[picked.i] = { ...target, hand: targetHand };
        log = [...log, { day: state.day, message: `🔥 ${player.name} применил Поджигание к ${target.name}` }];
      }
    } else if (card.spellAbility === "gold_rain") {
      for (let i = 0; i < newPlayers.length; i++) {
        newPlayers[i] = { ...newPlayers[i], gold: newPlayers[i].gold + 1 };
      }
      log = [...log, { day: state.day, message: `🌧️ ${player.name} применил Золотой дождь: все получили +1💰` }];
    } else if (card.spellAbility === "holy_day") {
      for (let i = 0; i < newPlayers.length; i++) {
        const districts = newPlayers[i].builtDistricts.map((d) => ({
          ...d,
          baseColors: d.baseColors ?? d.colors,
          colors: ["blue" as CardColor],
        }));
        newPlayers[i] = { ...newPlayers[i], builtDistricts: districts };
      }
      log = [...log, { day: state.day, message: `✨ ${player.name} применил Священный день: до конца дня все кварталы синие` }];
    } else if (card.spellAbility === "flood") {
      for (let i = 0; i < newPlayers.length; i++) {
        const owner = newPlayers[i];
        const districts = [...owner.builtDistricts];
        const toReturn = Math.min(4, districts.length);
        const returned: DistrictCard[] = [];
        for (let k = 0; k < toReturn; k++) {
          const pick = randomInt(0, districts.length - 1);
          returned.push(districts[pick]);
          districts.splice(pick, 1);
        }
        const freeSlots = Math.max(0, MAX_HAND_CARDS - owner.hand.length);
        const accepted = returned.slice(0, freeSlots);
        const overflow = returned.length - accepted.length;
        newPlayers[i] = { ...owner, builtDistricts: districts, hand: [...owner.hand, ...accepted] };
        if (overflow > 0) {
          log = [...log, { day: state.day, message: `💥 ${owner.name}: ${overflow} карт(ы) рассыпались (лимит руки ${MAX_HAND_CARDS})` }];
        }
      }
      log = [...log, { day: state.day, message: `🌊 ${player.name} применил Потоп: до 4 случайных кварталов у каждого вернулись в руку` }];
    } else if (card.spellAbility === "plague") {
      log = [...log, { day: state.day, message: `☣️ ${player.name} применил Чуму: эффект активен 3 дня` }];
    }

    newPlayers[playerIdx] = {
      ...newPlayers[playerIdx],
      gold: player.gold - effectiveCost,
      hand: newHand,
      buildsRemaining: player.buildsRemaining - 1,
    };
    return { ...state, players: newPlayers, log, plagueDaysLeft: card.spellAbility === "plague" ? 3 : (state.plagueDaysLeft ?? 0) };
  }

  // Monument: on table always 5 cost / 5 HP
  let builtCard = { ...card, hp: card.cost, originalCost: card.originalCost ?? card.cost, baseColors: card.baseColors ?? card.colors };
  if (card.purpleAbility === "monument") {
    builtCard = { ...card, cost: 5, hp: 5, originalCost: card.originalCost ?? 5, baseColors: card.baseColors ?? card.colors };
  }

  // Fort: reduce other (non-fort) districts HP by 1 when on table
  // (Fort effect is passive — applied when checking HP, not on build)

  const newPlayers = [...state.players];
  newPlayers[playerIdx] = {
    ...player,
    gold: player.gold - effectiveCost,
    hand: newHand,
    builtDistricts: [...player.builtDistricts, builtCard],
    buildsRemaining: player.buildsRemaining - 1,
  };

  let newState = { ...state, players: newPlayers, log: [...state.log, { day: state.day, message: `🏗️ ${player.name} построил ${card.name}` }] };
  newState = checkWinCondition(newState);
  return newState;
}


/**
 * Apply Treasurer end-of-day effect: richest player gives 1 gold + 1 card to Treasurer's owner.
 */
function applyTreasurerEndOfDay(state: GameState, rng: Rng): GameState {
  let newPlayers = [...state.players];
  let log = state.log;

  for (let i = 0; i < newPlayers.length; i++) {
    const p = newPlayers[i];
    if (p.companion !== CompanionId.Treasurer || p.companionDisabled) continue;

    // Find richest other player
    let richestIdx = -1;
    let maxGold = -1;
    for (let j = 0; j < newPlayers.length; j++) {
      if (j === i) continue;
      if (newPlayers[j].gold > maxGold) {
        maxGold = newPlayers[j].gold;
        richestIdx = j;
      }
    }
    if (richestIdx === -1 || maxGold <= 0) continue;

    const richest = newPlayers[richestIdx];
    // Transfer 1 gold
    const goldTransfer = Math.min(1, richest.gold);
    // Transfer 1 random card
    let cardTransfer = null;
    let newRichHand = [...richest.hand];
    if (newRichHand.length > 0) {
      const cardIdx = rng.int(0, newRichHand.length - 1);
      cardTransfer = newRichHand[cardIdx];
      newRichHand.splice(cardIdx, 1);
    }

    newPlayers = [...newPlayers];
    newPlayers[richestIdx] = { ...richest, gold: richest.gold - goldTransfer, hand: newRichHand };
    newPlayers[i] = {
      ...newPlayers[i],
      gold: newPlayers[i].gold + goldTransfer,
      hand: cardTransfer ? [...newPlayers[i].hand, cardTransfer] : newPlayers[i].hand,
    };
    log = [...log, { day: state.day, message: `${p.name} — торговец: ${richest.name} отдал ${goldTransfer}💰${cardTransfer ? " и карту" : ""}` }];
  }
  return { ...state, players: newPlayers, log };
}

/**
 * Set Royal Guard flag for next draft on players who have Royal Guard companion.
 */
function applyRoyalGuardEndOfDay(state: GameState): GameState {
  const newPlayers = state.players.map((p) => {
    if (p.companion === CompanionId.RoyalGuard && !p.companionDisabled) {
      return { ...p, royalGuardDraft: true };
    }
    return p;
  });
  return { ...state, players: newPlayers };
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

  // Flame spreading:
  // each flame burns up to 2 random non-flame cards in the same hand,
  // then disappears; each burned card becomes a new flame for next turn.
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const flameCount = p.hand.filter((c) => c.name === FLAME_CARD_NAME).length;
    if (flameCount > 0) {
      const burnable = p.hand.filter((c) => c.name !== FLAME_CARD_NAME);
      const spawnedFlames: DistrictCard[] = [];
      let burnedTotal = 0;

      for (let f = 0; f < flameCount; f++) {
        for (let b = 0; b < 2; b++) {
          if (burnable.length === 0) break;
          const burnIdx = rng.int(0, burnable.length - 1);
          burnable.splice(burnIdx, 1);
          burnedTotal++;
          spawnedFlames.push({
            id: `flame-${Date.now()}-${i}-${f}-${b}-${rng.int(0, 9999)}`,
            name: FLAME_CARD_NAME,
            cost: 2,
            originalCost: 2,
            hp: 0,
            colors: ["red"],
            baseColors: ["red"],
          });
        }
      }

      players = [...players];
      players[i] = { ...p, hand: [...burnable, ...spawnedFlames] };
      log = [...log, { day: state.day, message: `🔥 Пламя у ${p.name}: сгорело карт ${burnedTotal}, новых огней ${spawnedFlames.length}` }];
    }
  }

  // Mine:
  // - Merchant gets +1 per mine at end of each turn
  // - Other heroes get +1 per mine at end of day
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const mineCount = p.builtDistricts.filter((d) => d.purpleAbility === "mine").length;
    const isMerchant = p.hero === HeroId.Merchant;
    if (mineCount > 0 && isMerchant) {
      players = [...players];
      players[i] = { ...p, gold: p.gold + mineCount };
      log = [...log, { day: state.day, message: `⛏️ ${p.name} — шахта (торговец): +${mineCount}💰` }];
    }
  }

  state = { ...state, players, log };

  if (nextIdx >= turnOrder.length) {
    // End-of-day cleanup for Holy Day spell: restore original district colors.
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      const restored = p.builtDistricts.map((d) => ({
        ...d,
        colors: d.baseColors ?? d.colors,
      }));
      const newPlayers = [...state.players];
      newPlayers[i] = { ...p, builtDistricts: restored };
      state = { ...state, players: newPlayers };
    }

    // City Gates in hand get cheaper by 2 at end of each day.
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      const newHand = [...p.hand];
      let changed = false;
      for (let h = 0; h < newHand.length; h++) {
        if (newHand[h].purpleAbility === "city_gates") {
          const discounted = Math.max(0, newHand[h].cost - 2);
          newHand[h] = { ...newHand[h], cost: discounted, hp: discounted };
          state = { ...state, log: [...state.log, { day: state.day, message: `🚪 Врата в город у ${p.name} в руке: стоимость → ${discounted}` }] };
          changed = true;
        }
      }
      if (changed) {
        const newPlayers = [...state.players];
        newPlayers[i] = { ...p, hand: newHand };
        state = { ...state, players: newPlayers };
      }
    }

    // End of day — Mine income for all heroes (+1 per mine)
    {
      const minePlayers = [...state.players];
      let mineLog = state.log;
      for (let i = 0; i < minePlayers.length; i++) {
        const p = minePlayers[i];
        const mineCount = p.builtDistricts.filter((d) => d.purpleAbility === "mine").length;
        if (mineCount > 0) {
          minePlayers[i] = { ...p, gold: p.gold + mineCount };
          mineLog = [...mineLog, { day: state.day, message: `⛏️ ${p.name} — шахта: +${mineCount}💰` }];
        }
      }
      state = { ...state, players: minePlayers, log: mineLog };
    }

    // End of day — Plague effect (once per day, if active)
    if ((state.plagueDaysLeft ?? 0) > 0) {
      const plaguePlayers = [...state.players];
      let plagueLog = state.log;
      const goldCandidates = plaguePlayers
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.gold > 0);
      if (goldCandidates.length > 0) {
        const picked = goldCandidates[rng.int(0, goldCandidates.length - 1)];
        plaguePlayers[picked.i] = { ...plaguePlayers[picked.i], gold: plaguePlayers[picked.i].gold - 1 };
        plagueLog = [...plagueLog, { day: state.day, message: `☣️ Чума: ${plaguePlayers[picked.i].name} потерял 1💰` }];
      }

      const hpCandidates: { pIdx: number; dIdx: number }[] = [];
      for (let i = 0; i < plaguePlayers.length; i++) {
        for (let d = 0; d < plaguePlayers[i].builtDistricts.length; d++) {
          if (plaguePlayers[i].builtDistricts[d].purpleAbility === "stronghold") continue;
          hpCandidates.push({ pIdx: i, dIdx: d });
        }
      }
      if (hpCandidates.length > 0) {
        const picked = hpCandidates[rng.int(0, hpCandidates.length - 1)];
        const owner = plaguePlayers[picked.pIdx];
        const districts = [...owner.builtDistricts];
        const target = districts[picked.dIdx];
        const newHp = target.hp - 1;
        if (newHp < 1) {
          const destroyed = districts[picked.dIdx];
          districts.splice(picked.dIdx, 1);
          plaguePlayers[picked.pIdx] = { ...owner, builtDistricts: districts };
          state = { ...state, discardPile: [...state.discardPile, destroyed] };
          plagueLog = [...plagueLog, { day: state.day, message: `☣️ Чума: у ${owner.name} разрушен ${destroyed.name}` }];
        } else {
          districts[picked.dIdx] = { ...target, hp: newHp };
          plaguePlayers[picked.pIdx] = { ...owner, builtDistricts: districts };
          plagueLog = [...plagueLog, { day: state.day, message: `☣️ Чума: у ${owner.name} повреждён ${target.name} (${target.hp}→${newHp})` }];
        }
      }

      state = { ...state, players: plaguePlayers, log: plagueLog };
    }

    // End of day — apply end-of-day effects
    state = applyTreasurerEndOfDay(state, rng);
    state = applyRoyalGuardEndOfDay(state);

    // Re-check: if a player was marked finishedFirst but districts were destroyed
    // below the threshold, clear the flag — the game continues
    let playersCheck = [...state.players];
    let flagCleared = false;
    for (let i = 0; i < playersCheck.length; i++) {
      const altarCount = playersCheck[i].builtDistricts.filter((d) => d.purpleAbility === "altar_darkness").length;
      const qualifiesByDistricts = playersCheck[i].builtDistricts.length >= WIN_DISTRICTS;
      const qualifiesByAltars = altarCount >= 4;
      if (playersCheck[i].finishedFirst && !qualifiesByDistricts && !qualifiesByAltars) {
        playersCheck[i] = { ...playersCheck[i], finishedFirst: false };
        flagCleared = true;
      }
    }
    if (flagCleared) {
      state = { ...state, players: playersCheck };
    }

    const someoneFinished = state.players.some((p) => {
      const altarCount = p.builtDistricts.filter((d) => d.purpleAbility === "altar_darkness").length;
      return p.finishedFirst && (p.builtDistricts.length >= WIN_DISTRICTS || altarCount >= 4);
    });
    if (someoneFinished) {
      return calculateScores({ ...state, log: state.log });
    }

    // Tick plague duration by day.
    const plagueDaysLeft = Math.max(0, (state.plagueDaysLeft ?? 0) - 1);

    // Day is over — go back to draft for next day
    return {
      ...state,
      log: state.log,
      phase: "draft",
      draft: null,
      currentTurnIndex: 0,
      turnOrder: null,
      day: state.day + 1,
      plagueDaysLeft,
    };
  }

  // Apply passive for next player
  const nextPlayerIdx = turnOrder[nextIdx];
  let newState: GameState = { ...state, log: state.log, currentTurnIndex: nextIdx };
  newState = applyPassiveAbility(newState, nextPlayerIdx, rng);

  return newState;
}

/** Get the player index whose turn it is, or null */
export function currentPlayer(state: GameState): number | null {
  if (state.phase !== "turns" || !state.turnOrder) return null;
  if (state.currentTurnIndex >= state.turnOrder.length) return null;
  return state.turnOrder[state.currentTurnIndex];
}
