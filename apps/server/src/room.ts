import type { GameState, GameAction } from "@darms/shared-types";
import { createRng, createMatch, createBaseDeck, processAction, startDraft, botAction, currentDrafter, currentPlayer } from "@darms/game-core";
import type { LobbyPlayer, PlayerView, PlayerViewEntry, DraftView } from "./protocol.js";
import type { WebSocket } from "ws";
import { generateMatchSummary, saveMatchSummary } from "./match-log.js";

export interface Room {
  id: string;
  hostId: string;
  players: RoomPlayer[];
  state: GameState | null; // null = still in lobby
  started: boolean;
  startedAt: Date | null;
  matchLogged: boolean;
}

export interface RoomPlayer {
  id: string;
  name: string;
  isBot: boolean;
  ws: WebSocket | null; // null for bots
}

const rooms = new Map<string, Room>();

let botCounter = 0;
const BOT_NAMES = ["Бот Алиса", "Бот Борис", "Бот Вика", "Бот Григорий", "Бот Дарья"];

function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 5; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generatePlayerId(): string {
  return "p-" + Math.random().toString(36).slice(2, 10);
}

export function createRoom(hostName: string, ws: WebSocket): { roomId: string; playerId: string } {
  const roomId = generateRoomId();
  const playerId = generatePlayerId();
  const room: Room = {
    id: roomId,
    hostId: playerId,
    players: [{ id: playerId, name: hostName, isBot: false, ws }],
    state: null,
    started: false,
    startedAt: null,
    matchLogged: false,
  };
  rooms.set(roomId, room);
  return { roomId, playerId };
}

export function joinRoom(roomId: string, playerName: string, ws: WebSocket): { playerId: string; players: LobbyPlayer[] } | string {
  const room = rooms.get(roomId);
  if (!room) return "Комната не найдена";
  if (room.started) return "Игра уже началась";
  if (room.players.length >= 4) return "Комната заполнена (макс. 4)";

  const playerId = generatePlayerId();
  room.players.push({ id: playerId, name: playerName, isBot: false, ws });
  return { playerId, players: getLobbyPlayers(room) };
}

export function addBot(roomId: string, requesterId: string): LobbyPlayer[] | string {
  const room = rooms.get(roomId);
  if (!room) return "Комната не найдена";
  if (room.hostId !== requesterId) return "Только хост может добавлять ботов";
  if (room.started) return "Игра уже началась";
  if (room.players.length >= 4) return "Максимум 4 игрока";

  const botName = BOT_NAMES[botCounter % BOT_NAMES.length];
  botCounter++;
  const botId = "bot-" + Math.random().toString(36).slice(2, 8);
  room.players.push({ id: botId, name: botName, isBot: true, ws: null });
  return getLobbyPlayers(room);
}

export function startGame(roomId: string, requesterId: string): string | null {
  const room = rooms.get(roomId);
  if (!room) return "Комната не найдена";
  if (room.hostId !== requesterId) return "Только хост может запустить игру";
  if (room.started) return "Игра уже запущена";
  if (room.players.length < 4) return "Нужно минимум 4 игрока";

  const seed = Date.now();
  const rng = createRng(seed);
  const deck = createBaseDeck();
  const playerDescs = room.players.map((p) => ({ id: p.id, name: p.name }));
  room.state = createMatch(playerDescs, deck, rng);
  room.state = startDraft(room.state);
  room.started = true;
  room.startedAt = new Date();

  // Let bots make their draft picks immediately
  runBots(room);

  return null; // success
}

export function handleAction(roomId: string, playerId: string, action: GameAction): string | null {
  const room = rooms.get(roomId);
  if (!room || !room.state) return "Игра не найдена";

  // Validate that the action's playerId matches the caller
  if ("playerId" in action && action.playerId !== playerId) {
    return "Нельзя делать ход за другого игрока";
  }

  const next = processAction(room.state, action);
  if (!next) return "Недопустимое действие";
  room.state = next;

  // If draft ended and no draft state, start new draft
  if (room.state.phase === "draft" && !room.state.draft) {
    room.state = startDraft(room.state);
  }

  // Run bot turns
  runBots(room);

  // Log match if game ended
  if (room.state.phase === "end" && !room.matchLogged) {
    room.matchLogged = true;
    const botIds = new Set(room.players.filter((p) => p.isBot).map((p) => p.id));
    const summary = generateMatchSummary(room.state, room.id, room.startedAt ?? new Date(), botIds);
    saveMatchSummary(summary).catch((err) => console.error("[match-log] Error:", err));
  }

  return null; // success
}

function runBots(room: Room) {
  if (!room.state || room.state.phase === "end") return;

  let acted = true;
  let safety = 200;
  while (acted && safety-- > 0) {
    acted = false;
    if (room.state.phase === "end") break;

    if (room.state.phase === "draft") {
      const dIdx = currentDrafter(room.state);
      if (dIdx !== null) {
        const player = room.state.players[dIdx];
        const rp = room.players.find((p) => p.id === player.id);
        if (rp?.isBot) {
          const action = botAction(room.state, player.id);
          if (action) {
            const next = processAction(room.state, action);
            if (next) { room.state = next; acted = true; }
          }
        }
      }
    }

    if (room.state.phase === "turns") {
      const pIdx = currentPlayer(room.state);
      if (pIdx !== null) {
        const player = room.state.players[pIdx];
        const rp = room.players.find((p) => p.id === player.id);
        if (rp?.isBot) {
          const action = botAction(room.state, player.id);
          if (action) {
            const next = processAction(room.state, action);
            if (next) { room.state = next; acted = true; }
          }
        }
      }
    }

    if (room.state.phase === "draft" && !room.state.draft) {
      room.state = startDraft(room.state);
      acted = true;
    }
  }
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function removePlayer(roomId: string, playerId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.players.filter((p) => !p.isBot).length === 0) {
    rooms.delete(roomId);
  }
}

export function getLobbyPlayers(room: Room): LobbyPlayer[] {
  return room.players.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    isHost: p.id === room.hostId,
  }));
}

export function createPlayerView(state: GameState, playerId: string): PlayerView {
  const myIndex = state.players.findIndex((p) => p.id === playerId);

  const players: PlayerViewEntry[] = state.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    gold: p.gold,
    handSize: p.hand.length,
    hand: i === myIndex ? p.hand : null,
    builtDistricts: p.builtDistricts,
    hero: p.hero,
    incomeTaken: p.incomeTaken,
    buildsRemaining: p.buildsRemaining,
    abilityUsed: p.abilityUsed,
    assassinated: p.assassinated,
    robbedHeroId: p.robbedHeroId,
    finishedFirst: p.finishedFirst,
  }));

  let draft: DraftView | null = null;
  if (state.draft) {
    draft = {
      availableHeroes: state.draft.availableHeroes,
      faceUpBans: state.draft.faceUpBans,
      hiddenBanCount: state.draft.faceDownBans.length,
      draftOrder: state.draft.draftOrder,
      currentStep: state.draft.currentStep,
    };
  }

  return {
    phase: state.phase,
    players,
    crownHolder: state.crownHolder,
    day: state.day,
    deckSize: state.deck.length,
    draft,
    turnOrder: state.turnOrder,
    currentTurnIndex: state.currentTurnIndex,
    winner: state.winner,
    log: state.log,
    myIndex,
  };
}
