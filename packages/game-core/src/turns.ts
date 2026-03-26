import type { GameState, DistrictCard } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS, CompanionId, FLAME_CARD_NAME } from "@darms/shared-types";
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
    buildsRemaining: p.hero === HeroId.Architect ? 3 : 1,
    abilityUsed: false,
    companionUsed: false,
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
 * Process income action: take 1 gold OR draw 1 card from deck.
 * Swindler companion: first income gives BOTH (gold + card), then can take one more.
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

  if (hasSwindler) {
    // Swindler: give BOTH gold + card, mark companion used, don't mark income taken
    let newDeck = [...state.deck];
    let newHand = [...player.hand];
    if (newDeck.length > 0) {
      let drawn = newDeck.shift()!;
      if (hasDruid) drawn = addRandomColor(drawn, rng);
      newHand = [...newHand, drawn];
    }
    const newPlayers = [...state.players];
    newPlayers[playerIdx] = {
      ...player,
      gold: player.gold + 1,
      hand: newHand,
      companionUsed: true, // swindler bonus used, but income NOT taken — can take once more
    };
    return {
      ...state,
      players: newPlayers,
      deck: newDeck,
      log: [...state.log, { day: state.day, message: `${player.name} — шулер: +1💰 и +1🃏` }],
    };
  }

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
  let drawn = newDeck.shift()!;
  if (hasDruid) drawn = addRandomColor(drawn, rng);

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

  // Cannot build flame cards
  if (card.name === FLAME_CARD_NAME) return null;

  // Calculate effective cost
  let effectiveCost = card.cost;
  const heroColor = HEROES.find((h) => h.id === player.hero)?.color ?? null;

  // Monument: cost = number of other cards in hand (after removing monument)
  if (card.purpleAbility === "monument") {
    effectiveCost = Math.max(0, player.hand.length - 1); // minus the monument itself
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

  // Duplicate check — Official (red hero) allows duplicates
  const allowDuplicates =
    player.companion === CompanionId.Official
    && !player.companionDisabled
    && heroColor === "red";

  if (!allowDuplicates && player.builtDistricts.some((d) => d.name === card.name)) return null;

  const newHand = [...player.hand];
  newHand.splice(cardIdx, 1);

  // Monument always has 3 HP on table
  let builtCard = { ...card, hp: card.cost };
  if (card.purpleAbility === "monument") {
    builtCard = { ...card, hp: 3 };
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

  let newState = { ...state, players: newPlayers };
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
    log = [...log, { day: state.day, message: `${p.name} — казначей: ${richest.name} отдал ${goldTransfer}💰${cardTransfer ? " и карту" : ""}` }];
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

  // Flame spreading: for each player, duplicate flame cards in hand at end of turn
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const flameCount = p.hand.filter((c) => c.name === FLAME_CARD_NAME).length;
    if (flameCount > 0) {
      const newFlames: DistrictCard[] = [];
      for (let f = 0; f < flameCount; f++) {
        newFlames.push({
          id: `flame-${Date.now()}-${i}-${f}-${rng.int(0, 9999)}`,
          name: FLAME_CARD_NAME,
          cost: 0,
          hp: 0,
          colors: ["red"],
        });
      }
      players = [...players];
      players[i] = { ...p, hand: [...p.hand, ...newFlames] };
      log = [...log, { day: state.day, message: `🔥 Пламя множится у ${p.name}! (+${flameCount})` }];
    }
  }

  // Mine: +1g at end of turn for players with mine
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const mineCount = p.builtDistricts.filter((d) => d.purpleAbility === "mine").length;
    if (mineCount > 0) {
      players = [...players];
      players[i] = { ...p, gold: p.gold + mineCount };
      log = [...log, { day: state.day, message: `⛏️ ${p.name} — шахта: +${mineCount}💰` }];
    }
  }

  // City Gates: HP -2 each turn, discards at 0
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const newDistricts = [...p.builtDistricts];
    let changed = false;
    let discardPile = state.discardPile;
    for (let d = newDistricts.length - 1; d >= 0; d--) {
      if (newDistricts[d].purpleAbility === "city_gates") {
        const newHp = newDistricts[d].hp - 2;
        if (newHp < 1) {
          discardPile = [...discardPile, newDistricts[d]];
          newDistricts.splice(d, 1);
          log = [...log, { day: state.day, message: `🚪 Врата в город ${p.name} разрушились!` }];
        } else {
          newDistricts[d] = { ...newDistricts[d], hp: newHp };
          log = [...log, { day: state.day, message: `🚪 Врата в город ${p.name}: HP → ${newHp}` }];
        }
        changed = true;
      }
    }
    if (changed) {
      players = [...players];
      players[i] = { ...p, builtDistricts: newDistricts };
      state = { ...state, discardPile };
    }
  }

  state = { ...state, players, log };

  if (nextIdx >= turnOrder.length) {
    // End of day — apply end-of-day companion effects
    state = applyTreasurerEndOfDay(state, rng);
    state = applyRoyalGuardEndOfDay(state);

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
      return calculateScores({ ...state, log: state.log });
    }

    // Day is over — go back to draft for next day
    return {
      ...state,
      log: state.log,
      phase: "draft",
      draft: null,
      currentTurnIndex: 0,
      turnOrder: null,
      day: state.day + 1,
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
