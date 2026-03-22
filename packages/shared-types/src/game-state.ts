import type { HeroId } from "./hero.js";
import type { DistrictCard } from "./card.js";

export const WIN_DISTRICTS = 8;

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
  /** Index of winning player, or null */
  winner: number | null;
  /** Log of events for UI display */
  log: LogEntry[];
  rng: number; // seed for deterministic randomness
}

export interface LogEntry {
  day: number;
  message: string;
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
  /** How many builds remaining this turn (architect gets 3, others 1) */
  buildsRemaining: number;
  /** Has this player used their hero ability this turn? */
  abilityUsed: boolean;
  /** Is this player's hero assassinated this day? */
  assassinated: boolean;
  /** HeroId that will be robbed when they act (thief target) */
  robbedHeroId: HeroId | null;
  /** Was this the first player to build 8 districts? */
  finishedFirst: boolean;
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
