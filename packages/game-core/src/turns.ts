import type { GameState, DistrictCard, CardColor, PlayerState } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS, CompanionId, FLAME_CARD_NAME, FIRE_CARD_NAME, MAX_HAND_CARDS } from "@darms/shared-types";
import type { Rng } from "./rng.js";
import { applyPassiveAbility, checkWinCondition, calculateScores, canActWhileAssassinated, applySalvageTriggers } from "./abilities.js";
import { addRandomColor } from "./deck.js";

/** Hard cap: true iff this player can add one more district. */
export function canAddDistrict(player: PlayerState): boolean {
  return player.builtDistricts.length < WIN_DISTRICTS;
}

/** Safely add a district. No-op if at cap. */
export function pushBuiltDistrict(player: PlayerState, card: DistrictCard): PlayerState {
  if (!canAddDistrict(player)) return player;
  return { ...player, builtDistricts: [...player.builtDistricts, card] };
}

/**
 * Mark a companion slot in the given player's personal pool as permanently "gone"
 * (for leavesPool companions after use, and Sniper targets). Idempotent.
 */
export function markCompanionGone(player: PlayerState, companionId: CompanionId): PlayerState {
  const companionDeck = player.companionDeck.map((s) =>
    s.id === companionId ? { ...s, state: "gone" as const } : s,
  );
  return { ...player, companionDeck };
}

/**
 * Build the turn order for the current day based on hero speeds.
 * Lower speed = goes first. Ties broken randomly.
 * Courier companion: hero speed -2.
 * Also resets per-turn state and applies passive abilities for first player.
 */
export function buildTurnOrder(state: GameState, rng: Rng): GameState {
  // Compute each active hero's effective speed first (so we can post-modify it
  // for Interceptor without rerunning the comparator).
  const computeSpeed = (idx: number): number => {
    const p = state.players[idx];
    let speed = HEROES.find((h) => h.id === p.hero)!.speed;
    if (p.companion === CompanionId.Courier && !p.companionDisabled) speed -= 2;
    if (p.builtDistricts.some((d) => d.purpleAbility === "highway")) speed -= 1;
    return speed;
  };

  const indexed: Array<{ idx: number; hero: typeof state.players[number]["hero"]; speed: number }> = state.players
    .map((p, i) => ({ idx: i, hero: p.hero, speed: 0 }))
    .filter((p) => p.hero !== null && !state.players[p.idx].assassinated)
    .map((p) => ({ ...p, speed: computeSpeed(p.idx) }));

  indexed.sort((a, b) => {
    if (a.speed !== b.speed) return a.speed - b.speed;
    return rng.next() - 0.5;
  });

  // Interceptor: if the first-ordered player has Interceptor and is not the
  // only active hero, apply +1 speed to whoever was second. Re-sort positions
  // [1..] with the bumped speed so the slowdown can shift them past originally
  // slower heroes; the Interceptor owner's lead is unchanged.
  if (indexed.length >= 2) {
    const first = state.players[indexed[0].idx];
    if (first.companion === CompanionId.Interceptor && !first.companionDisabled) {
      const slowedIdx = indexed[1].idx;
      const tail = indexed.slice(1).map((p) => ({
        ...p,
        speed: p.idx === slowedIdx ? p.speed + 1 : p.speed,
      }));
      tail.sort((a, b) => {
        if (a.speed !== b.speed) return a.speed - b.speed;
        return rng.next() - 0.5;
      });
      indexed.splice(1, indexed.length - 1, ...tail);
    }
  }

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
  // Income is a turn-phase action — never accept it during draft / setup / end.
  // Without this gate, an income action that arrives just after the day rolls
  // over (initDraft resets incomeTaken to false) would silently grant gold.
  if (state.phase !== "turns") return null;
  // Hospital / Royal Healer allow an assassinated owner to still take income.
  if (player.assassinated && !canActWhileAssassinated(player)) return null;
  if (player.incomeTaken) return null;

  // Усиление stacks: count permanent enhancement bonuses.
  const goldEnhStacks = (player.enhancements ?? []).filter((e) => e === "gold").length;
  const cardEnhStacks = (player.enhancements ?? []).filter((e) => e === "card").length;

  const hasSwindler = player.companion === CompanionId.Swindler
    && !player.companionDisabled && !player.companionUsed;

  const rng = { int: (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1)) };
  const hasDruid = player.companion === CompanionId.Druid && !player.companionDisabled;
  // Усиление "card": each stack adds 1 bonus card directly to hand on top of
  // the standard 2-card offer (offer size stays at 2 — 1 picked, 1 returns).
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
  const drawEnhancementBonus = (
    deck: typeof state.deck,
  ) => {
    const newDeck = [...deck];
    const drawn: DistrictCard[] = [];
    for (let i = 0; i < cardEnhStacks && newDeck.length > 0; i++) {
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
    const goldGain = 2 + goldEnhStacks;
    newPlayers[playerIdx] = {
      ...player,
      gold: player.gold + goldGain,
      incomeTaken: true,
    };
    return {
      ...state,
      players: newPlayers,
      log: [...state.log, { day: state.day, message: `💰 ${player.name} берёт +${goldGain} золота${goldEnhStacks > 0 ? ` (Усиление ×${goldEnhStacks})` : ""}` }],
    };
  }

  if (choice === "card" && player.hand.length >= MAX_HAND_CARDS) {
    return null;
  }

  const offer = drawTwoOffer(state.deck);
  const bonus = drawEnhancementBonus(offer.newDeck);
  const newPlayers = [...state.players];
  newPlayers[playerIdx] = {
    ...player,
    hand: bonus.drawn.length > 0 ? [...player.hand, ...bonus.drawn] : player.hand,
    incomeOffer: offer.drawn,
  };
  const log = [...state.log, { day: state.day, message: `🃏 ${player.name} берёт 2 карты (выбирает 1)` }];
  if (bonus.drawn.length > 0) {
    log.push({ day: state.day, message: `✨ ${player.name} — Усиление ×${cardEnhStacks}: +${bonus.drawn.length}🃏 в руку` });
  }
  return {
    ...state,
    players: newPlayers,
    deck: bonus.newDeck,
    log,
  };
}

