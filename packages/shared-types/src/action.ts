import type { HeroId } from "./hero.js";
import type { CompanionId } from "./companion.js";

/** All possible player actions — discriminated union */
export type GameAction =
  | DraftPickAction
  | CompanionPickAction
  | PurpleCardPickAction
  | IncomeAction
  | IncomePickAction
  | BuildAction
  | AbilityAction
  | UseCompanionAction
  | ActivateBuildingAction
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

/** Player picks one of two offered income cards */
export interface IncomePickAction {
  type: "income_pick";
  playerId: string;
  cardId: string;
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
  | { hero: "sorcerer"; mode: "draw" }  // discard 2 random, draw 2
  | { hero: "sorcerer"; mode: "swap"; targetPlayerId: string }
  | { hero: "king" } // passive — auto-applied
  | { hero: "cleric" } // passive — auto-applied
  | { hero: "merchant" } // passive — auto-applied
  | { hero: "architect" } // passive — builds handled by build action
  | { hero: "general"; targetPlayerId: string; cardId: string };

/** Player picks a companion during draft */
export interface CompanionPickAction {
  type: "companion_pick";
  playerId: string;
  companionId: CompanionId;
}

/** Player uses their companion ability */
export interface UseCompanionAction {
  type: "use_companion";
  playerId: string;
  /** Target player for Hunter, Saboteur, Bard, Blacksmith, NightShadow */
  targetPlayerId?: string;
  /** Target card for Blacksmith, Alchemist */
  targetCardId?: string;
  /** Target hero for NightShadow */
  targetHeroId?: HeroId;
}

/** Player picks a purple card during purple draft */
export interface PurpleCardPickAction {
  type: "purple_card_pick";
  playerId: string;
  cardIndex: number; // index in offered choices
}

/** Player activates a built purple building */
export interface ActivateBuildingAction {
  type: "activate_building";
  playerId: string;
  cardId: string; // id of the built purple district to activate
}

/** Player explicitly ends their turn */
export interface EndTurnAction {
  type: "end_turn";
  playerId: string;
}
