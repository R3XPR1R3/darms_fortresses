import type { GameAction, GameState, PlayerState, DraftState, CompanionId, DistrictCard, MatchDeckBuild, CompanionSlot } from "@darms/shared-types";

// ---- Client → Server ----

export type ClientMessage =
  | { type: "create_room"; playerName: string; authToken?: string }
  | { type: "join_room"; roomId: string; playerName: string; authToken?: string }
  | { type: "reconnect_room"; roomId: string; playerId: string }
  | { type: "start_game" }
  | { type: "add_bot" }
  | { type: "set_deck_build"; build: MatchDeckBuild | null }
  | { type: "action"; action: GameAction };

// ---- Server → Client ----

export type ServerMessage =
  | { type: "room_created"; roomId: string; playerId: string }
  | { type: "room_joined"; roomId: string; playerId: string; players: LobbyPlayer[] }
  | { type: "room_reconnected"; roomId: string; playerId: string; players: LobbyPlayer[] }
  | { type: "lobby_update"; players: LobbyPlayer[] }
  | { type: "game_state"; state: PlayerView }
  | { type: "error"; message: string };

export interface LobbyPlayer {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  /** True iff this player has submitted a valid deck-build; blocks start if false. */
  deckReady: boolean;
  /** Optional label for bots describing which preset they use. */
  buildLabel?: string;
}

/**
 * Filtered view of the game state for a specific player.
 * Hides other players' hands and face-down bans.
 */
export interface PlayerView {
  phase: GameState["phase"];
  players: PlayerViewEntry[];
  crownHolder: number;
  day: number;
  deckSize: number;
  draft: DraftView | null;
  turnOrder: number[] | null;
  currentTurnIndex: number;
  winner: number | null;
  log: GameState["log"];
  myIndex: number;
  /** Client-visible view of the requesting player's own pending purple offer, if any. */
  pendingPurpleOffer: DistrictCard[] | null;
}

export interface PlayerViewEntry {
  id: string;
  name: string;
  gold: number;
  handSize: number;
  hand: PlayerState["hand"] | null; // only visible for the requesting player
  builtDistricts: PlayerState["builtDistricts"];
  hero: PlayerState["hero"];
  incomeTaken: boolean;
  incomeOffer: PlayerState["incomeOffer"];
  buildsRemaining: number;
  abilityUsed: boolean;
  assassinated: boolean;
  robbedHeroId: PlayerState["robbedHeroId"];
  finishedFirst: boolean;
  companion: PlayerState["companion"];
  companionUsed: boolean;
  companionDisabled: boolean;
  designerMarkedCardId: string | null;
  /** Personal companion pool with per-slot state (all players can see this). */
  companionDeck: CompanionSlot[];
  /** Remaining size of this player's purple deck-build pool (public). */
  purplePoolSize: number;
}

export interface DraftView {
  availableHeroes: DraftState["availableHeroes"];
  faceUpBans: DraftState["faceUpBans"];
  hiddenBanCount: number;
  draftOrder: DraftState["draftOrder"];
  currentStep: DraftState["currentStep"];
  draftPhase: DraftState["draftPhase"];
  companionPool: CompanionId[] | null; // shared pool for sequential draft
}
