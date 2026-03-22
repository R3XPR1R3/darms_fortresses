import type { HeroId } from "./hero.js";

/** All possible player actions — discriminated union */
export type GameAction =
  | DraftPickAction
  | IncomeAction
  | BuildAction;

/** Player picks a hero during draft */
export interface DraftPickAction {
  type: "draft_pick";
  playerId: string;
  heroId: HeroId;
}

/** Player takes income: draw a card OR take gold */
export interface IncomeAction {
  type: "income";
  playerId: string;
  choice: "card" | "gold";
}

/** Player builds a district from hand */
export interface BuildAction {
  type: "build";
  playerId: string;
  cardId: string;
}