/**
 * Resolve a Plan grey-card pick. Picks one card from the current pendingPlanOffer
 * to put in hand; the other goes back to the bottom of the deck. If round=1,
 * a fresh round-2 offer is drawn. After round 2, the pending offer clears.
 */
export function pickPlanCard(
  state: GameState,
  playerId: string,
  cardId: string,
): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;
  const player = state.players[playerIdx];
  const pending = player.pendingPlanOffer;
  if (!pending || pending.choices.length === 0) return null;
  const pickIdx = pending.choices.findIndex((c) => c.id === cardId);
  if (pickIdx === -1) return null;

  const picked = pending.choices[pickIdx];
  const others = pending.choices.filter((_, i) => i !== pickIdx);
  let newDeck = [...state.deck, ...others]; // rejected cards go to bottom

  const freeSlots = Math.max(0, MAX_HAND_CARDS - player.hand.length);
  const accepted = freeSlots > 0;
  const newHand = accepted ? [...player.hand, picked] : player.hand;

  const newPlayers = [...state.players];

  if (pending.round === 1) {
    // Open round 2.
    const drawCount = Math.min(2, newDeck.length);
    const choices = newDeck.splice(0, drawCount);
    newPlayers[playerIdx] = {
      ...player,
      hand: newHand,
      pendingPlanOffer: { round: 2, choices },
    };
    const log = [
      ...state.log,
      { day: state.day, message: `📜 ${player.name} (План, тур 1): взял ${picked.name}` },
      { day: state.day, message: `📜 ${player.name} (План, тур 2): выбор из ${choices.length}` },
    ];
    if (!accepted) log.push({ day: state.day, message: `💥 ${player.name}: 1 карта рассыпалась (лимит руки ${MAX_HAND_CARDS})` });
    return { ...state, players: newPlayers, deck: newDeck, log };
  }

  // Round 2 — clear the offer.
  newPlayers[playerIdx] = {
    ...player,
    hand: newHand,
    pendingPlanOffer: null,
  };
  const log = [
    ...state.log,
    { day: state.day, message: `📜 ${player.name} (План, тур 2): взял ${picked.name}` },
  ];
  if (!accepted) log.push({ day: state.day, message: `💥 ${player.name}: 1 карта рассыпалась (лимит руки ${MAX_HAND_CARDS})` });
  return { ...state, players: newPlayers, deck: newDeck, log };
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

  let updated: PlayerState = {
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

  // Leader auto-builds City Gates if picked into hand (hard-capped at WIN_DISTRICTS).
  if (updated.hero === HeroId.King && canAddDistrict(updated)) {
    const gateIdx = updated.hand.findIndex((d) => d.purpleAbility === "city_gates");
    if (gateIdx !== -1) {
      const hand = [...updated.hand];
      const gate = hand[gateIdx];
      hand.splice(gateIdx, 1);
      const builtGate = { ...gate, cost: 8, originalCost: 8, hp: 8 };
      updated = pushBuiltDistrict({ ...updated, hand }, builtGate);
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
  targetCardId?: string,
  mode?: string,
): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;

  const player = state.players[playerIdx];
  if (player.assassinated) return null;
  if (player.buildsRemaining <= 0) return null;
  // Grey cards and spells are playable even at district cap (they don't add a district).
  // Real district build requires room.

  const cardIdx = player.hand.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) return null;

  const card = player.hand[cardIdx];

  // Cap check applies only to real districts (not spells, not grey).
  if (!card.spellAbility && !card.greyAbility && !canAddDistrict(player)) return null;

  // Placeholders are not buildable — they must be played via the dedicated action.
  if (card.placeholder === "purple") return null;

  // 🔥 Flame can be played away for 1💰. Stops a single Flame from contributing
  // to the end-of-day hand-burn or from feeding the 3-Flames → Fire combine.
  // Clearing a Flame is a hand-clean action, not a build — it does NOT consume
  // the player's buildsRemaining slot, so they can still build a real district
  // on the same turn.
  if (card.name === FLAME_CARD_NAME) {
    const flameClearCost = 1;
    if (player.gold < flameClearCost) return null;
    const newHand = [...player.hand];
    newHand.splice(cardIdx, 1);
    const newPlayers = [...state.players];
    newPlayers[playerIdx] = {
      ...player,
      gold: player.gold - flameClearCost,
      hand: newHand,
    };
    return { ...state, players: newPlayers, log: [...state.log, { day: state.day, message: `${player.name} погасил 🔥 Пламя за ${flameClearCost}💰` }] };
  }

  // 🔥 Fire can be played away for 3💰 to stop the per-turn burn early. Same
  // rationale as Flame — clearing it is hand-cleanup, not a build, so the
  // player keeps their buildsRemaining slot for an actual district.
  if (card.name === FIRE_CARD_NAME) {
    const fireClearCost = 3;
    if (player.gold < fireClearCost) return null;
    const newHand = [...player.hand];
    newHand.splice(cardIdx, 1);
    const newPlayers = [...state.players];
    newPlayers[playerIdx] = {
      ...player,
      gold: player.gold - fireClearCost,
      hand: newHand,
    };
    return { ...state, players: newPlayers, log: [...state.log, { day: state.day, message: `${player.name} потушил 🔥 Пожар за ${fireClearCost}💰` }] };
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

  // Duplicate check — only Official companion (red hero) allows duplicates.
  const allowDuplicates =
    player.companion === CompanionId.Official
    && !player.companionDisabled
    && heroColor === "red";

  if (!allowDuplicates && player.builtDistricts.some((d) => d.name === card.name)) return null;

  const newHand = [...player.hand];
  newHand.splice(cardIdx, 1);

  // One-shot spells: cast from hand, do not stay on table.
  if (card.spellAbility) {
    // Hero-color gate for spells with a non-purple printed colour. Bombardment
    // is purple+red → only General (red) may cast it; this generalises so any
    // future spell with a colour other than purple inherits the same rule.
    const spellNonPurpleColors = (card.colors ?? []).filter((c) => c !== "purple") as string[];
    if (spellNonPurpleColors.length > 0) {
      if (heroColor === null || !spellNonPurpleColors.includes(heroColor)) return null;
    }
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
          cost: 1,
          originalCost: 1,
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
    } else if (card.spellAbility === "bombardment") {
      // Bombardment: choose mode — "heavy" = 2 shots × 3 dmg, "spread" = 6 × 1 dmg.
      const heavy = mode !== "spread";
      const shots = heavy ? 2 : 6;
      const dmgPerShot = heavy ? 3 : 1;
      const destroyedNames: string[] = [];
      for (let s = 0; s < shots; s++) {
        const opps = newPlayers
          .map((p, i) => ({ p, i }))
          .filter((x) => x.i !== playerIdx && x.p.builtDistricts.length > 0 && !x.p.assassinated);
        if (opps.length === 0) break;
        const oppPick = opps[randomInt(0, opps.length - 1)];
        const opp = newPlayers[oppPick.i];
        const damageable = opp.builtDistricts
          .map((d, i) => ({ d, i }))
          .filter(({ d }) => d.purpleAbility !== "stronghold");
        if (damageable.length === 0) continue;
        const distPick = damageable[randomInt(0, damageable.length - 1)];
        const dist = opp.builtDistricts[distPick.i];
        const newCost = dist.cost - dmgPerShot;
        const newOppDistricts = [...opp.builtDistricts];
        if (newCost < 1) {
          newOppDistricts.splice(distPick.i, 1);
          destroyedNames.push(`${dist.name} (${opp.name})`);
        } else {
          newOppDistricts[distPick.i] = { ...dist, cost: newCost, hp: newCost };
        }
        newPlayers[oppPick.i] = { ...opp, builtDistricts: newOppDistricts };
      }
      log = [...log, { day: state.day, message: `💥 ${player.name} применил Обстрел (${heavy ? "2×3" : "6×1"}). Разрушено: ${destroyedNames.length > 0 ? destroyedNames.join(", ") : "—"}` }];
    } else if (card.spellAbility === "enhancement") {
      // Enhancement: permanent buff. mode = "card" or "gold".
      const enhMode = (mode === "gold" ? "gold" : "card") as "card" | "gold";
      const existing = newPlayers[playerIdx].enhancements ?? [];
      newPlayers[playerIdx] = {
        ...newPlayers[playerIdx],
        enhancements: [...existing, enhMode],
      };
      log = [...log, { day: state.day, message: `✨ ${player.name} применил Усиление (${enhMode === "card" ? "+1🃏" : "+1💰"} к доходу)` }];
    } else if (card.spellAbility === "fire_magic") {
      // Create 2 random spells (purple or grey) at -1 cost; if not played by end
      // of turn they convert to flame.
      // Avoid recursion: never roll fire_magic itself.
      const spellPool: { kind: "spell" | "grey"; ability: string; cost: number; name: string }[] = [
        { kind: "spell", ability: "ignite", cost: 1, name: "Поджигание" },
        { kind: "spell", ability: "gold_rain", cost: 0, name: "Золотой дождь" },
        { kind: "spell", ability: "holy_day", cost: 1, name: "Священный день" },
        { kind: "spell", ability: "flood", cost: 5, name: "Потоп" },
        { kind: "spell", ability: "plague", cost: 2, name: "Чума" },
        { kind: "spell", ability: "fire_ritual", cost: 3, name: "Ритуал огня" },
        { kind: "spell", ability: "bombardment", cost: 6, name: "Обстрел" },
        { kind: "spell", ability: "enhancement", cost: 3, name: "Усиление" },
        { kind: "grey", ability: "new_opportunities", cost: 2, name: "Новые возможности" },
        { kind: "grey", ability: "plan", cost: 4, name: "План" },
        { kind: "grey", ability: "burning_deadline", cost: 1, name: "Горящий срок" },
      ];
      const generated: DistrictCard[] = [];
      for (let i = 0; i < 2; i++) {
        const pick = spellPool[randomInt(0, spellPool.length - 1)];
        const reduced = Math.max(0, pick.cost - 1);
        const newCard: DistrictCard = pick.kind === "spell"
          ? {
            id: `firemagic-spell-${Date.now()}-${i}-${randomInt(0, 9999)}`,
            name: pick.name,
            cost: reduced,
            originalCost: reduced,
            hp: 0,
            colors: ["purple"],
            baseColors: ["purple"],
            spellAbility: pick.ability as DistrictCard["spellAbility"],
            fireMagicFuse: true,
          }
          : {
            id: `firemagic-grey-${Date.now()}-${i}-${randomInt(0, 9999)}`,
            name: pick.name,
            cost: reduced,
            originalCost: reduced,
            hp: 0,
            colors: [],
            baseColors: [],
            greyAbility: pick.ability as DistrictCard["greyAbility"],
            fireMagicFuse: true,
          };
        generated.push(newCard);
      }
      newPlayers[playerIdx] = {
        ...newPlayers[playerIdx],
        hand: [...newPlayers[playerIdx].hand, ...generated],
      };
      log = [...log, { day: state.day, message: `🔥 ${player.name} применил Магию огня: получил ${generated.map((c) => c.name).join(", ")} (фитиль до конца хода)` }];
    } else if (card.spellAbility === "fire_ritual") {
      // Sacrifice ONE of the caster's own built districts (chosen via targetCardId).
      // For every gold of its cost, plant a 🔥 Flame in a random opponent's hand
      // (each iteration rolls a fresh random opponent, so flames spread across
      // multiple players probabilistically).
      if (!targetCardId) return null;
      const sacrificedIdx = newPlayers[playerIdx].builtDistricts.findIndex((d) => d.id === targetCardId);
      if (sacrificedIdx === -1) return null;
      const sacrificed = newPlayers[playerIdx].builtDistricts[sacrificedIdx];
      const newDistricts = [...newPlayers[playerIdx].builtDistricts];
      newDistricts.splice(sacrificedIdx, 1);
      newPlayers[playerIdx] = { ...newPlayers[playerIdx], builtDistricts: newDistricts };
      const flameCount = Math.max(0, sacrificed.cost);
      const opponentIdxs = state.players
        .map((_, i) => i)
        .filter((i) => i !== playerIdx);
      for (let i = 0; i < flameCount && opponentIdxs.length > 0; i++) {
        const targetOpp = opponentIdxs[randomInt(0, opponentIdxs.length - 1)];
        const flameCard: DistrictCard = {
          id: `flame-fr-${Date.now()}-${i}-${randomInt(0, 9999)}`,
          name: FLAME_CARD_NAME,
          cost: 1,
          originalCost: 1,
          hp: 0,
          colors: ["red"],
          baseColors: ["red"],
        };
        newPlayers[targetOpp] = { ...newPlayers[targetOpp], hand: [...newPlayers[targetOpp].hand, flameCard] };
      }
      // Sacrificed district goes to the discard pile (so Reconstructor/Sorcerer's
      // Apprentice could later raise it back).
      const newDiscardPile = [...state.discardPile, sacrificed];
      log = [...log, { day: state.day, message: `🔥 ${player.name} применил Ритуал огня: сжёг ${sacrificed.name}, разослал ${flameCount} 🔥 случайным противникам` }];
      newPlayers[playerIdx] = {
        ...newPlayers[playerIdx],
        gold: player.gold - effectiveCost,
        hand: newHand,
        buildsRemaining: player.buildsRemaining - 1,
      };
      return { ...state, players: newPlayers, log, discardPile: newDiscardPile };
    }

    newPlayers[playerIdx] = {
      ...newPlayers[playerIdx],
      gold: player.gold - effectiveCost,
      hand: newHand,
      buildsRemaining: player.buildsRemaining - 1,
    };
    return { ...state, players: newPlayers, log, plagueDaysLeft: card.spellAbility === "plague" ? 3 : (state.plagueDaysLeft ?? 0) };
  }

  // Grey cards: spell-like effects from the shared deck. Cast from hand for cost.
  if (card.greyAbility) {
    const newPlayers = [...state.players];
    let log = state.log;
    let newDeck = [...state.deck];
    const randomInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

    if (card.greyAbility === "new_opportunities") {
      const drawCount = Math.min(2, newDeck.length);
      const drawn = newDeck.splice(0, drawCount);
      const freeSlots = Math.max(0, MAX_HAND_CARDS - newHand.length);
      const accepted = drawn.slice(0, freeSlots);
      const overflow = drawn.length - accepted.length;
      newPlayers[playerIdx] = {
        ...player,
        gold: player.gold - effectiveCost,
        hand: [...newHand, ...accepted],
        buildsRemaining: player.buildsRemaining - 1,
      };
      log = [...log, { day: state.day, message: `🌫️ ${player.name} разыграл Новые возможности: +${accepted.length}🃏` }];
      if (overflow > 0) {
        log = [...log, { day: state.day, message: `💥 ${player.name}: ${overflow} карт(ы) рассыпались (лимит руки ${MAX_HAND_CARDS})` }];
      }
      return { ...state, players: newPlayers, deck: newDeck, log };
    }
    if (card.greyAbility === "plan") {
      // Open the first round of 2 choices. The pick action serves both rounds.
      const drawCount = Math.min(2, newDeck.length);
      const choices = newDeck.splice(0, drawCount);
      newPlayers[playerIdx] = {
        ...player,
        gold: player.gold - effectiveCost,
        hand: newHand,
        buildsRemaining: player.buildsRemaining - 1,
        pendingPlanOffer: { round: 1, choices },
      };
      log = [...log, { day: state.day, message: `📜 ${player.name} разыграл План: 1-й тур (1 из ${choices.length})` }];
      return { ...state, players: newPlayers, deck: newDeck, log };
    }
    if (card.greyAbility === "burning_deadline") {
      const drawCount = Math.min(1, newDeck.length);
      if (drawCount === 0) {
        // Deck empty: still consume cost & build slot, no card drawn.
        newPlayers[playerIdx] = {
          ...player,
          gold: player.gold - effectiveCost,
          hand: newHand,
          buildsRemaining: player.buildsRemaining - 1,
        };
        return { ...state, players: newPlayers, deck: newDeck, log: [...log, { day: state.day, message: `🔥 ${player.name} разыграл Горящий срок, но колода пуста` }] };
      }
      const drawn = newDeck.splice(0, 1)[0];
      const stamped: DistrictCard = { ...drawn, burningDeadline: true };
      const freeSlots = Math.max(0, MAX_HAND_CARDS - newHand.length);
      const accepted = freeSlots > 0;
      newPlayers[playerIdx] = {
        ...player,
        gold: player.gold - effectiveCost,
        hand: accepted ? [...newHand, stamped] : newHand,
        buildsRemaining: player.buildsRemaining - 1,
      };
      log = [...log, { day: state.day, message: `🔥 ${player.name} разыграл Горящий срок: взял ${drawn.name} (не построит — превратится в Пламя)` }];
      if (!accepted) {
        log = [...log, { day: state.day, message: `💥 ${player.name}: 1 карта рассыпалась (лимит руки ${MAX_HAND_CARDS})` }];
      }
      return { ...state, players: newPlayers, deck: newDeck, log };
    }
    return null;
  }

  // Built card: cost is the unified value (HP/score). Original cost is preserved
  // for refunds/discounts. Monument bumps to 5 on the table (special card rule).
  let builtCard = { ...card, hp: card.cost, originalCost: card.originalCost ?? card.cost, baseColors: card.baseColors ?? card.colors };
  if (card.purpleAbility === "monument") {
    builtCard = { ...card, cost: 5, hp: 5, originalCost: card.originalCost ?? 5, baseColors: card.baseColors ?? card.colors };
  }

  // Inner Wall: on build, sacrifice a random own district and absorb its cost.
  let innerWallSacrifice: DistrictCard | null = null;
  let extraDiscardPile = state.discardPile;
  let postPlayers = [...state.players];
  if (card.purpleAbility === "inner_wall" && player.builtDistricts.length > 0) {
    const rng2 = { int: (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1)) };
    const candIdx = rng2.int(0, player.builtDistricts.length - 1);
    innerWallSacrifice = player.builtDistricts[candIdx];
    const remaining = [...player.builtDistricts];
    remaining.splice(candIdx, 1);
    extraDiscardPile = [...extraDiscardPile, innerWallSacrifice];
    postPlayers[playerIdx] = { ...postPlayers[playerIdx], builtDistricts: remaining };
    builtCard = {
      ...builtCard,
      cost: builtCard.cost + innerWallSacrifice.cost,
      hp: builtCard.cost + innerWallSacrifice.cost,
    };
  }

  // Fort: reduce other (non-fort) districts HP by 1 when on table
  // (Fort effect is passive — applied when checking HP, not on build)

  const beforePushPlayer = postPlayers[playerIdx] ?? player;
  const afterGoldHand = {
    ...beforePushPlayer,
    gold: beforePushPlayer.gold - effectiveCost,
    hand: newHand,
    buildsRemaining: beforePushPlayer.buildsRemaining - 1,
  };
  // Defensive: pushBuiltDistrict no-ops if somehow at cap.
  postPlayers[playerIdx] = pushBuiltDistrict(afterGoldHand, builtCard);

  // Heavy Artillery: stamp a fresh damage value on first build.
  if (card.purpleAbility === "heavy_artillery") {
    const built = postPlayers[playerIdx].builtDistricts[postPlayers[playerIdx].builtDistricts.length - 1];
    if (built) {
      const updated = { ...built, artilleryDamage: 1 };
      const arr = [...postPlayers[playerIdx].builtDistricts];
      arr[arr.length - 1] = updated;
      postPlayers[playerIdx] = { ...postPlayers[playerIdx], builtDistricts: arr };
    }
  }

  const buildLog: { day: number; message: string }[] = [
    { day: state.day, message: `🏗️ ${player.name} построил ${card.name}` },
  ];
  if (innerWallSacrifice) {
    buildLog.push({ day: state.day, message: `🧱 Внутренняя стена поглотила ${innerWallSacrifice.name} (+${innerWallSacrifice.cost} к стоимости)` });
  }

  let newState: GameState = {
    ...state,
    players: postPlayers,
    discardPile: extraDiscardPile,
    log: [...state.log, ...buildLog],
  };

  // Salvage Yard: passive trigger when an own district is destroyed (here,
  // by Inner Wall sacrifice).
  if (innerWallSacrifice) {
    newState = applySalvageTriggers(newState, playerIdx, [innerWallSacrifice]);
  }

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
 * Sektant Treasurer (green hero): +1 gold per Cult building anywhere on the board
 * at the end of the day.
 */
