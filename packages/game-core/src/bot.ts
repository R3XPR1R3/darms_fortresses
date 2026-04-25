import type { GameState, GameAction, AbilityPayload } from "@darms/shared-types";
import { HeroId, HEROES, CompanionId, COMPANIONS, isPassiveCompanion, WIN_DISTRICTS } from "@darms/shared-types";
import { currentDrafter } from "./draft.js";
import { currentPlayer } from "./turns.js";
import { createRng } from "./rng.js";

/**
 * Simple AI bot — makes reasonable but not optimal decisions.
 * Returns the action it wants to take, or null if it's not its turn.
 */
export function botAction(state: GameState, botPlayerId: string): GameAction | null {
  const rng = createRng(state.rng + botPlayerId.charCodeAt(0));

  // Pending purple placeholder pick — choose one from the offer.
  const botIdx = state.players.findIndex((p) => p.id === botPlayerId);
  if (botIdx !== -1) {
    const offer = state.players[botIdx].pendingPurpleOffer;
    if (offer && offer.length > 0) {
      const bestIdx = pickBestPurpleCard(state, botIdx, offer, rng);
      const clampedIdx = Math.max(0, Math.min(offer.length - 1, bestIdx));
      return { type: "purple_placeholder_pick", playerId: botPlayerId, offerIndex: clampedIdx };
    }
  }

  if (state.phase === "draft") {
    const draft = state.draft!;

    // Companion draft phase — personal pool (3 slots), filter to available.
    if (draft.draftPhase === "companion") {
      const drafterIdx = currentDrafter(state);
      if (drafterIdx === null) return null;
      if (state.players[drafterIdx].id !== botPlayerId) return null;
      const pool = draft.companionChoices?.[0] ?? [];
      if (pool.length === 0) {
        return { type: "companion_skip", playerId: botPlayerId };
      }
      const pick = pickBestCompanion(state, drafterIdx, pool, rng);
      return { type: "companion_pick", playerId: botPlayerId, companionId: pick };
    }

    // Hero draft phase — sequential
    const drafterIdx = currentDrafter(state);
    if (drafterIdx === null) return null;
    if (state.players[drafterIdx].id !== botPlayerId) return null;

    const available = draft.availableHeroes;
    if (available.length === 0) return null;

    const player = state.players[drafterIdx];
    const bestHero = scoreDraftPick(player, available, state, rng);
    return { type: "draft_pick", playerId: botPlayerId, heroId: bestHero };
  }

  if (state.phase === "turns") {
    const playerIdx = currentPlayer(state);
    if (playerIdx === null) return null;
    const player = state.players[playerIdx];
    if (player.id !== botPlayerId) return null;

    // Step 1: Use ability if not used
    if (!player.abilityUsed && player.hero) {
      const abilityAction = pickAbility(state, player.id, player.hero, rng);
      if (abilityAction) return abilityAction;
    }

    // Step 2: Take income if not taken
    if (player.incomeOffer && player.incomeOffer.length > 0) {
      const pick = [...player.incomeOffer].sort((a, b) => b.cost - a.cost)[0];
      return { type: "income_pick", playerId: botPlayerId, cardId: pick.id };
    }

    // Step 2: Take income if not taken
    if (!player.incomeTaken) {
      const canBuild = player.hand.some(
        (c) => c.cost <= player.gold + 1 && !player.builtDistricts.some((d) => d.name === c.name) && c.placeholder !== "purple",
      );
      return {
        type: "income",
        playerId: botPlayerId,
        choice: canBuild ? "gold" : "card",
      };
    }

    // Step 2.2: Play a purple placeholder if present — it's free and fetches a purple card.
    const placeholder = player.hand.find((c) => c.placeholder === "purple");
    if (placeholder && player.purplePool.length > 0) {
      return { type: "purple_placeholder_play", playerId: botPlayerId, cardId: placeholder.id };
    }

    // Step 2.5: Use active companion after income
    if (!player.companionUsed && player.companion && !player.companionDisabled) {
      if (!isPassiveCompanion(player.companion)) {
        const companionAction = pickCompanionAction(state, playerIdx, rng);
        if (companionAction) return companionAction;
      }
    }

    // Step 2.7: Activate purple buildings
    const activatable = player.builtDistricts.filter((d) => d.purpleAbility);
    for (const bld of activatable) {
      if (bld.purpleAbility === "cannon" && player.gold >= 2) {
        // Use cannon if we have spare gold
        return { type: "activate_building", playerId: botPlayerId, cardId: bld.id };
      }
      if (bld.purpleAbility === "tnt_storage" && player.gold >= 2) {
        // Use TNT if opponent is winning
        const maxOppDist = Math.max(...state.players.filter((p, i) => i !== playerIdx).map((p) => p.builtDistricts.length));
        if (maxOppDist >= 6) {
          return { type: "activate_building", playerId: botPlayerId, cardId: bld.id };
        }
      }
    }

    // Step 3: Build if possible
    if (player.buildsRemaining > 0) {
      const distToWin = WIN_DISTRICTS - player.builtDistricts.length;
      const rushing = player.hero === HeroId.Architect && distToWin <= 3 && player.buildsRemaining > 1;
      const buildable = player.hand
        .filter((c) => {
          const dup = player.builtDistricts.some((d) => d.name === c.name);
          // Official companion (red hero): allow duplicates
          const allowDup = player.companion === CompanionId.Official && !player.companionDisabled
            && player.hero && ["general"].includes(player.hero);
          if (dup && !allowDup) return false;
          return c.cost <= player.gold;
        })
        .sort((a, b) => rushing
          ? a.cost - b.cost
          : b.cost - a.cost
        );

      if (buildable.length > 0) {
        return {
          type: "build",
          playerId: botPlayerId,
          cardId: buildable[0].id,
        };
      }
    }

    // Step 4: End turn
    return { type: "end_turn", playerId: botPlayerId };
  }

  return null;
}

