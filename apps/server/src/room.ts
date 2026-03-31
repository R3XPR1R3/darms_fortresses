import { randomBytes } from "node:crypto";
import type { GameState, GameAction } from "@darms/shared-types";
import { CompanionId } from "@darms/shared-types";
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
  /** Callback set by index.ts to broadcast state to all players */
  broadcastState: (() => void) | null;
  /** Pending bot timer (so we can cancel if needed) */
  botTimer: ReturnType<typeof setTimeout> | null;
}

export interface RoomPlayer {
  id: string;
  name: string;
  isBot: boolean;
  ws: WebSocket | null; // null for bots
  disconnectTimer: ReturnType<typeof setTimeout> | null;
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

/** Sanitize player name: trim, limit length, strip control chars */
function sanitizeName(name: string): string {
  return name.replace(/[\x00-\x1f]/g, "").trim().slice(0, 30) || "Player";
}

export function createRoom(hostName: string, ws: WebSocket): { roomId: string; playerId: string } {
  const roomId = generateRoomId();
  const playerId = generatePlayerId();
  const room: Room = {
    id: roomId,
    hostId: playerId,
    players: [{ id: playerId, name: sanitizeName(hostName), isBot: false, ws, disconnectTimer: null }],
    state: null,
    started: false,
    startedAt: null,
    matchLogged: false,
    broadcastState: null,
    botTimer: null,
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
  room.players.push({ id: playerId, name: sanitizeName(playerName), isBot: false, ws, disconnectTimer: null });
  return { playerId, players: getLobbyPlayers(room) };
}

export function reconnectRoom(roomId: string, playerId: string, ws: WebSocket): LobbyPlayer[] | string {
  const room = rooms.get(roomId);
  if (!room) return "Комната не найдена";
  const player = room.players.find((p) => p.id === playerId && !p.isBot);
  if (!player) return "Игрок не найден";
  player.ws = ws;
  if (player.disconnectTimer) {
    clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
  }
  return getLobbyPlayers(room);
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
  room.players.push({ id: botId, name: botName, isBot: true, ws: null, disconnectTimer: null });
  return getLobbyPlayers(room);
}

export function startGame(roomId: string, requesterId: string): string | null {
  const room = rooms.get(roomId);
  if (!room) return "Комната не найдена";
  if (room.hostId !== requesterId) return "Только хост может запустить игру";
  if (room.started) return "Игра уже запущена";
  if (room.players.length < 4) return "Нужно минимум 4 игрока";

  const seed = randomBytes(4).readUInt32BE(0);
  const rng = createRng(seed);
  const deck = createBaseDeck();
  const playerDescs = room.players.map((p) => ({ id: p.id, name: p.name }));
  room.state = createMatch(playerDescs, deck, rng);
  room.state = startDraft(room.state);
  room.started = true;
  room.startedAt = new Date();

  // Schedule async bot actions (with delays)
  scheduleBotStep(room);

  return null; // success
}

/** Detailed server-side action logger (console only, for debugging stuck games) */
function logAction(room: Room, action: GameAction, source: "human" | "bot") {
  const state = room.state;
  if (!state) return;
  const player = state.players.find((p) => p.id === action.playerId);
  const name = player?.name ?? action.playerId;
  const tag = `[${room.id} D${state.day}]`;
  const who = source === "bot" ? `🤖${name}` : `👤${name}`;

  switch (action.type) {
    case "draft_pick":
      console.log(`${tag} ${who} picks hero: ${action.heroId}`);
      break;
    case "companion_pick":
      console.log(`${tag} ${who} picks companion: ${action.companionId}`);
      break;
    case "purple_card_pick": {
      const offers = state.purpleDraft?.offers[state.players.indexOf(player!)];
      const cardName = offers && action.cardIndex >= 0 ? offers[action.cardIndex]?.name : "SKIP";
      console.log(`${tag} ${who} purple pick: ${cardName} (idx ${action.cardIndex})`);
      break;
    }
    case "income":
      console.log(`${tag} ${who} income: ${action.choice}`);
      break;
    case "income_pick": {
      const offer = player?.incomeOffer;
      const picked = offer?.find((c) => c.id === action.cardId);
      const returned = offer?.find((c) => c.id !== action.cardId);
      console.log(`${tag} ${who} picks card [${picked?.name ?? "?"}], returns [${returned?.name ?? "?"}] to deck`);
      break;
    }
    case "build": {
      const card = player?.hand.find((c) => c.id === action.cardId);
      console.log(`${tag} ${who} builds: ${card?.name ?? "?"} (cost ${card?.cost ?? "?"})`);
      break;
    }
    case "ability": {
      const ab = action.ability;
      if (ab.hero === "assassin") console.log(`${tag} ${who} ASSASSINATE → ${ab.targetHeroId}`);
      else if (ab.hero === "thief") console.log(`${tag} ${who} ROB → ${ab.targetHeroId}`);
      else if (ab.hero === "sorcerer" && ab.mode === "draw") console.log(`${tag} ${who} sorcerer: discard 2, draw 3`);
      else if (ab.hero === "sorcerer" && ab.mode === "swap") console.log(`${tag} ${who} sorcerer: swap hands → ${ab.targetPlayerId}`);
      else if (ab.hero === "general") console.log(`${tag} ${who} DESTROY → card ${ab.cardId} of ${ab.targetPlayerId}`);
      else console.log(`${tag} ${who} ability: ${ab.hero}`);
      break;
    }
    case "use_companion": {
      const comp = player?.companion;
      console.log(`${tag} ${who} uses companion ${comp}${action.targetPlayerId ? ` → player ${action.targetPlayerId}` : ""}${action.targetCardId ? ` → card ${action.targetCardId}` : ""}${action.targetHeroId ? ` → hero ${action.targetHeroId}` : ""}`);
      break;
    }
    case "activate_building": {
      const building = player?.builtDistricts.find((d) => d.id === action.cardId);
      console.log(`${tag} ${who} activates building: ${building?.name ?? action.cardId}`);
      break;
    }
    case "end_turn":
      console.log(`${tag} ${who} END TURN`);
      break;
    default:
      console.log(`${tag} ${who} action: ${(action as GameAction).type}`);
  }
}

export function handleAction(roomId: string, playerId: string, action: GameAction): string | null {
  const room = rooms.get(roomId);
  if (!room || !room.state) return "Игра не найдена";

  // Validate that the action's playerId matches the caller
  if ("playerId" in action && action.playerId !== playerId) {
    return "Нельзя делать ход за другого игрока";
  }

  const isBot = room.players.find((p) => p.id === playerId)?.isBot ?? false;
  logAction(room, action, isBot ? "bot" : "human");

  const next = processAction(room.state, action);
  if (!next) {
    console.log(`[${room.id}] ❌ Action REJECTED: ${action.type} by ${playerId}`);
    return "Недопустимое действие";
  }
  room.state = next;

  // If draft ended and no draft state, start new draft
  if (room.state.phase === "draft" && !room.state.draft) {
    room.state = startDraft(room.state);
  }

  // Log match if game ended
  if (room.state.phase === "end" && !room.matchLogged) {
    room.matchLogged = true;
    const botIds = new Set(room.players.filter((p) => p.isBot).map((p) => p.id));
    const summary = generateMatchSummary(room.state, room.id, room.startedAt ?? new Date(), botIds);
    saveMatchSummary(summary).catch((err) => console.error("[match-log] Error:", err));
  }

  // Schedule bot actions only after human action (avoid recursive scheduling)
  if (!isBot) {
    scheduleBotStep(room);
  }

  return null; // success
}

/**
 * Schedule a single bot action step with appropriate delay.
 * Bot actions go through the same handleAction() path as human players.
 */
function scheduleBotStep(room: Room) {
  // Clear any existing timer
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }

  if (!room.state || room.state.phase === "end") return;

  // Start new draft if needed
  if (room.state.phase === "draft" && !room.state.draft) {
    room.state = startDraft(room.state);
    room.broadcastState?.();
  }

  // Determine if it's a bot's turn
  const botInfo = getBotTurn(room);
  if (!botInfo) return; // Human's turn — stop scheduling

  const action = botAction(room.state, botInfo.botId);
  if (!action) {
    const botName = room.state.players.find((p) => p.id === botInfo.botId)?.name ?? botInfo.botId;
    console.log(`[${room.id}] ⚠️ Bot ${botName} returned NULL action (phase=${room.state.phase}, draftPhase=${room.state.draft?.draftPhase ?? "none"})`);
    // Fallback actions — also go through handleAction
    const fallbacks: GameAction[] = [];
    if (room.state.phase === "draft" && room.state.draft?.draftPhase === "companion") {
      fallbacks.push({ type: "companion_pick", playerId: botInfo.botId, companionId: CompanionId.Investor });
    } else if (room.state.phase === "turns") {
      fallbacks.push({ type: "end_turn", playerId: botInfo.botId });
    }
    for (const fb of fallbacks) {
      const err = handleAction(room.id, botInfo.botId, fb);
      if (!err) break;
    }
    room.broadcastState?.();
    scheduleBotStep(room);
    return;
  }

  const delay = 7000; // unified 7-second timeout for all bot actions

  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (!room.state || room.state.phase === "end") return;

    const err = handleAction(room.id, botInfo.botId, action);
    if (err) {
      console.log(`[${room.id}] ❌ Bot action REJECTED: ${action.type} — ${err}`);
      // Fallback attempts — same handleAction path
      const fallbacks: GameAction[] = [];
      if (action.type === "purple_card_pick") {
        fallbacks.push(
          { type: "purple_card_pick", playerId: botInfo.botId, cardIndex: 0 },
          { type: "purple_card_pick", playerId: botInfo.botId, cardIndex: -1 },
        );
      } else if (action.type === "companion_pick") {
        fallbacks.push({ type: "companion_pick", playerId: botInfo.botId, companionId: CompanionId.Investor });
      } else if (action.type !== "end_turn") {
        fallbacks.push({ type: "end_turn", playerId: botInfo.botId });
      }
      for (const fb of fallbacks) {
        const fbErr = handleAction(room.id, botInfo.botId, fb);
        if (!fbErr) break;
      }
    }

    // Broadcast updated state
    room.broadcastState?.();

    // Schedule next bot step
    scheduleBotStep(room);
  }, delay);
}

