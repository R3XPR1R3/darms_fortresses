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
    // Prefer heroes that match built district colors, otherwise random
    const player = state.players[drafterIdx];
    const colorCounts: Record<string, number> = {};
    for (const d of player.builtDistricts) {
      for (const c of d.colors) {
        colorCounts[c] = (colorCounts[c] || 0) + 1;
      }
    }

    // Simple heuristic: prefer heroes matching dominant color
    let bestHero = available[rng.int(0, available.length - 1)];
    const heroColorMap: Record<string, string> = {
      [HeroId.King]: "yellow",
      [HeroId.Cleric]: "blue",
      [HeroId.Merchant]: "green",
      [HeroId.General]: "red",
    };

    for (const h of available) {
      const hColor = heroColorMap[h];
      if (hColor && (colorCounts[hColor] || 0) >= 2) {
        bestHero = h;
        break;
      }
    }

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
      // Pick a random non-assassin hero to kill
      const targets = state.players
        .filter((p) => p.hero && p.hero !== HeroId.Assassin && p.id !== playerId)
        .map((p) => p.hero!);
      if (targets.length === 0) return null;
      const target = targets[rng.int(0, targets.length - 1)];
      const ability: AbilityPayload = { hero: "assassin", targetHeroId: target };
      return { type: "ability", playerId, ability };
    }
    case HeroId.Thief: {
      const validTargets = state.players
        .filter((p) => p.hero && p.hero !== HeroId.Thief && p.hero !== HeroId.Assassin && p.id !== playerId && !p.assassinated)
        .map((p) => p.hero!);
      if (validTargets.length === 0) return null;
      const target = validTargets[rng.int(0, validTargets.length - 1)];
      const ability: AbilityPayload = { hero: "thief", targetHeroId: target };
      return { type: "ability", playerId, ability };
    }
    case HeroId.Sorcerer: {
      // Draw cards if hand is small, else swap with richest hand
      if (player.hand.length <= 3) {
        return { type: "ability", playerId, ability: { hero: "sorcerer", mode: "draw" } };
      }
      const richest = state.players
        .filter((p) => p.id !== playerId)
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
