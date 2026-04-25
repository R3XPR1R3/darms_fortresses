import type { HeroId } from "./hero.js";
import type { CompanionId } from "./companion.js";

/** All possible player actions — discriminated union */
export type GameAction =
  | DraftPickAction
  | CompanionPickAction
  | CompanionSkipAction
  | PurplePlaceholderPlayAction
  | PurplePlaceholderPickAction
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

/** Player builds a district from hand. Some spells need a target — pass it via targetCardId. */
export interface BuildAction {
  type: "build";
  playerId: string;
  cardId: string;
  /** Target district id (for spells like fire_ritual that sacrifice an own building). */
  targetCardId?: string;
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

/** Player plays a purple placeholder stub from hand — opens the pick offer. */
export interface PurplePlaceholderPlayAction {
  type: "purple_placeholder_play";
  playerId: string;
  /** ID of the placeholder card in hand. */
  cardId: string;
}

/** Player picks one purple card from the pending placeholder offer. */
export interface PurplePlaceholderPickAction {
  type: "purple_placeholder_pick";
  playerId: string;
  /** Index into pendingPurpleOffer (0-based). */
  offerIndex: number;
}

/** Player declines to pick a companion (personal pool exhausted). */
export interface CompanionSkipAction {
  type: "companion_skip";
  playerId: string;
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
