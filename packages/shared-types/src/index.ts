export { HeroId, type HeroDefinition, type CardColor, HEROES } from "./hero.js";
export type { DistrictCard, PurpleAbility, SpellAbility, GreyAbility } from "./card.js";
export { CompanionId, type CompanionDefinition, COMPANIONS, isPassiveCompanion, matchesHeroColor, FLAME_CARD_NAME, FIRE_CARD_NAME } from "./companion.js";
export {
  WIN_DISTRICTS,
  MAX_HAND_CARDS,
  MAX_GOLD,
  PURPLE_CARD_TEMPLATES,
  PURPLE_PLACEHOLDERS_PER_MATCH,
  DECK_BUILD_PURPLE_SIZE,
  DECK_BUILD_COMPANION_SIZE,
  type GameState,
  type GamePhase,
  type PlayerState,
  type DraftState,
  type PurpleCardTemplate,
  type LogEntry,
  type MatchDeckBuild,
  type BuildablePurpleId,
  type CompanionSlot,
  type CompanionSlotState,
} from "./game-state.js";
export { BOT_BUILDS, pickRandomBotBuild, type BotBuild } from "./bot-builds.js";
export type {
  GameAction,
  DraftPickAction,
  CompanionPickAction,
  CompanionSkipAction,
  IncomeAction,
  BuildAction,
  AbilityAction,
  AbilityPayload,
  UseCompanionAction,
  PurplePlaceholderPlayAction,
  PurplePlaceholderPickAction,
  ActivateBuildingAction,
  PlanPickAction,
  EndTurnAction,
} from "./action.js";

// Card registry — single source of truth
export {
  type I18nText, type DistrictDef, type PurpleBasicDef, type PurpleSpecialDef, type SpellDef, type SpecialDef, type GreyDef, type AnyCardDef,
  ALL_DISTRICTS, ALL_PURPLE_BASIC, ALL_PURPLE_SPECIAL, ALL_SPELLS, ALL_GREY, ALL_SPECIALS,
  findCardByName, findPurpleByAbility, findSpellByAbility, findGreyByAbility,
} from "./cards/index.js";