/** Pick best companion from pool based on game state */
function pickBestCompanion(
  state: GameState,
  playerIdx: number,
  pool: CompanionId[],
  rng: ReturnType<typeof createRng>,
): CompanionId {
  const player = state.players[playerIdx];
  const heroColor = player.hero ? (HEROES.find((h) => h.id === player.hero)?.color ?? null) : null;

  // Filter to companions the bot can actually pick (hero color restriction)
  const eligible = pool.filter((cId) => {
    const def = COMPANIONS.find((c) => c.id === cId);
    if (def?.heroColor && def.heroColor !== heroColor) return false;
    return true;
  });

  // Fallback: if nothing eligible, just pick the first pool entry — caller should
  // have used companion_skip instead, but this keeps us safe.
  if (eligible.length === 0) {
    return pool[0];
  }

  // Only one option — pick it immediately
  if (eligible.length === 1) {
    return eligible[0];
  }

  const candidates = eligible;

  let bestId = candidates[0];
  let bestScore = -Infinity;

  for (const cId of candidates) {
    let score = rng.next() * 2; // small random noise

    switch (cId) {
      case CompanionId.Farmer: score += 3; break;
      case CompanionId.Treasurer: score += player.gold < 3 ? 4 : 2; break;
      case CompanionId.Hunter: score += player.gold >= 3 ? 4 : 1; break;
      case CompanionId.Mason: score += player.hand.length >= 3 ? 3 : 1; break;
      case CompanionId.Saboteur: score += 3; break;
      case CompanionId.Official: {
        const heroColor = player.hero ? (player.hero === HeroId.General ? "red" : null) : null;
        score += heroColor === "red" ? 5 : 0;
        break;
      }
      case CompanionId.Blacksmith: score += 3; break;
      case CompanionId.SunPriestess: {
        const isBlue = player.hero === HeroId.Cleric;
        const blueCards = player.hand.filter((c) => c.colors.includes("blue")).length;
        score += isBlue ? 4 + blueCards : 0;
        break;
      }
      case CompanionId.Courier: score += 3; break;
      case CompanionId.RoyalGuard: {
        const hasYellow = player.builtDistricts.some((d) => d.colors.includes("yellow"));
        score += hasYellow ? 5 : 2;
        break;
      }
      case CompanionId.Swindler: score += 5; break; // very strong
      case CompanionId.Artist: {
        const colors = new Set(player.builtDistricts.flatMap((d) => d.colors));
        score += colors.size >= 3 ? 5 : colors.size;
        break;
      }
      case CompanionId.Druid: score += 3; break;
      case CompanionId.Marauder: score += player.hero === HeroId.Assassin ? 6 : 1; break;
      case CompanionId.Bard: score += 3; break;
      case CompanionId.Alchemist: score += player.builtDistricts.length >= 3 ? 4 : 1; break;
      // Wave 2
      case CompanionId.Cannoneer: score += player.hand.length >= 3 ? 4 : 1; break;
      case CompanionId.Reconstructor: score += state.discardPile.length > 0 ? 4 : 2; break;
      case CompanionId.DubiousDealer: score += 0; break; // debuff — recolors everything randomly
      case CompanionId.SorcererApprentice: score += state.discardPile.length > 0 ? 3 : 1; break;
      case CompanionId.StrangeMerchant: score += player.hand.length >= 3 ? 3 : 1; break;
      case CompanionId.Gravedigger: score += player.hero === HeroId.Assassin ? 5 : 1; break;
      case CompanionId.Jester: score += 1; break; // debuff
      case CompanionId.Pyromancer: score += 0; break; // debuff
      case CompanionId.SunFanatic: score += 2; break;
      case CompanionId.Sniper: score += 4; break;
      case CompanionId.Knight: score += 3; break;
      case CompanionId.Fisherman: score += player.gold >= 2 ? 4 : 2; break;
      case CompanionId.UnluckyMage: score += 0; break; // debuff
      case CompanionId.Nobility: score += player.gold >= 4 ? 4 : 1; break;
      // Wave 3
      case CompanionId.TreasureTrader: score += 4; break; // strong in purple draft
      case CompanionId.Designer: score += player.builtDistricts.length >= 3 ? 3 : 1; break;
      case CompanionId.Innkeeper: score += 2; break; // info only
      case CompanionId.Peacemaker: {
        const dangerousCount = state.players.reduce((acc, p) =>
          acc + p.builtDistricts.filter((d) => d.purpleAbility === "cannon" || d.purpleAbility === "tnt_storage" || d.purpleAbility === "cult").length, 0);
        score += dangerousCount >= 2 ? 5 : 1;
        break;
      }
      case CompanionId.Contractor: score += player.hero === HeroId.Assassin ? 5 : 1; break;
      case CompanionId.NightShadow: score += player.gold >= 3 ? 4 : 2; break;
      case CompanionId.TreasureTrader: score += 3; break;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = cId;
    }
  }
  return bestId;
}

