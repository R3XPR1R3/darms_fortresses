import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import {
  createRoom,
  joinRoom,
  reconnectRoom,
  addBot,
  startGame,
  handleAction,
  getRoom,
  disconnectPlayer,
  getLobbyPlayers,
  createPlayerView,
} from "./room.js";

const PORT = Number(process.env.PORT ?? 4000);

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify({ status: "ok", service: "darms-server" }));
});

const MAX_MESSAGE_SIZE = 16 * 1024; // 16 KB
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 15; // max 15 messages per second

const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_MESSAGE_SIZE });

// Track which room/player each socket belongs to
const socketMeta = new WeakMap<WebSocket, { roomId: string; playerId: string }>();

// Rate-limiter state per socket
const rateLimiter = new WeakMap<WebSocket, number[]>();

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastLobby(roomId: string) {
  const room = getRoom(roomId);
  if (!room) return;
  const players = getLobbyPlayers(room);
  for (const rp of room.players) {
    if (rp.ws) send(rp.ws, { type: "lobby_update", players });
  }
}

function broadcastState(roomId: string) {
  const room = getRoom(roomId);
  if (!room?.state) return;
  for (const rp of room.players) {
    if (rp.ws) {
      const view = createPlayerView(room.state, rp.id);
      send(rp.ws, { type: "game_state", state: view });
    }
  }
}

/** Set the broadcastState callback on the room so async bot steps can broadcast */
function ensureBroadcast(roomId: string) {
  const room = getRoom(roomId);
  if (room && !room.broadcastState) {
    room.broadcastState = () => broadcastState(roomId);
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    // Rate limiting
    const now = Date.now();
    let timestamps = rateLimiter.get(ws);
    if (!timestamps) { timestamps = []; rateLimiter.set(ws, timestamps); }
    // Prune old timestamps
    while (timestamps.length > 0 && now - timestamps[0] > RATE_LIMIT_WINDOW) timestamps.shift();
    if (timestamps.length >= RATE_LIMIT_MAX) {
      send(ws, { type: "error", message: "Too many requests" });
      return;
    }
    timestamps.push(now);

    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { type: "error", message: "Invalid message" });
      return;
    }

    switch (msg.type) {
      case "create_room": {
        const { roomId, playerId } = createRoom(msg.playerName, ws);
        socketMeta.set(ws, { roomId, playerId });
        send(ws, { type: "room_created", roomId, playerId });
        break;
      }

      case "join_room": {
        const result = joinRoom(msg.roomId.toUpperCase(), msg.playerName, ws);
        if (typeof result === "string") {
          send(ws, { type: "error", message: result });
        } else {
          socketMeta.set(ws, { roomId: msg.roomId.toUpperCase(), playerId: result.playerId });
          send(ws, { type: "room_joined", roomId: msg.roomId.toUpperCase(), playerId: result.playerId, players: result.players });
          broadcastLobby(msg.roomId.toUpperCase());
        }
        break;
      }

      case "reconnect_room": {
        const roomId = msg.roomId.toUpperCase();
        const result = reconnectRoom(roomId, msg.playerId, ws);
        if (typeof result === "string") {
          send(ws, { type: "error", message: result });
        } else {
          socketMeta.set(ws, { roomId, playerId: msg.playerId });
          send(ws, { type: "room_reconnected", roomId, playerId: msg.playerId, players: result });
          const room = getRoom(roomId);
          if (room?.state) {
            broadcastState(roomId);
          } else {
            broadcastLobby(roomId);
          }
        }
        break;
      }

      case "add_bot": {
        const meta = socketMeta.get(ws);
        if (!meta) { send(ws, { type: "error", message: "Вы не в комнате" }); break; }
        const result = addBot(meta.roomId, meta.playerId);
        if (typeof result === "string") {
          send(ws, { type: "error", message: result });
        } else {
          broadcastLobby(meta.roomId);
        }
        break;
      }

      case "start_game": {
        const meta = socketMeta.get(ws);
        if (!meta) { send(ws, { type: "error", message: "Вы не в комнате" }); break; }
        try {
          ensureBroadcast(meta.roomId);
          const err = startGame(meta.roomId, meta.playerId);
          if (err) {
            send(ws, { type: "error", message: err });
          } else {
            broadcastState(meta.roomId);
          }
        } catch (e) {
          console.error("startGame error:", e);
          send(ws, { type: "error", message: "Ошибка запуска игры" });
        }
        break;
      }

      case "action": {
        const meta = socketMeta.get(ws);
        if (!meta) { send(ws, { type: "error", message: "Вы не в комнате" }); break; }
        ensureBroadcast(meta.roomId);
        const err = handleAction(meta.roomId, meta.playerId, msg.action);
        if (err) {
          send(ws, { type: "error", message: err });
        } else {
          broadcastState(meta.roomId);
        }
        break;
      }
    }
  });

  ws.on("close", () => {
    const meta = socketMeta.get(ws);
    if (meta) {
      disconnectPlayer(meta.roomId, meta.playerId);
      broadcastLobby(meta.roomId);
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[darms-server] listening on :${PORT}`);
});
