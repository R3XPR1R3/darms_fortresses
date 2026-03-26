import type { GameState, DistrictCard, PlayerState } from "@darms/shared-types";
import type { Rng } from "./rng.js";

/**
 * Create the initial game state for a 4-player match.
 *
 * - Each player receives 5 random cards (no purple in first hand)
 * - First player (crown holder) is chosen randomly
 * - Each player starts with 2 gold
 */
export function createMatch(
  playerInfos: Array<{ id: string; name: string }>,
  deck: DistrictCard[],
  rng: Rng,
): GameState {
  const normalCards = deck.filter((c) => !c.colors.includes("purple"));
  const shuffled = [...normalCards];
  rng.shuffle(shuffled);

  const players: PlayerState[] = playerInfos.map((info) => {
    const hand = shuffled.splice(0, 5);
    return {
      id: info.id,
      name: info.name,
      gold: 2,
      hand,
      builtDistricts: [],
      hero: null,
      incomeTaken: false,
      buildsRemaining: 0,
      abilityUsed: false,
      assassinated: false,
      robbedHeroId: null,
      finishedFirst: false,
      companion: null,
      companionUsed: false,
      companionDisabled: false,
      royalGuardDraft: false,
    };
  });

  const crownHolder = rng.int(0, players.length - 1);

  return {
    phase: "setup",
    players,
    crownHolder,
    day: 1,
    deck: shuffled,
    discardPile: [],
    draft: null,
    turnOrder: null,
    currentTurnIndex: 0,
    winner: null,
    log: [],
    rng: rng.getSeed(),
    bardUsageCount: 0,
  };
}
