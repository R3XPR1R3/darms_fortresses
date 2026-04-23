import type { GameAction, GameState, PlayerState, DraftState, CompanionId, DistrictCard } from "@darms/shared-types";

// ---- Client → Server ----

export type ClientMessage =
  | { type: "create_room"; playerName: string; authToken?: string }
  | { type: "join_room"; roomId: string; playerName: string; authToken?: string }
  | { type: "reconnect_room"; roomId: string; playerId: string }
  | { type: "start_game" }
  | { type: "add_bot" }
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
  purpleDraft: { offers: (DistrictCard[] | null)[]; picked: boolean[] } | null;
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
