import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import {
  createRoom,
  joinRoom,
  addBot,
  startGame,
  handleAction,
  getRoom,
  removePlayer,
  getLobbyPlayers,
  createPlayerView,
} from "./room.js";

const PORT = Number(process.env.PORT ?? 4000);

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify({ status: "ok", service: "darms-server" }));
});

const wss = new WebSocketServer({ server: httpServer });

// Track which room/player each socket belongs to
const socketMeta = new WeakMap<WebSocket, { roomId: string; playerId: string }>();

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

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { type: "error", message: "Некорректный JSON" });
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
        const err = startGame(meta.roomId, meta.playerId);
        if (err) {
          send(ws, { type: "error", message: err });
        } else {
          broadcastState(meta.roomId);
        }
        break;
      }

      case "action": {
        const meta = socketMeta.get(ws);
        if (!meta) { send(ws, { type: "error", message: "Вы не в комнате" }); break; }
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
      removePlayer(meta.roomId, meta.playerId);
      broadcastLobby(meta.roomId);
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[darms-server] listening on :${PORT}`);
});
