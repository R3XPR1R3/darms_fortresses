export { HeroId, type HeroDefinition, type CardColor, HEROES } from "./hero.js";
export type { DistrictCard, PurpleAbility, SpellAbility } from "./card.js";
export { CompanionId, type CompanionDefinition, COMPANIONS, isPassiveCompanion, FLAME_CARD_NAME } from "./companion.js";
export {
  WIN_DISTRICTS,
  MAX_HAND_CARDS,
  PURPLE_DRAFT_DAYS,
  PURPLE_CARD_TEMPLATES,
  type GameState,
  type GamePhase,
  type PlayerState,
  type DraftState,
  type PurpleDraftState,
  type PurpleCardTemplate,
  type LogEntry,
} from "./game-state.js";
export type {
  GameAction,
  DraftPickAction,
  CompanionPickAction,
  IncomeAction,
  BuildAction,
  AbilityAction,
  AbilityPayload,
  UseCompanionAction,
  PurpleCardPickAction,
  ActivateBuildingAction,
  EndTurnAction,
} from "./action.js";

// Card registry — single source of truth
export {
  type I18nText, type DistrictDef, type PurpleBasicDef, type PurpleSpecialDef, type SpellDef, type SpecialDef, type AnyCardDef,
  ALL_DISTRICTS, ALL_PURPLE_BASIC, ALL_PURPLE_SPECIAL, ALL_SPELLS, ALL_SPECIALS,
  findCardByName, findPurpleByAbility, findSpellByAbility,
} from "./cards/index.js";
