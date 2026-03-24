import type { GameState, GameAction, AbilityPayload } from "@darms/shared-types";
import { HeroId } from "@darms/shared-types";
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
    const drafterIdx = currentDrafter(state);
    if (drafterIdx === null) return null;
    if (state.players[drafterIdx].id !== botPlayerId) return null;

    const available = state.draft!.availableHeroes;
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
      // Prefer gold if we have buildable cards, else draw
      const canBuild = player.hand.some(
        (c) => c.cost <= player.gold + 1 && !player.builtDistricts.some((d) => d.name === c.name),
      );
      return {
        type: "income",
        playerId: botPlayerId,
        choice: canBuild ? "gold" : "card",
      };
    }

    // Step 3: Build if possible
    if (player.buildsRemaining > 0) {
      const buildable = player.hand
        .filter((c) => c.cost <= player.gold && !player.builtDistricts.some((d) => d.name === c.name))
        .sort((a, b) => b.cost - a.cost); // prefer expensive

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
      // Target the richest opponent (most gold, then most cards)
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
      // Swap with opponent who has the most cards, or draw if hand is very small
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
      // Target lowest HP district that can be destroyed, or damage the weakest
      if (player.gold < 1) return null;
      const targets = state.players
        .filter((p) => p.id !== playerId && p.builtDistricts.length > 0 && p.hero !== HeroId.Cleric)
        .sort((a, b) => b.builtDistricts.length - a.builtDistricts.length);
      if (targets.length === 0) return null;
      const target = targets[0];
      // Prefer a district we can destroy (hp <= gold), otherwise pick lowest HP
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
    // Passive heroes — mark ability as used
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
 * Scores each hero based on:
 * 1. Color synergy with built districts (how many matching districts)
 * 2. Color synergy with hand cards (what they can build soon)
 * 3. Base hero value (some heroes are inherently more versatile)
 * 4. Risk assessment: known banned heroes change threat landscape
 * 5. Random noise for variety
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

  // Count colors in built districts
  const builtColorCounts: Record<string, number> = {};
  for (const d of player.builtDistricts) {
    for (const c of d.colors) {
      builtColorCounts[c] = (builtColorCounts[c] || 0) + 1;
    }
  }

  // Count colors in hand
  const handColorCounts: Record<string, number> = {};
  for (const d of player.hand) {
    for (const c of d.colors) {
      handColorCounts[c] = (handColorCounts[c] || 0) + 1;
    }
  }

  // Base value for each hero (how generally useful they are)
  const baseValue: Record<string, number> = {
    [HeroId.Assassin]: 6,   // strong disruption
    [HeroId.Thief]: 5,      // economy disruption
    [HeroId.Sorcerer]: 4,   // utility
    [HeroId.King]: 5,       // crown + income
    [HeroId.Cleric]: 5,     // protection + income
    [HeroId.Merchant]: 6,   // guaranteed income (+1 always)
    [HeroId.Architect]: 7,  // fast building (very strong)
    [HeroId.General]: 4,    // destruction (expensive)
  };

  // Evaluate opponents' resources
  const opponents = state.players.filter((p) => p.id !== player.id);
  const maxDistricts = Math.max(...opponents.map((p) => p.builtDistricts.length));
  const threatLevel = maxDistricts >= 6 ? 3 : maxDistricts >= 5 ? 1.5 : 0;
  const maxOppGold = Math.max(...opponents.map((p) => p.gold));
  const maxOppHand = Math.max(...opponents.map((p) => p.hand.length));

  // Known banned heroes (face-up bans) tell us what ISN'T in play
  const faceUpBans = state.draft?.faceUpBans ?? [];

  let bestHero = available[0];
  let bestScore = -Infinity;

  for (const h of available) {
    let score = baseValue[h] ?? 3;

    // Color synergy bonus
    const hColor = heroColorMap[h];
    if (hColor) {
      const builtCount = builtColorCounts[hColor] || 0;
      const handCount = handColorCounts[hColor] || 0;
      score += builtCount * 2;  // strong synergy with built districts
      score += handCount * 1;   // moderate synergy with hand cards
    }

    // Threat response: boost assassin/general when opponent is close to winning
    if (threatLevel > 0) {
      if (h === HeroId.Assassin) score += threatLevel;
      if (h === HeroId.General) score += threatLevel * 0.7;
    }

    // Thief is more valuable when opponents have lots of gold
    if (h === HeroId.Thief) {
      if (maxOppGold >= 5) score += 3;
      else if (maxOppGold >= 3) score += 1.5;
    }

    // Sorcerer is more valuable when opponents have many cards (swap potential)
    if (h === HeroId.Sorcerer) {
      if (maxOppHand >= 5) score += 3;
      else if (maxOppHand >= 3 && maxOppHand > player.hand.length) score += 2;
    }

    // If architect is banned (face-up), building-focused heroes are safer
    if (faceUpBans.includes(HeroId.Assassin)) {
      // Assassin banned = safer to pick high-value roles
      if (h === HeroId.Architect || h === HeroId.Merchant) score += 1.5;
    }

    // If player has low gold, merchant is more valuable
    if (player.gold <= 1 && h === HeroId.Merchant) score += 2;

    // If player has many cards, architect is more valuable
    if (player.hand.length >= 4 && h === HeroId.Architect) score += 2;

    // Cleric protection is more valuable with more built districts
    if (h === HeroId.Cleric && player.builtDistricts.length >= 4) score += 2;

    // Random noise for variety (±1.5)
    score += (rng.next() - 0.5) * 3;

    if (score > bestScore) {
      bestScore = score;
      bestHero = h;
    }
  }

  return bestHero;
}