/** Get the bot player whose turn it is, or null if it's a human's turn */
function getBotTurn(room: Room): { botId: string } | null {
  if (!room.state) return null;

  // Purple card draft — all bots that haven't picked yet need to act
  if (room.state.purpleDraft) {
    for (let i = 0; i < room.state.players.length; i++) {
      if (room.state.purpleDraft.picked[i]) continue;
      const player = room.state.players[i];
      const rp = room.players.find((p) => p.id === player.id);
      if (rp?.isBot) return { botId: player.id };
    }
  }

  if (room.state.phase === "draft") {
    const dIdx = currentDrafter(room.state);
    if (dIdx === null) return null;
    const player = room.state.players[dIdx];
    const rp = room.players.find((p) => p.id === player.id);
    if (rp?.isBot) return { botId: player.id };
  }

  if (room.state.phase === "turns") {
    const pIdx = currentPlayer(room.state);
    if (pIdx === null) return null;
    const player = room.state.players[pIdx];
    const rp = room.players.find((p) => p.id === player.id);
    if (rp?.isBot) return { botId: player.id };
  }

  return null;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function disconnectPlayer(roomId: string, playerId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.find((p) => p.id === playerId && !p.isBot);
  if (!player) return;
  player.ws = null;
  if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
  player.disconnectTimer = setTimeout(() => {
    const r = rooms.get(roomId);
    if (!r) return;
    r.players = r.players.filter((p) => p.id !== playerId);
    if (r.players.filter((p) => !p.isBot).length === 0) {
      if (r.botTimer) clearTimeout(r.botTimer);
      rooms.delete(roomId);
    }
  }, 60_000);
}

export function removePlayer(roomId: string, playerId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.find((p) => p.id === playerId);
  if (player?.disconnectTimer) clearTimeout(player.disconnectTimer);
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.players.filter((p) => !p.isBot).length === 0) {
    if (room.botTimer) clearTimeout(room.botTimer);
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

/** Server-side hero visibility: hide unrevealed heroes from the view */
function isHeroRevealedForView(state: GameState, playerIdx: number, viewerIdx: number): boolean {
  if (playerIdx === viewerIdx) return true;
  if (state.phase === "end") return true;
  if (state.phase !== "turns" || !state.turnOrder) return false;

  const posInOrder = state.turnOrder.indexOf(playerIdx);
  if (posInOrder === -1) return false;
  return posInOrder <= state.currentTurnIndex;
}

export function createPlayerView(state: GameState, playerId: string): PlayerView {
  const myIndex = state.players.findIndex((p) => p.id === playerId);

  const players: PlayerViewEntry[] = state.players.map((p, i) => {
    const revealed = isHeroRevealedForView(state, i, myIndex);
    return {
      id: p.id,
      name: p.name,
      gold: p.gold,
      handSize: p.hand.length,
      hand: i === myIndex ? p.hand : null,
      builtDistricts: p.builtDistricts,
      hero: revealed ? p.hero : null,
      incomeTaken: p.incomeTaken,
      incomeOffer: i === myIndex ? (p.incomeOffer ?? null) : null,
      buildsRemaining: p.buildsRemaining,
      abilityUsed: p.abilityUsed,
      assassinated: revealed ? p.assassinated : false,
      robbedHeroId: p.robbedHeroId,
      finishedFirst: p.finishedFirst,
      companion: (i === myIndex || revealed) ? p.companion : null,
      companionUsed: p.companionUsed,
      companionDisabled: p.companionDisabled,
      designerMarkedCardId: p.designerMarkedCardId,
    };
  });

  let draft: DraftView | null = null;
  if (state.draft) {
    draft = {
      availableHeroes: state.draft.availableHeroes,
      faceUpBans: state.draft.faceUpBans,
      hiddenBanCount: state.draft.faceDownBans.length,
      draftOrder: state.draft.draftOrder,
      currentStep: state.draft.currentStep,
      draftPhase: state.draft.draftPhase,
      companionPool: state.draft.companionChoices?.[0] ?? null,
    };
  }

  // Purple draft: only show the current player's offers
  let purpleDraft: any = null;
  if (state.purpleDraft) {
    purpleDraft = {
      offers: state.purpleDraft.offers.map((cards, i) =>
        i === myIndex ? cards : null,
      ),
      picked: state.purpleDraft.picked,
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
    purpleDraft,
  };
}