/** Evaluate purple card offers and return the best card index (0-2) — always picks a card */
function pickBestPurpleCard(
  state: GameState,
  playerIdx: number,
  offers: GameState["players"][0]["hand"],
  rng: ReturnType<typeof createRng>,
): number {
  const player = state.players[playerIdx];
  const builtAbilities = new Set(player.builtDistricts.map((d) => d.purpleAbility).filter(Boolean));
  const builtNames = new Set(player.builtDistricts.map((d) => d.name));

  // Always pick at least a random card — fallback to index 0
  let bestIdx = Math.floor(rng.next() * offers.length);
  let bestScore = -Infinity;

  for (let i = 0; i < offers.length; i++) {
    const card = offers[i];
    let score = rng.next() * 1.5; // small random noise

    // Skip duplicates of already-built districts
    if (builtNames.has(card.name)) {
      score -= 10;
    }

    // Base scoring by purple ability
    switch (card.purpleAbility) {
      case "mine":
        // +1 gold per turn — excellent
        score += 8;
        break;
      case "cannon":
        // Cheap removal tool
        score += 6;
        break;
      case "fort":
        // Cheap defensive building
        score += 5;
        break;
      case "crypt":
        // Gives purple cards on destroy — decent
        score += 5;
        break;
      case "monument":
        // Cost depends on hand size, always 3 HP — good if hand is small
        score += player.hand.length <= 3 ? 6 : 3;
        break;
      case "tnt_storage": {
        // Risky — only good when opponent is ahead
        const maxOpp = Math.max(...state.players.filter((_, i) => i !== playerIdx).map((p) => p.builtDistricts.length));
        score += maxOpp >= 5 ? 6 : 2;
        break;
      }
      case "highway":
        // Speed -1, expensive (4g) — situational
        score += 3;
        break;
      case "city_gates":
        // Very expensive (8g), decays — usually bad
        score += player.gold >= 6 ? 3 : 1;
        break;
      case "cult":
        // Replaces random blue/purple — can backfire on own buildings
        score += player.builtDistricts.filter((d) => d.colors.includes("blue") || d.colors.includes("purple")).length > 0 ? 1 : 5;
        break;
      default:
        score += 3;
    }

    // Already have this ability — lower value of duplicates
    if (card.purpleAbility && builtAbilities.has(card.purpleAbility)) {
      score -= 3;
    }

    // Prefer cards we can afford to build soon
    if (card.cost <= player.gold) score += 2;
    else if (card.cost <= player.gold + 3) score += 1;

    // Bonus for color synergy with hand/built
    for (const color of card.colors) {
      if (player.builtDistricts.some((d) => d.colors.includes(color))) score += 0.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/** Pick an active companion action for the bot */
function pickCompanionAction(
  state: GameState,
  playerIdx: number,
  rng: ReturnType<typeof createRng>,
): GameAction | null {
  const player = state.players[playerIdx];
  if (!player.companion) return null;

  const opponents = state.players.filter((p, i) => i !== playerIdx && !p.assassinated);

  switch (player.companion) {
    // Farmer is passive — no use_companion action needed.

    case CompanionId.Hunter: {
      if (player.gold < 2) return null;
      const target = opponents.filter((p) => p.hand.length >= 2)
        .sort((a, b) => b.hand.length - a.hand.length)[0];
      if (!target) return null;
      return { type: "use_companion", playerId: player.id, targetPlayerId: target.id };
    }

    case CompanionId.Mason: {
      if (player.gold < 1 || player.hand.length === 0) return null;
      return { type: "use_companion", playerId: player.id };
    }

    case CompanionId.Saboteur: {
      const target = opponents.filter((p) => p.companion && !p.companionDisabled)
        .sort((a, b) => b.builtDistricts.length - a.builtDistricts.length)[0];
      if (!target) return null;
      return { type: "use_companion", playerId: player.id, targetPlayerId: target.id };
    }

    case CompanionId.Blacksmith: {
      // Find a district to swap — prefer opponent's cheap districts
      for (const opp of opponents) {
        if (opp.builtDistricts.length > 0) {
          const cheapest = [...opp.builtDistricts].sort((a, b) => a.cost - b.cost)[0];
          return {
            type: "use_companion",
            playerId: player.id,
            targetPlayerId: opp.id,
            targetCardId: cheapest.id,
          };
        }
      }
      return null;
    }

    case CompanionId.Bard: {
      const cost = 1 + state.bardUsageCount;
      if (player.gold < cost) return null;
      const target = opponents.filter((p) => {
        if (!p.companion || p.companionDisabled) return false;
        const targetIdx = state.players.findIndex((sp) => sp.id === p.id);
        if (targetIdx === -1 || !state.turnOrder) return true;
        const posInOrder = state.turnOrder.indexOf(targetIdx);
        return posInOrder === -1 || posInOrder > state.currentTurnIndex;
      })
        .sort((a, b) => b.builtDistricts.length - a.builtDistricts.length)[0];
      if (!target) return null;
      return { type: "use_companion", playerId: player.id, targetPlayerId: target.id };
    }

    case CompanionId.Alchemist: {
      const upgradeable = player.builtDistricts.filter((d) => d.cost < 5);
      if (upgradeable.length === 0) return null;
      const target = [...upgradeable].sort((a, b) => a.cost - b.cost)[0];
      return { type: "use_companion", playerId: player.id, targetCardId: target.id };
    }

    case CompanionId.Cannoneer: {
      // Burn cheapest non-flame card from hand
      const burnable = player.hand.filter((c) => c.name !== "🔥 Пламя");
      if (burnable.length === 0) return null;
      const cheapest = [...burnable].sort((a, b) => a.cost - b.cost)[0];
      return { type: "use_companion", playerId: player.id, targetCardId: cheapest.id };
    }

    case CompanionId.Reconstructor: {
      if (player.gold < 2 || state.discardPile.length === 0) return null;
      return { type: "use_companion", playerId: player.id };
    }

    case CompanionId.DubiousDealer:
      // Debuff — recolors everything randomly, bot should avoid using it
      return null;

    case CompanionId.SorcererApprentice: {
      if (player.gold < 2 || state.discardPile.length === 0) return null;
      return { type: "use_companion", playerId: player.id };
    }

    case CompanionId.StrangeMerchant: {
      // Sell most expensive card
      if (player.hand.length === 0) return null;
      const expensive = [...player.hand].sort((a, b) => b.cost - a.cost)[0];
      return { type: "use_companion", playerId: player.id, targetCardId: expensive.id };
    }

    case CompanionId.SunFanatic: {
      if (player.gold < 2) return null;
      return { type: "use_companion", playerId: player.id };
    }

    case CompanionId.Sniper: {
      const target = opponents.filter((p) => p.companion)
        .sort((a, b) => b.builtDistricts.length - a.builtDistricts.length)[0];
      if (!target) return null;
      return { type: "use_companion", playerId: player.id, targetPlayerId: target.id };
    }

    case CompanionId.Fisherman: {
      if (player.gold < 1) return null;
      return { type: "use_companion", playerId: player.id };
    }

    case CompanionId.Designer: {
      // Mark cheapest built district
      if (player.builtDistricts.length === 0) return null;
      const cheapest = [...player.builtDistricts].sort((a, b) => a.cost - b.cost)[0];
      return { type: "use_companion", playerId: player.id, targetCardId: cheapest.id };
    }

    case CompanionId.Innkeeper:
      return { type: "use_companion", playerId: player.id };

    case CompanionId.Peacemaker: {
      // Only use if there are dangerous buildings on the table
      const dangerousCount = state.players.reduce((acc, p) =>
        acc + p.builtDistricts.filter((d) => d.purpleAbility === "cannon" || d.purpleAbility === "tnt_storage" || d.purpleAbility === "cult").length, 0);
      if (dangerousCount === 0) return null;
      return { type: "use_companion", playerId: player.id };
    }

    case CompanionId.NightShadow: {
      // Pay 2g to assassinate strongest unrevealed hero
      if (player.gold < 2) return null;
      if (!state.turnOrder) return null;
      // Find unrevealed heroes (those after current turn)
      const unrevealed = state.players
        .filter((p, i) => {
          if (i === playerIdx || !p.hero || p.assassinated) return false;
          const posInOrder = state.turnOrder!.indexOf(i);
          return posInOrder === -1 || posInOrder > state.currentTurnIndex;
        })
        .sort((a, b) => b.builtDistricts.length - a.builtDistricts.length);
      if (unrevealed.length === 0) return null;
      return { type: "use_companion", playerId: player.id, targetHeroId: unrevealed[0].hero! };
    }

    case CompanionId.Contractor: {
      const faceUpBans = state.draft?.faceUpBans ?? [];
      const revealedHeroes = new Set(
        state.players
          .filter((_, i) => {
            if (!state.turnOrder) return false;
            const pos = state.turnOrder.indexOf(i);
            return pos !== -1 && pos <= state.currentTurnIndex;
          })
          .map((p) => p.hero)
          .filter((h): h is HeroId => h !== null),
      );
      const targets = Object.values(HeroId).filter((h) =>
        h !== HeroId.Assassin && !faceUpBans.includes(h) && !revealedHeroes.has(h),
      );
      if (targets.length === 0) return null;
      return { type: "use_companion", playerId: player.id, targetHeroId: targets[Math.floor(Math.random() * targets.length)] };
    }

    case CompanionId.TreasureTrader:
      // Active now: pull a random purple building.
      return { type: "use_companion", playerId: player.id };

    // Bots avoid debuff companions (Pyromancer, UnluckyMage)
    case CompanionId.Pyromancer:
    case CompanionId.UnluckyMage:
      return null;

    default:
      return null;
  }
}

function pickAbility(
  state: GameState,
  playerId: string,
  heroId: HeroId,
  rng: ReturnType<typeof createRng>,
): GameAction | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  const player = state.players[playerIdx];

  switch (heroId) {
    case HeroId.Assassin: {
      // Target the most threatening opponent (most districts, then most gold)
      const candidates = state.players
        .filter((p) => p.hero && p.hero !== HeroId.Assassin && p.id !== playerId);
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => {
        const da = a.builtDistricts.length, db = b.builtDistricts.length;
        if (da !== db) return db - da;
        return (b.gold + b.hand.length) - (a.gold + a.hand.length);
      });
      const target = candidates[0].hero!;
      const ability: AbilityPayload = { hero: "assassin", targetHeroId: target };
      return { type: "ability", playerId, ability };
    }
    case HeroId.Thief: {
      const candidates = state.players
        .filter((p) => p.hero && p.hero !== HeroId.Thief && p.hero !== HeroId.Assassin && p.id !== playerId && !p.assassinated);
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => {
        if (a.gold !== b.gold) return b.gold - a.gold;
        return b.hand.length - a.hand.length;
      });
      const target = candidates[0].hero!;
      const ability: AbilityPayload = { hero: "thief", targetHeroId: target };
      return { type: "ability", playerId, ability };
    }
    case HeroId.Sorcerer: {
      if (player.hand.length <= 1) {
        return { type: "ability", playerId, ability: { hero: "sorcerer", mode: "draw" } };
      }
      const richest = state.players
        .filter((p) => p.id !== playerId && !p.assassinated)
        .sort((a, b) => b.hand.length - a.hand.length)[0];
      if (richest && richest.hand.length > player.hand.length) {
        return {
          type: "ability",
          playerId,
          ability: { hero: "sorcerer", mode: "swap", targetPlayerId: richest.id },
        };
      }
      return { type: "ability", playerId, ability: { hero: "sorcerer", mode: "draw" } };
    }
    case HeroId.General: {
      if (player.gold < 1) return null;
      const targets = state.players
        .filter((p) => p.id !== playerId && p.builtDistricts.length > 0 && p.hero !== HeroId.Cleric)
        .sort((a, b) => b.builtDistricts.length - a.builtDistricts.length);
      if (targets.length === 0) return null;
      const target = targets[0];
      const destroyable = [...target.builtDistricts]
        .filter((d) => d.cost <= player.gold)
        .sort((a, b) => a.cost - b.cost)[0];
      const pick = destroyable ?? [...target.builtDistricts].sort((a, b) => a.cost - b.cost)[0];
      if (pick) {
        return {
          type: "ability",
          playerId,
          ability: { hero: "general", targetPlayerId: target.id, cardId: pick.id },
        };
      }
      return null;
    }
    case HeroId.King:
    case HeroId.Cleric:
    case HeroId.Merchant:
    case HeroId.Architect:
      return { type: "ability", playerId, ability: { hero: heroId } };
    default:
      return null;
  }
}

