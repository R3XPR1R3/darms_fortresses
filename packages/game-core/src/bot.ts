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

  if (state.phase === "draft") {
    const draft = state.draft!;

    // Companion draft phase — sequential, same order as hero draft
    if (draft.draftPhase === "companion") {
      const drafterIdx = currentDrafter(state);
      if (drafterIdx === null) return null;
      if (state.players[drafterIdx].id !== botPlayerId) return null;
      const pool = draft.companionChoices?.[0];
      if (!pool || pool.length === 0) return null;
      // Pick best companion for the bot
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
    if (!player.incomeTaken) {
      const canBuild = player.hand.some(
        (c) => c.cost <= player.gold + 1 && !player.builtDistricts.some((d) => d.name === c.name),
      );
      return {
        type: "income",
        playerId: botPlayerId,
        choice: canBuild ? "gold" : "card",
      };
    }

    // Step 2.5: Use active companion after income
    if (!player.companionUsed && player.companion && !player.companionDisabled) {
      if (!isPassiveCompanion(player.companion)) {
        const companionAction = pickCompanionAction(state, playerIdx, rng);
        if (companionAction) return companionAction;
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

  // Fallback: if nothing eligible, pick first available (will be rejected by server, but safe)
  const candidates = eligible.length > 0 ? eligible : pool;

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
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = cId;
    }
  }
  return bestId;
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
    case CompanionId.Farmer:
      return { type: "use_companion", playerId: player.id };

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
      const target = opponents.filter((p) => p.companion && !p.companionDisabled)
        .sort((a, b) => b.builtDistricts.length - a.builtDistricts.length)[0];
      if (!target) return null;
      return { type: "use_companion", playerId: player.id, targetPlayerId: target.id };
    }

    case CompanionId.Alchemist: {
      const upgradeable = player.builtDistricts.filter((d) => d.cost < 5);
      if (upgradeable.length === 0) return null;
      // Pick cheapest to upgrade
      const target = [...upgradeable].sort((a, b) => a.cost - b.cost)[0];
      return { type: "use_companion", playerId: player.id, targetCardId: target.id };
    }

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
        .filter((d) => d.hp <= player.gold)
        .sort((a, b) => a.hp - b.hp)[0];
      const pick = destroyable ?? [...target.builtDistricts].sort((a, b) => a.hp - b.hp)[0];
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
