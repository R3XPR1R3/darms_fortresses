import type { HeroId } from "./hero.js";
import type { DistrictCard, PurpleAbility } from "./card.js";
import type { CompanionId } from "./companion.js";

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
  /** Global Bard usage count — each use increases cost by 1 */
  bardUsageCount: number;
  /** Companions permanently removed from the draft pool (Sniper, leavesPool) */
  bannedCompanions: CompanionId[];
  /** Purple card draft state (days 3,6,9,12) */
  purpleDraft: PurpleDraftState | null;
}

/** State for the purple card draft mini-phase */
export interface PurpleDraftState {
  /** 3 cards offered to each player individually (indexed by player index) */
  offers: (DistrictCard[] | null)[];
  /** Which players have picked (indexed by player index) */
  picked: boolean[];
}

/** Days on which purple card draft occurs */
export const PURPLE_DRAFT_DAYS = [3, 6, 9, 12];

/** Purple card template definitions */
export interface PurpleCardTemplate {
  name: string;
  cost: number;
  colors: ("purple" | "red" | "yellow" | "blue" | "green")[];
  ability: PurpleAbility;
  description: string;
  emoji: string;
}

export const PURPLE_CARD_TEMPLATES: PurpleCardTemplate[] = [
  { name: "Пушка", cost: 2, colors: ["purple", "red"], ability: "cannon", emoji: "💣", description: "За 1💰: −1 HP случайному кварталу противника (∞)" },
  { name: "Оборонительный форт", cost: 1, colors: ["purple"], ability: "fort", emoji: "🏰", description: "Другие постройки −1 HP, но при разрушении вы получаете золото" },
  { name: "Памятник", cost: 2, colors: ["purple"], ability: "monument", emoji: "🗿", description: "Стоимость = карт в руке. Всегда 3 HP на столе" },
  { name: "Магистраль", cost: 4, colors: ["purple"], ability: "highway", emoji: "🛤️", description: "Скорость героя −1" },
  { name: "Врата в город", cost: 8, colors: ["purple", "yellow"], ability: "city_gates", emoji: "🚪", description: "HP −2 каждый ход. При 0 — сбрасывается" },
  { name: "Склеп", cost: 4, colors: ["purple"], ability: "crypt", emoji: "⚰️", description: "При разрушении: +2 фиолетовые карты. Самоуничтожение за 2💰" },
  { name: "Склад тротила", cost: 2, colors: ["purple", "red"], ability: "tnt_storage", emoji: "🧨", description: "Уничтожьте за 2💰: −2 случайных квартала каждому" },
  { name: "Шахта", cost: 3, colors: ["purple", "green"], ability: "mine", emoji: "⛏️", description: "+1💰 в конце хода" },
  { name: "Секта", cost: 2, colors: ["purple", "blue"], ability: "cult", emoji: "🕯️", description: "При постройке: заменяет случайный синий/фиолетовый квартал у случайного игрока" },
];

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
  /** Companion choices offered to each player (3 per player) */
  companionChoices: CompanionId[][] | null;
  /** Which phase of draft: "hero" or "companion" */
  draftPhase: "hero" | "companion";
}
