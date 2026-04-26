import type { CardColor } from "./hero.js";

export interface DistrictCard {
  id: string;
  name: string;
  /**
   * Unified value: this is the card's *cost* (gold to build) AND its current HP/score
   * once on the table. Damage decrements this number; destruction at < 1. Score sums it.
   * Some effects (e.g. Monument on build) reset it to a special table value.
   */
  cost: number;
  /** Original printed cost — used for Fort refunds and Monument re-evaluation. Immutable. */
  originalCost?: number;
  /**
   * Legacy synonym kept in sync with `cost` so older readers don't crash. Treat as
   * deprecated: new code should read/write `cost` only.
   * @deprecated Use `cost` instead — they always carry the same value.
   */
  hp?: number;
  /** One or more colors. Multi-color cards count for all listed colors. */
  colors: CardColor[];
  /** Original colors before temporary effects (e.g. holy day) */
  baseColors?: CardColor[];
  /** Purple building ability identifier (only for special purple cards) */
  purpleAbility?: PurpleAbility;
  /** One-shot spell ability (cast from hand, does not stay on table) */
  spellAbility?: SpellAbility;
  /** Placeholder card: when played, lets the owner pick a real purple card from their pool. */
  placeholder?: "purple";
}

export type SpellAbility = "ignite" | "gold_rain" | "holy_day" | "flood" | "plague" | "fire_ritual";

/** Identifiers for special purple building abilities */
export type PurpleAbility =
  | "cannon"       // 2g, purple-red. For 1g shoot random district HP-1 (unlimited)
  | "stronghold"   // 4g, purple. Immune to destruction and damage
  | "monument"     // purple. In hand: cost = other cards in hand. On table: fixed 3/3
  | "highway"      // 4g, purple. Hero speed -1
  | "city_gates"   // 8g, purple-yellow. Gets cheaper in hand over time; fixed after build
  | "crypt"        // 4g, purple. On destroy: 2 random purple cards. Self-destroy for 2g
  | "tnt_storage"  // 2g, purple-red. Self-destroy 2g, 8 spread damage
  | "mine"         // 3g, purple-green. +1g end of day (merchant: end of turn)
  | "cult"            // 2g, purple-blue. Blue hero can activate: replaces random district of random player
  | "altar_darkness"; // 2g, purple. Build 4 for alt-win.
