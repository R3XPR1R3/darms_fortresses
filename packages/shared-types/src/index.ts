export { HeroId, type HeroDefinition, type CardColor, HEROES } from "./hero.js";
export type { DistrictCard, PurpleAbility } from "./card.js";
export { CompanionId, type CompanionDefinition, COMPANIONS, isPassiveCompanion, FLAME_CARD_NAME } from "./companion.js";
export {
  WIN_DISTRICTS,
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
