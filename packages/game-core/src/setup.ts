import type { GameState, DistrictCard, PlayerState } from "@darms/shared-types";
import type { Rng } from "./rng.js";

/**
 * Create the initial game state for a 4-player match.
 *
 * - Each player receives 5 random cards (no purple in first hand)
 * - First player (crown holder) is chosen randomly
 */
export function createMatch(
  playerInfos: Array<{ id: string; name: string }>,
  deck: DistrictCard[],
  rng: Rng,
): GameState {
  // Separate purple cards from the starting deck
  const normalCards = deck.filter((c) => !c.purple);
  const shuffled = [...normalCards];
  rng.shuffle(shuffled);

  const players: PlayerState[] = playerInfos.map((info) => {
    const hand = shuffled.splice(0, 5);
    return {
      id: info.id,
      name: info.name,
      gold: 0,
      hand,
      builtDistricts: [],
      hero: null,
      incomeTaken: false,
      hasBuilt: false,
      assassinated: false,
      robbed: false,
    };
  });

  // Random first crown holder
  const crownHolder = rng.int(0, players.length - 1);

  return {
    phase: "setup",
    players,
    crownHolder,
    day: 1,
    deck: shuffled, // remaining cards after dealing
    discardPile: [],
    draft: null,
    turnOrder: null,
    currentTurnIndex: 0,
    rng: rng.getSeed(),
  };
}
