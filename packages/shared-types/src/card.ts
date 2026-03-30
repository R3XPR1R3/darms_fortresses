import type { CardColor } from "./hero.js";

export interface DistrictCard {
  id: string;
  name: string;
  cost: number;
  /** Original printed cost (used for refunds/effects when current cost changes). */
  originalCost?: number;
  /** Current HP on the table. Defaults to cost when built. Destroyed when < 1. */
  hp: number;
  /** One or more colors. Multi-color cards count for all listed colors. */
  colors: CardColor[];
  /** Original colors before temporary effects (e.g. holy day) */
  baseColors?: CardColor[];
  /** Purple building ability identifier (only for special purple cards) */
  purpleAbility?: PurpleAbility;
  /** One-shot spell ability (cast from hand, does not stay on table) */
  spellAbility?: SpellAbility;
}

export type SpellAbility = "ignite" | "gold_rain" | "holy_day" | "flood" | "plague";

/** Identifiers for special purple building abilities */
export type PurpleAbility =
  | "cannon"       // 2g, purple-red. For 1g shoot random district HP-1 (unlimited)
  | "fort"         // 1g, purple. Other buildings HP-1 on table, gold refund on destroy
  | "stronghold"   // 4g, purple. Immune to destruction and damage
  | "monument"     // purple. In hand: cost = other cards in hand. On table: fixed 3/3
  | "highway"      // 4g, purple. Hero speed -1
  | "city_gates"   // 8g, purple-yellow. Gets cheaper in hand over time; fixed after build
  | "crypt"        // 4g, purple. On destroy: 2 random purple cards. Self-destroy for 2g
  | "tnt_storage"  // 2g, purple-red. Self-destroy for 2g, destroys 2 random districts per player
  | "mine"         // 3g, purple-green. +1g end of day (merchant: end of turn)
  | "cult"         // 2g, purple-blue. Blue hero can activate: replaces random district of random player
  | "altar_power"
  | "altar_health"
  | "altar_intellect"
  | "altar_stamina";
