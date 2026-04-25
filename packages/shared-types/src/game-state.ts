import type { HeroId, CardColor } from "./hero.js";
import type { DistrictCard, PurpleAbility } from "./card.js";
import type { CompanionId } from "./companion.js";
import { ALL_PURPLE_SPECIAL } from "./cards/index.js";

export const WIN_DISTRICTS = 8;
export const MAX_HAND_CARDS = 10;
/** Number of purple placeholder cards shuffled into each player's deck at match start. */
export const PURPLE_PLACEHOLDERS_PER_MATCH = 24;
/** Number of purple cards in a deck-build (repeats allowed). */
export const DECK_BUILD_PURPLE_SIZE = 6;
/** Number of companion slots in a deck-build (must be unique). */
export const DECK_BUILD_COMPANION_SIZE = 3;

/** An ability identifier for any deck-buildable purple card (building or spell). */
export type BuildablePurpleId = PurpleAbility | import("./card.js").SpellAbility;

/** Pre-match deck selection made by the player in the main menu. */
export interface MatchDeckBuild {
  /** Exactly DECK_BUILD_PURPLE_SIZE purple card ids (buildings + spells); duplicates allowed. */
  purple: BuildablePurpleId[];
  /** Exactly DECK_BUILD_COMPANION_SIZE unique companions. */
  companions: CompanionId[];
}

/** State of a single companion slot in a player's personal pool during a match. */
export type CompanionSlotState = "available" | "sleeping" | "gone";
export interface CompanionSlot {
  id: CompanionId;
  state: CompanionSlotState;
  /**
   * The last day the companion is asleep (inclusive). The companion wakes up at the
   * end of this day. Set when transitioning into "sleeping" state on pick.
   */
  sleepEndDay?: number;
}

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
  /** Global Bard usage count — each use increases cost by 1 */
  bardUsageCount: number;
  /** Companions permanently removed from the draft pool (Sniper, leavesPool) — legacy, now per-player via companionDeck.state */
  bannedCompanions: CompanionId[];
  /** Plague spell duration in days (0 = inactive). */
  plagueDaysLeft?: number;
}

/** Purple card template definitions */
export interface PurpleCardTemplate {
  name: string;
  cost: number;
  colors: CardColor[];
  ability: PurpleAbility;
  description: string;
  emoji: string;
}

/** Built from card registry (single source of truth) */
export const PURPLE_CARD_TEMPLATES: PurpleCardTemplate[] = ALL_PURPLE_SPECIAL.map((c) => ({
  name: c.name.ru,
  cost: c.cost,
  colors: c.colors,
  ability: c.ability,
  description: c.description.ru,
  emoji: c.emoji,
}));

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
  /** Two-card income offer waiting for explicit player pick */
  incomeOffer?: DistrictCard[] | null;
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
  /** Chosen companion for this day */
  companion: CompanionId | null;
  /** Has the companion ability been used this turn? */
  companionUsed: boolean;
  /** Companion disabled by Saboteur for this day */
  companionDisabled: boolean;
  /** Royal Guard: player gets expanded draft next day */
  royalGuardDraft: boolean;
  /** Designer: marked district ID to transform into purple card at next purple draft */
  designerMarkedCardId: string | null;
  /** Contractor: contracted hero target for assassin kill reward */
  contractorTargetHeroId?: HeroId | null;
  /** Building IDs activated this turn (limits once-per-turn buildings like Cult) */
  activatedBuildings?: string[];
  /** Remaining purple cards in this player's deck build (consumed when a placeholder is played). */
  purplePool: DistrictCard[];
  /** Personal companion pool (3 slots). State changes during the match. */
  companionDeck: CompanionSlot[];
  /** When non-null, player has played a placeholder and must pick one of these offered cards. */
  pendingPurpleOffer: DistrictCard[] | null;
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
  /** Companion choices offered to each player (personal pool filtered to available slots) */
  companionChoices: CompanionId[][] | null;
  /** Which phase of draft: "hero" or "companion" */
  draftPhase: "hero" | "companion";
}
