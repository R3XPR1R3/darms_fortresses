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
  /** Grey card ability (lives in shared deck, played from hand for cost). */
  greyAbility?: GreyAbility;
  /** Placeholder card: when played, lets the owner pick a real purple card from their pool. */
  placeholder?: "purple";
  /**
   * Heavy Artillery damage value — degrades by 1 each volley. When this reaches 0
   * the cannon is essentially spent (still on table for score until dead).
   */
  artilleryDamage?: number;
  /**
   * Marks a card drawn via "Burning Deadline": if not built by the end of the
   * caster's turn, it transforms into 🔥 Flame.
   */
  burningDeadline?: boolean;
  /**
   * Marks a spell card created by "Магия огня" with a fuse: if not played by
   * end of turn, transforms into 🔥 Flame.
   */
  fireMagicFuse?: boolean;
}

export type SpellAbility =
  | "ignite"
  | "gold_rain"
  | "holy_day"
  | "flood"
  | "plague"
  | "fire_ritual"
  | "fire_magic"
  | "bombardment"
  | "enhancement";

/** Identifiers for special purple building abilities */
export type PurpleAbility =
  | "cannon"          // 2g, purple-red. For 1g shoot random district HP-1 (unlimited)
  | "stronghold"      // 4g, purple. Immune to destruction and damage
  | "monument"        // purple. In hand: cost = other cards in hand. On table: fixed 3/3
  | "highway"         // 4g, purple. Hero speed -1
  | "city_gates"      // 8g, purple-yellow. Gets cheaper in hand over time; fixed after build
  | "crypt"           // 4g, purple. On destroy: 2 random purple cards. Self-destroy for 2g
  | "tnt_storage"     // 2g, purple-red. Self-destroy 2g, 8 spread damage
  | "mine"            // 3g, purple-green. +1g end of day (merchant: end of turn)
  | "cult"            // 2g, purple-blue. Blue hero can activate: replaces random district of random player
  | "altar_darkness"  // 2g, purple. Build 4 for alt-win.
  | "observatory"     // 3g, purple. Activate: discard 1 from hand → draw 2.
  | "salvage_yard"    // 3g, purple. Passive: when destroyed, owner gets 1 card + ceil(cost/2) gold.
  | "hospital"        // 4g, purple. While built, an assassinated owner can still take income / use companion.
  | "inner_wall"      // 4g, purple. On build, sacrifice random own district; absorb its cost into self.
  | "heavy_artillery"; // 3g, purple-red. Active: 6 random shots, decay −1 cost & −1 dmg per volley.

/** Grey card abilities — shared-deck spell-likes that any hero can play. */
export type GreyAbility =
  | "new_opportunities" // 2g. Take 2 random cards from deck.
  | "plan"              // 4g. Pick 1 of 2, then 1 of 2 again (rest back to deck).
  | "burning_deadline"; // 1g. Draw 1 card; if not built this turn, becomes 🔥 Flame.
