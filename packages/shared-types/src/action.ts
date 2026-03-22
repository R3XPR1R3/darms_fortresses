import type { HeroId } from "./hero.js";

/** All possible player actions — discriminated union */
export type GameAction =
  | DraftPickAction
  | IncomeAction
  | BuildAction
  | AbilityAction
  | EndTurnAction;

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

/** Player uses their hero ability */
export interface AbilityAction {
  type: "ability";
  playerId: string;
  ability: AbilityPayload;
}

export type AbilityPayload =
  | { hero: "assassin"; targetHeroId: HeroId }
  | { hero: "thief"; targetHeroId: HeroId }
  | { hero: "sorcerer"; mode: "draw" }
  | { hero: "sorcerer"; mode: "swap"; targetPlayerId: string }
  | { hero: "king" } // passive — auto-applied
  | { hero: "cleric" } // passive — auto-applied
  | { hero: "merchant" } // passive — auto-applied
  | { hero: "architect" } // passive — builds handled by build action
  | { hero: "general"; targetPlayerId: string; cardId: string };

/** Player explicitly ends their turn */
export interface EndTurnAction {
  type: "end_turn";
  playerId: string;
}
