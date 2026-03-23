import type { CardColor } from "./hero.js";

export interface DistrictCard {
  id: string;
  name: string;
  cost: number;
  /** Current HP on the table. Defaults to cost when built. Destroyed when < 1. */
  hp: number;
  /** One or more colors. Multi-color cards count for all listed colors. */
  colors: CardColor[];
}