/**
 * Smart hero selection for bot draft.
 */
function scoreDraftPick(
  player: GameState["players"][0],
  available: HeroId[],
  state: GameState,
  rng: ReturnType<typeof createRng>,
): HeroId {
  const heroColorMap: Record<string, string> = {
    [HeroId.King]: "yellow",
    [HeroId.Cleric]: "blue",
    [HeroId.Merchant]: "green",
    [HeroId.General]: "red",
  };

  const builtColorCounts: Record<string, number> = {};
  for (const d of player.builtDistricts) {
    for (const c of d.colors) {
      builtColorCounts[c] = (builtColorCounts[c] || 0) + 1;
    }
  }

  const handColorCounts: Record<string, number> = {};
  for (const d of player.hand) {
    for (const c of d.colors) {
      handColorCounts[c] = (handColorCounts[c] || 0) + 1;
    }
  }

  const baseValue: Record<string, number> = {
    [HeroId.Assassin]: 6,
    [HeroId.Thief]: 5,
    [HeroId.Sorcerer]: 4,
    [HeroId.King]: 5,
    [HeroId.Cleric]: 5,
    [HeroId.Merchant]: 6,
    [HeroId.Architect]: 7,
    [HeroId.General]: 4,
  };

  const myDistricts = player.builtDistricts.length;
  const myGold = player.gold;
  const myHandSize = player.hand.length;
  const distancesToWin = WIN_DISTRICTS - myDistricts;

  const opponents = state.players.filter((p) => p.id !== player.id);
  const maxDistricts = Math.max(...opponents.map((p) => p.builtDistricts.length));
  const threatLevel = maxDistricts >= 6 ? 3 : maxDistricts >= 5 ? 1.5 : 0;
  const maxOppGold = Math.max(...opponents.map((p) => p.gold));
  const maxOppHand = Math.max(...opponents.map((p) => p.hand.length));

  const faceUpBans = state.draft?.faceUpBans ?? [];

  // Bias towards heroes whose color matches the bot's build: any companion in
  // the bot's personal deck with a hero-colour lock implies that build expects
  // that color (e.g., SunPriestess → blue → Cleric).
  const buildColorBias: Record<string, number> = {};
  for (const slot of player.companionDeck) {
    const def = COMPANIONS.find((c) => c.id === slot.id);
    if (def?.heroColor) {
      buildColorBias[def.heroColor] = (buildColorBias[def.heroColor] ?? 0) + 1;
    }
  }

  let bestHero = available[0];
  let bestScore = -Infinity;

  for (const h of available) {
    let score = baseValue[h] ?? 3;

    const hColor = heroColorMap[h];
    if (hColor) {
      const builtCount = builtColorCounts[hColor] || 0;
      const handCount = handColorCounts[hColor] || 0;
      score += builtCount * 2;
      score += handCount * 1;
      // Build bias: each color-matched companion adds a small pull.
      score += (buildColorBias[hColor] ?? 0) * 2.5;
    }

    if (threatLevel > 0) {
      if (h === HeroId.Assassin) score += threatLevel;
      if (h === HeroId.General) score += threatLevel * 0.7;
    }

    if (h === HeroId.Thief) {
      if (maxOppGold >= 5) score += 3;
      else if (maxOppGold >= 3) score += 1.5;
    }

    if (h === HeroId.Sorcerer) {
      if (maxOppHand >= 5) score += 3;
      else if (maxOppHand >= 3 && maxOppHand > player.hand.length) score += 2;
    }

    if (faceUpBans.includes(HeroId.Assassin)) {
      if (h === HeroId.Architect || h === HeroId.Merchant) score += 1.5;
    }

    if (player.gold <= 1 && h === HeroId.Merchant) score += 2;
    if (player.hand.length >= 4 && h === HeroId.Architect) score += 2;
    if (h === HeroId.Cleric && myDistricts >= 4) score += 2;
    if (h === HeroId.Cleric && distancesToWin <= 2) score += 5;
    if (h === HeroId.Cleric && distancesToWin <= 3) score += 3;

    if (h === HeroId.Architect && distancesToWin <= 3) {
      const buildableCards = player.hand.filter(
        (c) => c.cost <= myGold && !player.builtDistricts.some((d) => d.name === c.name),
      ).length;
      if (buildableCards >= 2) score += 6;
      else if (buildableCards >= 1 && myHandSize >= 3) score += 4;
      else if (myGold >= 4) score += 3;
    }

    if (distancesToWin >= 5 && (h === HeroId.Merchant || h === HeroId.King)) score += 1.5;

    score += (rng.next() - 0.5) * 3;

    if (score > bestScore) {
      bestScore = score;
      bestHero = h;
    }
  }

  return bestHero;
}
