import type { CardColor } from "./hero.js";

export interface DistrictCard {
  id: string;
  name: string;
  cost: number;
  colors: CardColor[];
  /** Purple cards are special — separate personal pool */
  purple: boolean;
}
