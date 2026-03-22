import type { HeroId } from "./hero.js";
import type { DistrictCard } from "./card.js";

/** Top-level game state — single source of truth */
export interface GameState {
  phase: GamePhase;
  players: PlayerState[];
  /** Index of the player who holds the crown (picks first next day) */
  crownHolder: number;
  day: number;
  deck: DistrictCard[];
  discardPile: DistrictCard[];
  draft: DraftState | null;
  turnOrder: number[] | null;
  currentTurnIndex: number;
  rng: number; // seed for deterministic randomness
}

export type GamePhase =
  | "setup"
  | "draft"
  | "turns"
  | "end";

export interface PlayerState {
  id: string;
  name: string;
  gold: number;
  hand: DistrictCard[];
  builtDistricts: DistrictCard[];
  hero: HeroId | null;
  /** Has this player taken their income action this turn? */
  incomeTaken: boolean;
  /** Has this player built this turn? */
  hasBuilt: boolean;
  /** Is this player's hero assassinated this day? */
  assassinated: boolean;
  /** Is this player's gold stolen this day? */
  robbed: boolean;
}

/** State tracking the hero draft within a day */
export interface DraftState {
  /** Available hero cards on the table */
  availableHeroes: HeroId[];
  /** Face-up banned heroes (visible to all) */
  faceUpBans: HeroId[];
  /** Face-down banned heroes (hidden) */
  faceDownBans: HeroId[];
  /** Order of players who draft (by crown, then clockwise) */
  draftOrder: number[];
  /** Which step of the draft we're on */
  currentStep: number;
}
