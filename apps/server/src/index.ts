import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import {
  createRoom,
  joinRoom,
  reconnectRoom,
  addBot,
  setDeckBuild,
  startGame,
  handleAction,
  getRoom,
  disconnectPlayer,
  getLobbyPlayers,
  createPlayerView,
} from "./room.js";
import { initDb } from "./db.js";
import { loginWithGoogle, verifyToken } from "./auth.js";
import { updateNickname, updateSettings, getWallet, updateWallet } from "./db.js";

const PORT = Number(process.env.PORT ?? 4000);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";

// ---- HTTP helpers ----
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  });
  res.end(JSON.stringify(data));
}

// ---- HTTP Router ----
async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    json(res, 204, null);
    return;
  }

  // Health check
  if (url === "/" || url === "/health") {
    json(res, 200, { status: "ok", service: "darms-server" });
    return;
  }

  // Google OAuth login
  if (url === "/auth/google" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req));
      const idToken = body.idToken;
      if (!idToken) { json(res, 400, { error: "Missing idToken" }); return; }
      const result = await loginWithGoogle(idToken);
      json(res, 200, result);
    } catch (e: any) {
      console.error("[auth] Google login error:", e.message);
      json(res, 401, { error: "Authentication failed" });
    }
    return;
  }

  // Get current user profile
  if (url === "/auth/me" && method === "GET") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { json(res, 401, { error: "No token" }); return; }
    const user = await verifyToken(token);
    if (!user) { json(res, 401, { error: "Invalid token" }); return; }
    json(res, 200, {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      avatarUrl: user.avatar_url,
      settings: user.settings,
      gold: user.gold,
      diamonds: user.diamonds,
    });
    return;
  }

  // Update nickname
  if (url === "/auth/nickname" && method === "PUT") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { json(res, 401, { error: "No token" }); return; }
    const user = await verifyToken(token);
    if (!user) { json(res, 401, { error: "Invalid token" }); return; }
    const body = JSON.parse(await readBody(req));
    const nickname = String(body.nickname ?? "").trim().slice(0, 30);
    if (!nickname) { json(res, 400, { error: "Nickname required" }); return; }
    await updateNickname(user.id, nickname);
    json(res, 200, { nickname });
    return;
  }

  // Update settings
  if (url === "/auth/settings" && method === "PUT") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { json(res, 401, { error: "No token" }); return; }
    const user = await verifyToken(token);
    if (!user) { json(res, 401, { error: "Invalid token" }); return; }
    const body = JSON.parse(await readBody(req));
    await updateSettings(user.id, body.settings ?? {});
    json(res, 200, { ok: true });
    return;
  }

  // Wallet (gold/diamonds) read
  if (url === "/auth/wallet" && method === "GET") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { json(res, 401, { error: "No token" }); return; }
    const user = await verifyToken(token);
    if (!user) { json(res, 401, { error: "Invalid token" }); return; }
    const wallet = await getWallet(user.id);
    if (!wallet) { json(res, 404, { error: "User not found" }); return; }
    json(res, 200, wallet);
    return;
  }

  // Wallet (gold/diamonds) update (admin/dev endpoint for now)
  if (url === "/auth/wallet" && method === "PUT") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) { json(res, 401, { error: "No token" }); return; }
    const user = await verifyToken(token);
    if (!user) { json(res, 401, { error: "Invalid token" }); return; }
    const body = JSON.parse(await readBody(req));
    const gold = Number(body.gold ?? user.gold);
    const diamonds = Number(body.diamonds ?? user.diamonds);
    if (!Number.isFinite(gold) || !Number.isFinite(diamonds) || gold < 0 || diamonds < 0) {
      json(res, 400, { error: "Invalid wallet values" });
      return;
    }
    await updateWallet(user.id, Math.floor(gold), Math.floor(diamonds));
    json(res, 200, { gold: Math.floor(gold), diamonds: Math.floor(diamonds) });
    return;
  }

  // Google Client ID (public — needed by client GSI)
  if (url === "/auth/config") {
    json(res, 200, { googleClientId: GOOGLE_CLIENT_ID });
    return;
  }

  json(res, 404, { error: "Not found" });
}

const httpServer = createServer((req, res) => {
  handleHttp(req, res).catch((e) => {
    console.error("[http] Unhandled error:", e);
    json(res, 500, { error: "Internal error" });
  });
});

// ---- WebSocket ----
const MAX_MESSAGE_SIZE = 16 * 1024;
const RATE_LIMIT_WINDOW = 1000;
const RATE_LIMIT_MAX = 15;

const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_MESSAGE_SIZE });

const socketMeta = new WeakMap<WebSocket, { roomId: string; playerId: string }>();
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

function ensureBroadcast(roomId: string) {
  const room = getRoom(roomId);
  if (room && !room.broadcastState) {
    room.broadcastState = () => broadcastState(roomId);
  }
}

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    const now = Date.now();
    let timestamps = rateLimiter.get(ws);
    if (!timestamps) { timestamps = []; rateLimiter.set(ws, timestamps); }
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
        let userId: number | null = null;
        if (msg.authToken) {
          const user = await verifyToken(msg.authToken);
          userId = user?.id ?? null;
        }
        const { roomId, playerId } = createRoom(msg.playerName, ws, userId);
        socketMeta.set(ws, { roomId, playerId });
        send(ws, { type: "room_created", roomId, playerId });
        break;
      }

      case "join_room": {
        let userId: number | null = null;
        if (msg.authToken) {
          const user = await verifyToken(msg.authToken);
          userId = user?.id ?? null;
        }
        const result = joinRoom(msg.roomId.toUpperCase(), msg.playerName, ws, userId);
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

      case "set_deck_build": {
        const meta = socketMeta.get(ws);
        if (!meta) { send(ws, { type: "error", message: "Вы не в комнате" }); break; }
        const err = setDeckBuild(meta.roomId, meta.playerId, msg.build);
        if (err) {
          send(ws, { type: "error", message: err });
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

// ---- Startup ----
async function main() {
  try {
    await initDb();
  } catch (e) {
    console.warn("[db] PostgreSQL not available — auth disabled. Error:", (e as Error).message);
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[darms-server] listening on :${PORT}`);
  });
}

main();