function applySektantEndOfDay(state: GameState): GameState {
  const cultCount = state.players.reduce(
    (acc, p) => acc + p.builtDistricts.filter((d) => d.purpleAbility === "cult").length,
    0,
  );
  if (cultCount === 0) return state;
  let newPlayers = [...state.players];
  let log = state.log;
  for (let i = 0; i < newPlayers.length; i++) {
    const p = newPlayers[i];
    if (p.companion !== CompanionId.Sektant || p.companionDisabled) continue;
    const heroDef = HEROES.find((h) => h.id === p.hero);
    if (heroDef?.color !== "green") continue;
    newPlayers[i] = { ...p, gold: p.gold + cultCount };
    log = [...log, { day: state.day, message: `🕯️ ${p.name} — сектант (торговец): +${cultCount}💰 за ${cultCount} Сект` }];
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

  // Skip assassinated players — but still process theft against them.
  // Hospital / Royal Healer let the dead still get a (limited) turn, so don't
  // skip in that case; their action layer enforces the build/ability lock.
  let players = [...state.players];
  while (
    nextIdx < turnOrder.length
    && players[turnOrder[nextIdx]].assassinated
    && !canActWhileAssassinated(players[turnOrder[nextIdx]])
  ) {
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

  // 🔥 Burning Deadline / Fire Magic fuse: any card in the just-ended player's
  // hand that was stamped as a fuse this turn but wasn't built/cast → 🔥 Flame.
  // Runs ONLY for the player whose turn just ended (not all players).
  {
    const endedIdx = state.turnOrder[state.currentTurnIndex];
    if (endedIdx !== undefined && players[endedIdx]) {
      const endedPlayer = players[endedIdx];
      let mutated = false;
      const newHand: typeof endedPlayer.hand = [];
      let burnedCount = 0;
      for (const c of endedPlayer.hand) {
        if (c.burningDeadline || c.fireMagicFuse) {
          newHand.push({
            id: `flame-fuse-${Date.now()}-${endedIdx}-${burnedCount}-${rng.int(0, 9999)}`,
            name: FLAME_CARD_NAME,
            cost: 1,
            originalCost: 1,
            hp: 0,
            colors: ["red"],
            baseColors: ["red"],
          });
          burnedCount++;
          mutated = true;
        } else {
          newHand.push(c);
        }
      }
      if (mutated) {
        players = [...players];
        players[endedIdx] = { ...endedPlayer, hand: newHand };
        log = [...log, { day: state.day, message: `🔥 ${endedPlayer.name}: ${burnedCount} карт(ы) с фитилём → Пламя` }];
      }
    }
  }

  // 🔥 End-of-turn Flame/Fire bookkeeping:
  //   1. Combine: any hand with 3+ Flames consumes 3 Flames and gains 1 Fire.
  //      Repeats while hand still has 3+ Flames (a freshly seeded 6-Flame hand
  //      collapses into 2 Fires immediately).
  //   2. Fire burn: every Fire in a hand discards 1 random non-flame, non-fire
  //      card from THAT hand at the end of every turn (any player's turn). If
  //      the hand has nothing burnable, the Fire idles harmlessly.
  // Flames themselves do NOT burn here — their burn fires only at end of day.
  for (let i = 0; i < players.length; i++) {
    let p = players[i];
    let mutated = false;
    let hand = [...p.hand];

    // Combine Flames → Fire
    let combinedFires = 0;
    while (hand.filter((c) => c.name === FLAME_CARD_NAME).length >= 3) {
      let removed = 0;
      hand = hand.filter((c) => {
        if (removed < 3 && c.name === FLAME_CARD_NAME) { removed++; return false; }
        return true;
      });
      hand.push({
        id: `fire-${Date.now()}-${i}-${combinedFires}-${rng.int(0, 9999)}`,
        name: FIRE_CARD_NAME,
        cost: 3,
        originalCost: 3,
        hp: 0,
        colors: ["red"],
        baseColors: ["red"],
      });
      combinedFires++;
      mutated = true;
    }
    if (combinedFires > 0) {
      log = [...log, { day: state.day, message: `🔥 ${p.name}: 3 Пламени слились в 🔥 Пожар (×${combinedFires})` }];
    }

    // Fire burns 1 random non-flame, non-fire card per Fire per turn
    const fireCount = hand.filter((c) => c.name === FIRE_CARD_NAME).length;
    if (fireCount > 0) {
      const burnedNames: string[] = [];
      for (let f = 0; f < fireCount; f++) {
        const burnableIdxs: number[] = [];
        for (let h = 0; h < hand.length; h++) {
          if (hand[h].name !== FLAME_CARD_NAME && hand[h].name !== FIRE_CARD_NAME) {
            burnableIdxs.push(h);
          }
        }
        if (burnableIdxs.length === 0) break;
        const pickIdx = burnableIdxs[rng.int(0, burnableIdxs.length - 1)];
        burnedNames.push(hand[pickIdx].name);
        hand.splice(pickIdx, 1);
      }
      if (burnedNames.length > 0) {
        log = [...log, { day: state.day, message: `🔥 Пожар у ${p.name} сжёг: ${burnedNames.join(", ")}` }];
        mutated = true;
      }
    }

    if (mutated) {
      players = [...players];
      players[i] = { ...p, hand };
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
    // End-of-day flame/fire resolution:
    //   1. Each remaining 🔥 Flame in a hand burns 1 random non-flame, non-fire
    //      card from that same hand. The Flame itself stays — clear it for 1💰
    //      next day or let it combine into a Fire.
    //   2. All 🔥 Fires self-discard (their per-turn burn already fired during
    //      each turn this day).
    {
      const flamePlayers = [...state.players];
      let fLog = state.log;
      for (let i = 0; i < flamePlayers.length; i++) {
        const p = flamePlayers[i];
        const flameCount = p.hand.filter((c) => c.name === FLAME_CARD_NAME).length;
        const hasFire = p.hand.some((c) => c.name === FIRE_CARD_NAME);
        if (flameCount === 0 && !hasFire) continue;
        let hand = [...p.hand];
        const burnedNames: string[] = [];
        for (let f = 0; f < flameCount; f++) {
          const burnableIdxs: number[] = [];
          for (let h = 0; h < hand.length; h++) {
            if (hand[h].name !== FLAME_CARD_NAME && hand[h].name !== FIRE_CARD_NAME) {
              burnableIdxs.push(h);
            }
          }
          if (burnableIdxs.length === 0) break;
          const pickIdx = burnableIdxs[rng.int(0, burnableIdxs.length - 1)];
          burnedNames.push(hand[pickIdx].name);
          hand.splice(pickIdx, 1);
        }
        const removedFires = hand.filter((c) => c.name === FIRE_CARD_NAME).length;
        hand = hand.filter((c) => c.name !== FIRE_CARD_NAME);
        if (burnedNames.length > 0) {
          fLog = [...fLog, { day: state.day, message: `🔥 Пламя у ${p.name} сожгло: ${burnedNames.join(", ")}` }];
        }
        if (removedFires > 0) {
          fLog = [...fLog, { day: state.day, message: `🔥 Пожар у ${p.name} догорел и исчез` }];
        }
        flamePlayers[i] = { ...p, hand };
      }
      state = { ...state, players: flamePlayers, log: fLog };
    }

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
        const newCost = target.cost - 1;
        if (newCost < 1) {
          const destroyed = districts[picked.dIdx];
          districts.splice(picked.dIdx, 1);
          plaguePlayers[picked.pIdx] = { ...owner, builtDistricts: districts };
          state = { ...state, discardPile: [...state.discardPile, destroyed] };
          plagueLog = [...plagueLog, { day: state.day, message: `☣️ Чума: у ${owner.name} разрушен ${destroyed.name}` }];
        } else {
          districts[picked.dIdx] = { ...target, cost: newCost, hp: newCost };
          plaguePlayers[picked.pIdx] = { ...owner, builtDistricts: districts };
          plagueLog = [...plagueLog, { day: state.day, message: `☣️ Чума: у ${owner.name} повреждён ${target.name} (${target.cost}→${newCost})` }];
        }
      }

      state = { ...state, players: plaguePlayers, log: plagueLog };
    }

    // End of day — apply end-of-day effects
    state = applyTreasurerEndOfDay(state, rng);
    state = applyRoyalGuardEndOfDay(state);
    state = applySektantEndOfDay(state);

    // Wake companions whose sleepEndDay has reached today. Companions picked today
    // were given sleepEndDay = state.day + 1, so they stay asleep through tomorrow.
    {
      const wakePlayers = state.players.map((p) => ({
        ...p,
        companionDeck: p.companionDeck.map((s) =>
          s.state === "sleeping" && s.sleepEndDay !== undefined && s.sleepEndDay <= state.day
            ? { id: s.id, state: "available" as const }
            : s,
        ),
      }));
      state = { ...state, players: wakePlayers };
    }

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
