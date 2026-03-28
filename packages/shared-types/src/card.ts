import type { CardColor } from "./hero.js";

export interface DistrictCard {
  id: string;
  name: string;
  cost: number;
  /** Current HP on the table. Defaults to cost when built. Destroyed when < 1. */
  hp: number;
  /** One or more colors. Multi-color cards count for all listed colors. */
  colors: CardColor[];
  /** Purple building ability identifier (only for special purple cards) */
  purpleAbility?: PurpleAbility;
}

/** Identifiers for special purple building abilities */
export type PurpleAbility =
  | "cannon"       // 2g, purple-red. For 1g shoot random district HP-1 (unlimited)
  | "fort"         // 1g, purple. Other buildings HP-1 on table, gold refund on destroy
  | "monument"     // purple. In hand: cost = other cards in hand. On table: fixed 3/3
  | "highway"      // 4g, purple. Hero speed -1
  | "city_gates"   // 8g, purple-yellow. Gets cheaper in hand over time; fixed after build
  | "crypt"        // 4g, purple. On destroy: 2 random purple cards. Self-destroy for 2g
  | "tnt_storage"  // 2g, purple-red. Self-destroy for 2g, destroys 2 random districts per player
  | "mine"         // 3g, purple-green. +1g end of day (merchant: end of turn)
  | "cult";        // 2g, purple-blue. On build: replaces random blue/purple district of random player
