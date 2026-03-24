import type { GameState, GameAction, AbilityPayload, PlayerState } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS } from "@darms/shared-types";
import { createRng, createMatch, createBaseDeck, processAction, startDraft, botAction, currentDrafter, currentPlayer } from "@darms/game-core";
import { HERO_ICONS, districtColorDot, heroPortrait, heroPortraitLarge, heroPortraitSmall } from "./icons.js";
import {
  animateCardsAppear, animateDraftHeroes, animateBannerSwitch,
  animateOpponentBoard, animateMyBoard, animateBuild, animateIncome,
  animateWinner, animateLogEntry, animateActiveArrow, animateTimerUrgent,
} from "./anim.js";
import { t, tHero, tDistrict, tLog, tName, getLang, setLang } from "./i18n.js";

// ---- Types for online mode ----
interface PlayerView {
  phase: GameState["phase"];
  players: PlayerViewEntry[];
  crownHolder: number;
  day: number;
  deckSize: number;
  draft: DraftView | null;
  turnOrder: number[] | null;
  currentTurnIndex: number;
  winner: number | null;
  log: { day: number; message: string }[];
  myIndex: number;
}

interface PlayerViewEntry {
  id: string;
  name: string;
  gold: number;
  handSize: number;
  hand: PlayerState["hand"] | null;
  builtDistricts: PlayerState["builtDistricts"];
  hero: PlayerState["hero"];
  incomeTaken: boolean;
  buildsRemaining: number;
  abilityUsed: boolean;
  assassinated: boolean;
  robbedHeroId: PlayerState["robbedHeroId"];
  finishedFirst: boolean;
}

interface DraftView {
  availableHeroes: HeroId[];
  faceUpBans: HeroId[];
  hiddenBanCount: number;
  draftOrder: number[];
  currentStep: number;
}

interface LobbyPlayer {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
}

// ---- Game mode ----
type GameMode = "menu" | "local" | "lobby" | "online";

let mode: GameMode = "menu";
let ws: WebSocket | null = null;
let myPlayerId = "";
let myRoomId = "";
let isHost = false;
let lobbyPlayers: LobbyPlayer[] = [];

// ---- Local game state ----
const HUMAN_ID = "human";
const BOT_IDS = ["bot-1", "bot-2", "bot-3"];
function getLocalPlayers() {
  return [
    { id: HUMAN_ID, name: t("lobby.you") },
    { id: BOT_IDS[0], name: "Бот Алиса" },
    { id: BOT_IDS[1], name: "Бот Борис" },
    { id: BOT_IDS[2], name: "Бот Вика" },
  ];
}

let localState: GameState | null = null;
let onlineState: PlayerView | null = null;

// ---- Draft timer ----
const DRAFT_TIMER_SECONDS = 60;
let draftTimerInterval: ReturnType<typeof setInterval> | null = null;
let draftTimerRemaining = 0;
let draftTimerForStep = -1; // track which draft step the timer is for

// ---- Turn timer (player turn, 60s) ----
const TURN_TIMER_SECONDS = 60;
let turnTimerInterval: ReturnType<typeof setInterval> | null = null;
let turnTimerRemaining = 0;
let turnTimerForPlayer = -1; // track which player's turn the timer is for

// ---- Track last action for animations ----
let lastAction: string | null = null;

// ---- Init ----
function showMenu() {
  mode = "menu";
  localState = null;
  onlineState = null;
  renderMenu();
}

function startLocal() {
  mode = "local";
  const seed = Date.now();
  const rng = createRng(seed);
  const deck = createBaseDeck();
  localState = createMatch(getLocalPlayers(), deck, rng);
  localState = startDraft(localState);
  render();
  // Let bots make their draft picks if human isn't first
  setTimeout(runLocalBots, 300);
}

function showLobbyScreen(action: "create" | "join") {
  const app = document.getElementById("app")!;
  const playerName = (document.getElementById("player-name") as HTMLInputElement)?.value?.trim() || t("menu.default_name");

  if (action === "create") {
    connectWS(playerName, null);
  } else {
    const roomInput = prompt(t("lobby.enter_code"));
    if (!roomInput) return;
    connectWS(playerName, roomInput.toUpperCase().trim());
  }

  mode = "lobby";
  app.innerHTML = `
    <h1>⚔ Darms: Fortresses</h1>
    <div class="phase-label">${t("lobby.connecting")}</div>
  `;
}

// ---- WebSocket ----
function connectWS(playerName: string, roomId: string | null) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const host = location.host; // includes port if non-standard
  ws = new WebSocket(`${protocol}//${host}/ws`);

  ws.onopen = () => {
    if (roomId) {
      ws!.send(JSON.stringify({ type: "join_room", roomId, playerName }));
    } else {
      ws!.send(JSON.stringify({ type: "create_room", playerName }));
    }
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    if (mode === "lobby" || mode === "online") {
      mode = "menu";
      renderMenu();
    }
  };
}

function handleServerMessage(msg: Record<string, unknown>) {
  switch (msg.type) {
    case "room_created":
      myRoomId = msg.roomId as string;
      myPlayerId = msg.playerId as string;
      isHost = true;
      lobbyPlayers = [{ id: myPlayerId, name: t("lobby.you"), isBot: false, isHost: true }];
      renderLobby();
      break;

    case "room_joined":
      myRoomId = msg.roomId as string;
      myPlayerId = msg.playerId as string;
      isHost = false;
      lobbyPlayers = msg.players as LobbyPlayer[];
      renderLobby();
      break;

    case "lobby_update":
      lobbyPlayers = msg.players as LobbyPlayer[];
      renderLobby();
      break;

    case "game_state":
      mode = "online";
      onlineState = msg.state as PlayerView;
      render();
      break;

    case "error":
      alert(msg.message);
      break;
  }
}

function sendAction(action: GameAction) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "action", action }));
  }
}

// ---- Dispatch (works for both modes) ----
function dispatch(action: GameAction) {
  lastAction = action.type;
  if (mode === "online") {
    sendAction(action);
    return;
  }
  // local mode
  if (!localState) return;
  const next = processAction(localState, action);
  if (!next) {
    console.warn("Invalid action:", action);
    return;
  }
  localState = next;
  render();
  setTimeout(runLocalBots, 300);
}

/** Execute ONE bot action, then re-render and schedule the next one */
function runLocalBots() {
  if (!localState || localState.phase === "end") return;

  // Start new draft if needed
  if (localState.phase === "draft" && !localState.draft) {
    localState = startDraft(localState);
    render();
    setTimeout(runLocalBots, 500);
    return;
  }

  // Determine if it's a bot's turn
  let botId: string | null = null;
  if (localState.phase === "draft") {
    const dIdx = currentDrafter(localState);
    if (dIdx !== null && localState.players[dIdx].id !== HUMAN_ID) {
      botId = localState.players[dIdx].id;
    }
  } else if (localState.phase === "turns") {
    const pIdx = currentPlayer(localState);
    if (pIdx !== null && localState.players[pIdx].id !== HUMAN_ID) {
      botId = localState.players[pIdx].id;
    }
  }

  if (!botId) return; // Human's turn — stop scheduling

  const action = botAction(localState, botId);
  if (!action) {
    // Bot has no action — force end turn
    const fallback = processAction(localState, { type: "end_turn", playerId: botId });
    if (fallback) localState = fallback;
    if (localState.phase === "draft" && !localState.draft) {
      localState = startDraft(localState);
    }
    render();
    setTimeout(runLocalBots, 500);
    return;
  }

  const next = processAction(localState, action);
  if (!next) {
    // Action failed — force end turn to prevent infinite loop
    if (action.type !== "end_turn") {
      const fallback = processAction(localState, { type: "end_turn", playerId: botId });
      if (fallback) localState = fallback;
      if (localState.phase === "draft" && !localState.draft) {
        localState = startDraft(localState);
      }
      render();
      setTimeout(runLocalBots, 500);
    }
    return;
  }

  localState = next;

  // Start new draft if day transition happened
  if (localState.phase === "draft" && !localState.draft) {
    localState = startDraft(localState);
  }

  render();

  if (localState.phase === "end") return;

  // Check if next action is still a bot's turn
  const isHumanTurn = checkLocalHumanTurn();
  if (!isHumanTurn) {
    // Delay: draft picks = 2s, end_turn = 10s, other bot actions = 5s
    const delay = action.type === "draft_pick" ? 2000
      : action.type === "end_turn" ? 10000
      : 5000;
    setTimeout(runLocalBots, delay);
  }
}

function checkLocalHumanTurn(): boolean {
  if (!localState) return false;
  if (localState.phase === "draft") {
    const dIdx = currentDrafter(localState);
    return dIdx !== null && localState.players[dIdx].id === HUMAN_ID;
  }
  if (localState.phase === "turns") {
    const pIdx = currentPlayer(localState);
    return pIdx !== null && localState.players[pIdx].id === HUMAN_ID;
  }
  return false;
}

// ---- Unified accessors ----
function getPhase(): string {
  if (mode === "online" && onlineState) return onlineState.phase;
  if (localState) return localState.phase;
  return "setup";
}

function getDay(): number {
  if (mode === "online" && onlineState) return onlineState.day;
  if (localState) return localState.day;
  return 0;
}

function getPlayers(): PlayerViewEntry[] {
  if (mode === "online" && onlineState) return onlineState.players;
  if (localState) {
    return localState.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      gold: p.gold,
      handSize: p.hand.length,
      hand: p.id === HUMAN_ID ? p.hand : null,
      builtDistricts: p.builtDistricts,
      hero: p.hero,
      incomeTaken: p.incomeTaken,
      buildsRemaining: p.buildsRemaining,
      abilityUsed: p.abilityUsed,
      assassinated: p.assassinated,
      robbedHeroId: p.robbedHeroId,
      finishedFirst: p.finishedFirst,
    }));
  }
  return [];
}

function getMyId(): string {
  if (mode === "online") return myPlayerId;
  return HUMAN_ID;
}

function getMyIndex(): number {
  if (mode === "online" && onlineState) return onlineState.myIndex;
  if (localState) return localState.players.findIndex((p) => p.id === HUMAN_ID);
  return 0;
}

function getMyHand(): PlayerState["hand"] {
  const players = getPlayers();
  const me = players[getMyIndex()];
  return me?.hand ?? [];
}

function getDraft(): DraftView | null {
  if (mode === "online" && onlineState) return onlineState.draft;
  if (localState?.draft) {
    return {
      availableHeroes: localState.draft.availableHeroes,
      faceUpBans: localState.draft.faceUpBans,
      hiddenBanCount: localState.draft.faceDownBans.length,
      draftOrder: localState.draft.draftOrder,
      currentStep: localState.draft.currentStep,
    };
  }
  return null;
}

function getActiveIndex(): number | null {
  if (mode === "online" && onlineState) {
    const phase = onlineState.phase;
    if (phase === "draft" && onlineState.draft) {
      const step = onlineState.draft.currentStep;
      if (step < onlineState.draft.draftOrder.length) {
        return onlineState.draft.draftOrder[step];
      }
    }
    if (phase === "turns" && onlineState.turnOrder) {
      return onlineState.turnOrder[onlineState.currentTurnIndex] ?? null;
    }
    return null;
  }
  if (localState) {
    if (localState.phase === "turns") return currentPlayer(localState);
    if (localState.phase === "draft") return currentDrafter(localState);
  }
  return null;
}

function getWinner(): number | null {
  if (mode === "online" && onlineState) return onlineState.winner;
  if (localState) return localState.winner;
  return null;
}

function getLog(): { day: number; message: string }[] {
  if (mode === "online" && onlineState) return onlineState.log;
  if (localState) return localState.log;
  return [];
}

function isMyTurn(): boolean {
  return getActiveIndex() === getMyIndex();
}

// ---- Hero helpers ----
function heroName(id: HeroId): string {
  return tHero(id);
}

function heroSpeed(id: HeroId): number {
  return HEROES.find((h) => h.id === id)?.speed ?? 0;
}

function heroIcon(id: HeroId | string): string {
  return HERO_ICONS[id] ?? "";
}

const COLOR_HEX: Record<string, string> = {
  yellow: "#f0c040",
  blue: "#4090f0",
  green: "#40c060",
  red: "#e04050",
  purple: "#9060e0",
};

/** Returns CSS class for single-color, or inline style attr for multi-color split */
function colorStyle(colors: string[]): { cls: string; style: string } {
  if (colors.length === 1) {
    return { cls: `color-${colors[0]}`, style: "" };
  }
  // Dual-color: 50/50 split gradient
  const c1 = COLOR_HEX[colors[0]] ?? "#888";
  const c2 = COLOR_HEX[colors[1]] ?? "#888";
  return {
    cls: "",
    style: `background: linear-gradient(135deg, ${c1} 50%, ${c2} 50%); color: #fff;`,
  };
}

function districtCardHtml(d: { colors: string[]; name: string; cost: number; hp?: number }): string {
  const cs = colorStyle(d.colors);
  const hpLabel = d.hp != null && d.hp !== d.cost ? `<div class="card-hp">HP ${d.hp}</div>` : "";
  return `<div class="district-card ${cs.cls}" style="${cs.style}">
    <div class="card-cost-badge">${d.cost}</div>
    <div class="card-name">${tDistrict(d.name)}</div>
    ${hpLabel}
  </div>`;
}

// ---- Player switching state ----
let selectedOpponentIndex: number | null = null;

/**
 * Determine if a player's hero should be visible to the current player.
 * Rules:
 * - Always see your own hero
 * - During draft: nobody's hero is revealed
 * - During turns: a player's hero is visible if their turn position
 *   has been reached or passed (posInOrder <= currentTurnIndex).
 *   Assassinated players stay hidden until their turn would have come,
 *   keeping the intrigue alive. advanceTurn skips them, so
 *   currentTurnIndex jumps past their position.
 * - During end phase: all heroes visible
 */
function isHeroRevealed(playerIndex: number): boolean {
  if (playerIndex === getMyIndex()) return true;
  const phase = getPhase();
  if (phase === "end") return true;
  if (phase !== "turns") return false;

  const turnOrder = getTurnOrder();
  if (!turnOrder) return false;

  const currentTurnIdx = getCurrentTurnIndex();
  const posInOrder = turnOrder.indexOf(playerIndex);
  if (posInOrder === -1) return false;
  return posInOrder <= currentTurnIdx;
}

function getTurnOrder(): number[] | null {
  if (mode === "online" && onlineState) return onlineState.turnOrder;
  if (localState) return localState.turnOrder;
  return null;
}

function getCurrentTurnIndex(): number {
  if (mode === "online" && onlineState) return onlineState.currentTurnIndex;
  if (localState) return localState.currentTurnIndex;
  return 0;
}

// ---- Rendering ----
function renderMenu() {
  // Clean up game board if exists
  const board = document.getElementById("game-board");
  if (board) board.remove();
  selectedOpponentIndex = null;
  stopDraftTimer();

  const app = document.getElementById("app")!;
  app.innerHTML = `
    <h1>⚔ Darms: Fortresses</h1>
    <div class="menu-screen">
      <div class="menu-title">${t("menu.subtitle")}</div>
      <button class="btn btn-secondary btn-small" id="btn-lang">${t("lang.toggle")}</button>
      <input type="text" id="player-name" placeholder="${t("menu.name_placeholder")}" value="${t("menu.default_name")}" class="menu-input" maxlength="20"/>
      <button class="btn btn-primary btn-large" id="btn-local">🎮 ${t("menu.local")}</button>
      <div class="menu-divider">${t("menu.online_divider")}</div>
      <button class="btn btn-secondary btn-large" id="btn-create">🌐 ${t("menu.create_room")}</button>
      <button class="btn btn-secondary btn-large" id="btn-join">🔗 ${t("menu.join_room")}</button>
    </div>
  `;

  document.getElementById("btn-lang")!.addEventListener("click", () => {
    setLang(getLang() === "en" ? "ru" : "en");
    renderMenu();
  });
  document.getElementById("btn-local")!.addEventListener("click", startLocal);
  document.getElementById("btn-create")!.addEventListener("click", () => showLobbyScreen("create"));
  document.getElementById("btn-join")!.addEventListener("click", () => showLobbyScreen("join"));
}

function renderLobby() {
  const app = document.getElementById("app")!;
  const playersList = lobbyPlayers.map((p) =>
    `<div class="lobby-player ${p.isHost ? "host" : ""}">
      ${p.isBot ? "🤖" : "👤"} ${tName(p.name)} ${p.isHost ? t("lobby.host") : ""}
    </div>`
  ).join("");

  app.innerHTML = `
    <h1>⚔ Darms: Fortresses</h1>
    <div class="lobby-screen">
      <div class="room-code">${t("lobby.room_code")}<strong>${myRoomId}</strong></div>
      <div class="lobby-info">${t("lobby.share_code")}</div>
      <div class="lobby-players">${playersList}</div>
      <div class="lobby-count">${lobbyPlayers.length}/4 ${t("lobby.players_count")}</div>
      ${isHost ? `
        <div class="lobby-actions">
          <button class="btn btn-secondary" id="btn-add-bot">🤖 ${t("lobby.add_bot")}</button>
          <button class="btn btn-primary btn-large" id="btn-start" ${lobbyPlayers.length < 4 ? "disabled" : ""}>▶ ${t("lobby.start_game")}</button>
        </div>
      ` : `<div class="lobby-info">${t("lobby.waiting_host")}</div>`}
      <button class="btn btn-secondary" id="btn-back-menu" style="margin-top:12px;">← ${t("lobby.back")}</button>
    </div>
  `;

  document.getElementById("btn-add-bot")?.addEventListener("click", () => {
    ws?.send(JSON.stringify({ type: "add_bot" }));
  });
  document.getElementById("btn-start")?.addEventListener("click", () => {
    ws?.send(JSON.stringify({ type: "start_game" }));
  });
  document.getElementById("btn-back-menu")?.addEventListener("click", () => {
    ws?.close();
    showMenu();
  });
}

function ensureGameLayout() {
  if (document.getElementById("game-board")) return;
  const app = document.getElementById("app")!;
  app.innerHTML = "";
  const board = document.createElement("div");
  board.id = "game-board";
  board.innerHTML = `
    <div id="turn-banner"></div>
    <div id="opponent-tabs"></div>
    <div id="opponent-board"></div>
    <div id="center-area">
      <div id="draft-area"></div>
    </div>
    <div id="my-board"></div>
    <div id="ban-list"></div>
    <div id="log-toggle">📜 ${t("log.toggle")}</div>
    <div id="game-log"></div>
  `;
  document.body.insertBefore(board, document.body.firstChild);

  document.getElementById("log-toggle")!.addEventListener("click", () => {
    document.getElementById("game-log")!.classList.toggle("show");
  });
}

function render() {
  if (mode === "menu") { renderMenu(); return; }
  if (mode === "lobby") { renderLobby(); return; }
  ensureGameLayout();
  renderTurnBanner();
  renderOpponentTabs();
  renderOpponentBoard();
  renderDraft();
  renderMyBoard();
  renderBanList();
  renderLog();
  renderWinner();
}

function renderTurnBanner() {
  const el = document.getElementById("turn-banner")!;
  if (!el) return;
  const phase = getPhase();
  const day = getDay();
  const activeIdx = getActiveIndex();
  const players = getPlayers();
  const myTurn = isMyTurn();

  if (phase === "draft") {
    el.className = "turn-banner" + (myTurn ? " my-turn" : "");
    el.id = "turn-banner";
    el.innerHTML = myTurn
      ? `⚔ ${t("banner.day")} ${day} — ${t("banner.your_pick")}`
      : `${t("banner.day")} ${day} — ${t("banner.hero_pick")}`;
    return;
  }

  if (phase === "turns" && activeIdx !== null) {
    const activePlayer = players[activeIdx];
    const revealed = isHeroRevealed(activeIdx);
    el.className = "turn-banner" + (myTurn ? " my-turn" : "");
    el.id = "turn-banner";

    // Manage turn timer for human player
    if (myTurn) {
      startTurnTimer(activeIdx);
      const timerCls = turnTimerRemaining <= 10 ? "turn-timer timer-urgent" : "turn-timer";
      const timerHtml = `<span id="turn-timer" class="${timerCls}">${turnTimerRemaining}s</span>`;
      const heroId = activePlayer?.hero;
      el.innerHTML = heroId
        ? `${heroPortraitSmall(heroId)} ${t("banner.your_turn")} — ${heroName(heroId)} ${timerHtml}`
        : `⚔ ${t("banner.your_turn")}! ${timerHtml}`;
    } else {
      stopTurnTimer();
      if (revealed && activePlayer?.hero) {
        el.innerHTML = `${heroPortraitSmall(activePlayer.hero)} ${t("banner.turn_of")}${heroName(activePlayer.hero)} (${tName(activePlayer.name)})`;
      } else {
        el.innerHTML = `⏳ ${t("banner.turn_of")}${tName(activePlayer?.name ?? "...")}`;
      }
    }
    animateBannerSwitch();
    return;
  }

  if (phase === "end") {
    el.className = "";
    el.id = "turn-banner";
    el.innerHTML = `🏆 ${t("banner.game_over")}`;
    stopTurnTimer();
    return;
  }

  el.className = "";
  el.id = "turn-banner";
  el.innerHTML = `${t("banner.day")} ${day}`;
}

function renderOpponentTabs() {
  const el = document.getElementById("opponent-tabs")!;
  if (!el) return;
  const players = getPlayers();
  const myIdx = getMyIndex();
  const activeIdx = getActiveIndex();
  const phase = getPhase();

  // Show tabs during draft, turns, and end phases
  if (phase !== "draft" && phase !== "turns" && phase !== "end") {
    el.innerHTML = "";
    return;
  }

  const opponents = players
    .map((p, i) => ({ player: p, index: i }))
    .filter((x) => x.index !== myIdx);

  // Auto-select first opponent if none selected
  if (selectedOpponentIndex === null || selectedOpponentIndex === myIdx) {
    selectedOpponentIndex = opponents[0]?.index ?? null;
  }

  el.innerHTML = opponents.map((x) => {
    const p = x.player;
    const i = x.index;
    const isActive = i === activeIdx;
    const revealed = isHeroRevealed(i);
    const selected = i === selectedOpponentIndex;

    let label: string;
    let heroLine = "";

    if (revealed && p.hero) {
      label = heroName(p.hero);
      heroLine = `<span class="tab-hero">${heroPortraitSmall(p.hero)}</span>`;
    } else {
      label = tName(p.name);
      heroLine = `<span class="tab-sleep">💤</span>`;
    }

    const stats = `<span class="tab-stats">💰${p.gold} 🏠${p.builtDistricts.length}/${WIN_DISTRICTS}</span>`;
    const arrow = isActive ? `<span class="active-arrow">▼</span>` : "";

    return `
      <button class="opp-tab ${selected ? "active" : ""} ${isActive ? "is-current-turn" : ""}" data-opp-idx="${i}">
        ${arrow}
        ${heroLine}
        <span>${label}</span>
        ${stats}
      </button>
    `;
  }).join("");

  el.querySelectorAll(".opp-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedOpponentIndex = parseInt((btn as HTMLElement).dataset.oppIdx!, 10);
      renderOpponentTabs();
      renderOpponentBoard();
    });
  });

  // Animate the active player arrow
  animateActiveArrow();
}

function renderOpponentBoard() {
  const el = document.getElementById("opponent-board")!;
  if (!el) return;
  const phase = getPhase();

  if ((phase !== "draft" && phase !== "turns" && phase !== "end") || selectedOpponentIndex === null) {
    el.innerHTML = "";
    return;
  }

  const players = getPlayers();
  const p = players[selectedOpponentIndex];
  if (!p) { el.innerHTML = ""; return; }

  const revealed = isHeroRevealed(selectedOpponentIndex);

  // Hero display
  let heroSection: string;
  if (revealed && p.hero) {
    const heroDef = HEROES.find((h) => h.id === p.hero);
    heroSection = `
      <div class="opp-hero-display">
        <div class="hero-icon-large">${heroPortrait(p.hero, 64)}</div>
        <div class="hero-name">${heroName(p.hero)}</div>
        <div class="hero-speed">${t("draft.speed")} ${heroDef?.speed ?? "?"}</div>
      </div>
    `;
  } else {
    heroSection = `
      <div class="opp-hero-display">
        <div class="sleep-display">💤</div>
        <div class="hero-name" style="color: #888;">${tName(p.name)}</div>
        <div class="hero-speed">${t("opp.role_hidden")}</div>
      </div>
    `;
  }

  // Stats bar
  const statsBar = `
    <div class="opp-stats-bar">
      <span>💰 ${p.gold}</span>
      <span>🃏 ${p.hand ? p.hand.length : p.handSize}</span>
      <span>🏠 ${p.builtDistricts.length}/${WIN_DISTRICTS}</span>
      ${p.finishedFirst ? "<span>⭐</span>" : ""}
    </div>
  `;

  // Districts
  const districts = p.builtDistricts.map(
    (d) => districtCardHtml(d),
  ).join("");
  const districtsSection = districts
    ? `<div class="opp-districts">${districts}</div>`
    : `<div class="opp-districts" style="color:#666;font-size:12px;">${t("opp.no_districts")}</div>`;

  // Assassination status
  const assassinated = p.assassinated
    ? `<div class="opp-assassinated">💀 ${t("opp.killed_today")}</div>`
    : "";

  el.innerHTML = heroSection + statsBar + districtsSection + assassinated;
  animateOpponentBoard();
  animateCardsAppear(".opp-districts");
}

function startDraftTimer(draft: DraftView) {
  const currentStep = draft.currentStep;
  // Don't restart timer for the same step
  if (draftTimerForStep === currentStep && draftTimerInterval) return;

  stopDraftTimer();
  draftTimerForStep = currentStep;
  draftTimerRemaining = DRAFT_TIMER_SECONDS;

  draftTimerInterval = setInterval(() => {
    draftTimerRemaining--;
    // Update the timer display without full re-render
    const timerEl = document.getElementById("draft-timer");
    if (timerEl) timerEl.textContent = `${draftTimerRemaining}s`;

    if (draftTimerRemaining <= 0) {
      stopDraftTimer();
      // Auto-pick a random hero
      const currentDraft = getDraft();
      if (currentDraft && currentDraft.availableHeroes.length > 0 && isMyTurn()) {
        const randomIdx = Math.floor(Math.random() * currentDraft.availableHeroes.length);
        const heroId = currentDraft.availableHeroes[randomIdx];
        dispatch({ type: "draft_pick", playerId: getMyId(), heroId });
      }
    }
  }, 1000);
}

function stopDraftTimer() {
  if (draftTimerInterval) {
    clearInterval(draftTimerInterval);
    draftTimerInterval = null;
  }
  draftTimerForStep = -1;
}

// ---- Turn timer ----
function startTurnTimer(playerIdx: number) {
  if (turnTimerForPlayer === playerIdx && turnTimerInterval) return;
  stopTurnTimer();
  turnTimerForPlayer = playerIdx;
  turnTimerRemaining = TURN_TIMER_SECONDS;

  turnTimerInterval = setInterval(() => {
    turnTimerRemaining--;
    const timerEl = document.getElementById("turn-timer");
    if (timerEl) {
      timerEl.textContent = `${turnTimerRemaining}s`;
      if (turnTimerRemaining <= 10) {
        timerEl.className = "turn-timer timer-urgent";
        animateTimerUrgent();
      }
    }
    if (turnTimerRemaining <= 0) {
      stopTurnTimer();
      // Auto end turn when timer expires
      dispatch({ type: "end_turn", playerId: getMyId() });
    }
  }, 1000);
}

function stopTurnTimer() {
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }
  turnTimerForPlayer = -1;
}

function renderDraft() {
  const el = document.getElementById("draft-area")!;
  if (!el) return;
  const phase = getPhase();
  const draft = getDraft();

  if (phase !== "draft" && phase !== "turns") {
    el.innerHTML = "";
    stopDraftTimer();
    return;
  }

  // During turns phase, bans are rendered in #ban-list (above journal)
  if (phase === "turns") {
    stopDraftTimer();
    el.innerHTML = "";
    return;
  }

  if (!draft) {
    el.innerHTML = "";
    stopDraftTimer();
    return;
  }

  const myTurn = isMyTurn();

  // Manage draft timer
  if (myTurn) {
    startDraftTimer(draft);
  } else {
    stopDraftTimer();
  }

  const bans = draft.faceUpBans.map((h) =>
    `<span class="ban-up">${heroPortraitSmall(h)} ${heroName(h)}</span>`,
  ).join(", ");

  let heroButtons = "";
  if (myTurn) {
    heroButtons = draft.availableHeroes.map((h) => `
      <button class="hero-btn" data-hero="${h}">
        <div class="hero-btn-icon">${heroPortraitLarge(h)}</div>
        <div class="hero-btn-name">${heroName(h)}</div>
        <div class="speed">${t("draft.speed")} ${heroSpeed(h)}</div>
      </button>
    `).join("");
  }

  const timerDisplay = myTurn
    ? `<span id="draft-timer" class="draft-timer ${draftTimerRemaining <= 10 ? 'timer-urgent' : ''}">${draftTimerRemaining}s</span>`
    : "";

  el.innerHTML = `
    <h2>${t("draft.title")} ${timerDisplay}</h2>
    <div class="bans">${t("draft.banned")}${bans} + ${draft.hiddenBanCount} ${t("draft.hidden")}</div>
    ${myTurn ? `<p class="hint">${t("draft.choose_hero")}</p>` : `<p class="hint">${t("draft.others_choosing")}</p>`}
    <div class="draft-heroes">${heroButtons}</div>
  `;

  if (myTurn) {
    animateDraftHeroes();
    el.querySelectorAll(".hero-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        stopDraftTimer();
        const heroId = (btn as HTMLElement).dataset.hero as HeroId;
        dispatch({ type: "draft_pick", playerId: getMyId(), heroId });
      });
    });
  }
}

function renderMyBoard() {
  const el = document.getElementById("my-board")!;
  if (!el) return;
  const phase = getPhase();
  const players = getPlayers();
  const me = players[getMyIndex()];
  if (!me) { el.innerHTML = ""; return; }

  if (phase === "draft" || phase === "setup") {
    el.innerHTML = "";
    return;
  }

  const myTurnNow = isMyTurn();
  const hand = getMyHand();

  // My hero row
  let heroRow = "";
  if (me.hero) {
    const heroDef = HEROES.find((h) => h.id === me.hero);
    const abilityTag = heroDef
      ? `<span class="my-hero-ability-tag">${getAbilityDescription(me.hero)}</span>`
      : "";
    heroRow = `
      <div class="my-hero-row">
        <div class="hero-icon-large">${heroPortrait(me.hero, 48)}</div>
        <div class="my-hero-info">
          <div class="my-hero-name">${heroName(me.hero)}</div>
          <div class="my-hero-speed">${t("draft.speed")} ${heroDef?.speed ?? "?"}</div>
          ${abilityTag}
        </div>
      </div>
    `;
  }

  // Stats bar
  const statsBar = `
    <div class="my-stats-bar">
      <span>💰 ${me.gold}</span>
      <span>🃏 ${hand.length}</span>
      <span>🏠 ${me.builtDistricts.length}/${WIN_DISTRICTS}</span>
      ${me.finishedFirst ? `<span>⭐ ${t("my.first")}</span>` : ""}
    </div>
  `;

  // My districts
  const districts = me.builtDistricts.map(
    (d) => districtCardHtml(d),
  ).join("");
  const districtsSection = districts ? `<div class="my-districts">${districts}</div>` : "";

  // Hand
  const canBuild = myTurnNow && me.buildsRemaining > 0 && me.incomeTaken;
  let handSection = "";
  if (hand.length > 0 && phase !== "end") {
    const cards = hand.map((c) => {
      const affordable = me.gold >= c.cost;
      const duplicate = me.builtDistricts.some((d) => d.name === c.name);
      const buildable = canBuild && affordable && !duplicate;
      const cs = colorStyle(c.colors);
      return `
        <div class="hand-card ${cs.cls}" style="${cs.style}">
          <div class="card-cost">${c.cost}</div>
          <div class="card-name-text">${tDistrict(c.name)}</div>
          ${buildable ? `<button class="btn btn-primary btn-build" data-build="${c.id}">${t("my.build")}</button>` : ""}
        </div>
      `;
    }).join("");
    handSection = `
      <div id="my-hand">
        <h3>${t("my.hand")}</h3>
        <div class="hand-cards">${cards}</div>
      </div>
    `;
  }

  // Actions
  let actionsSection = "";
  if (phase === "turns") {
    if (me.assassinated) {
      actionsSection = `<div id="my-actions"><p class="hint">💀 ${t("my.killed_skip")}</p></div>`;
    } else if (!myTurnNow) {
      actionsSection = `<div id="my-actions"><p class="hint">${t("my.waiting")}</p></div>`;
    } else {
      const buttons: string[] = [];

      if (!me.abilityUsed && me.hero) {
        const hasActiveAbility = [HeroId.Assassin, HeroId.Thief, HeroId.Sorcerer, HeroId.General].includes(me.hero);
        if (hasActiveAbility) {
          buttons.push(`<button class="btn btn-secondary" id="btn-ability">${heroPortraitSmall(me.hero)} ${t("my.ability")}</button>`);
        } else {
          buttons.push(`<button class="btn btn-secondary" id="btn-ability-passive">✓ ${t("my.passive")}</button>`);
        }
      }

      if (!me.incomeTaken) {
        buttons.push(`<button class="btn btn-gold" id="btn-gold">💰 ${t("my.gold_income")}</button>`);
        buttons.push(`<button class="btn btn-card" id="btn-draw">🃏 ${t("my.draw_card")}</button>`);
      }

      buttons.push(`<button class="btn btn-primary" id="btn-end">${t("my.end_turn")} ➡</button>`);
      actionsSection = `<div id="my-actions">${buttons.join("")}</div>`;
    }
  }

  el.innerHTML = heroRow + statsBar + districtsSection + handSection + actionsSection;

  // Animations
  if (lastAction === "build") {
    animateBuild();
    lastAction = null;
  } else if (lastAction === "income") {
    animateIncome();
    lastAction = null;
  }
  animateCardsAppear(".my-districts");
  animateMyBoard();

  // Wire up events
  el.querySelectorAll("[data-build]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cardId = (btn as HTMLElement).dataset.build!;
      dispatch({ type: "build", playerId: getMyId(), cardId });
    });
  });
  document.getElementById("btn-gold")?.addEventListener("click", () => {
    dispatch({ type: "income", playerId: getMyId(), choice: "gold" });
  });
  document.getElementById("btn-draw")?.addEventListener("click", () => {
    dispatch({ type: "income", playerId: getMyId(), choice: "card" });
  });
  document.getElementById("btn-end")?.addEventListener("click", () => {
    dispatch({ type: "end_turn", playerId: getMyId() });
  });
  document.getElementById("btn-ability")?.addEventListener("click", () => {
    showAbilityModal(me.hero!);
  });
  document.getElementById("btn-ability-passive")?.addEventListener("click", () => {
    dispatch({ type: "ability", playerId: getMyId(), ability: { hero: me.hero! } as AbilityPayload });
  });
}

function getAbilityDescription(heroId: HeroId): string {
  switch (heroId) {
    case HeroId.Assassin: return t("ability.assassin");
    case HeroId.Thief: return t("ability.thief");
    case HeroId.Sorcerer: return t("ability.sorcerer");
    case HeroId.King: return t("ability.king");
    case HeroId.Cleric: return t("ability.cleric");
    case HeroId.Merchant: return t("ability.merchant");
    case HeroId.Architect: return t("ability.architect");
    case HeroId.General: return t("ability.general");
    default: return "";
  }
}

function showAbilityModal(heroId: HeroId) {
  const modal = document.getElementById("ability-modal")!;
  const title = document.getElementById("modal-title")!;
  const options = document.getElementById("modal-options")!;
  modal.classList.add("show");

  const close = () => modal.classList.remove("show");
  modal.onclick = (e) => { if (e.target === modal) close(); };

  switch (heroId) {
    case HeroId.Assassin: {
      title.textContent = t("modal.assassin_title");
      const draft = getDraft();
      const faceUpBans = draft?.faceUpBans ?? [];
      // Exclude self and face-up banned heroes (known to not be in play)
      const targets = Object.values(HeroId).filter((h) =>
        h !== HeroId.Assassin && !faceUpBans.includes(h),
      );
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${t("modal.assassin_hint")}</p>
        ${targets.map((h) =>
          `<button class="modal-option" data-target="${h}">${heroPortrait(h, 24)} ${heroName(h)} <span style="color:#888;font-size:10px;">⚡${heroSpeed(h)}</span></button>`,
        ).join("")}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = (btn as HTMLElement).dataset.target as HeroId;
          dispatch({ type: "ability", playerId: getMyId(), ability: { hero: "assassin", targetHeroId: target } });
          close();
        });
      });
      break;
    }
    case HeroId.Thief: {
      title.textContent = t("modal.thief_title");
      const draft = getDraft();
      const faceUpBans = draft?.faceUpBans ?? [];
      // Exclude self, assassin, and face-up banned heroes
      const targets = Object.values(HeroId).filter((h) =>
        h !== HeroId.Thief && h !== HeroId.Assassin && !faceUpBans.includes(h),
      );
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${t("modal.thief_hint")}</p>
        ${targets.map((h) =>
          `<button class="modal-option" data-target="${h}">${heroPortrait(h, 24)} ${heroName(h)} <span style="color:#888;font-size:10px;">⚡${heroSpeed(h)}</span></button>`,
        ).join("")}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = (btn as HTMLElement).dataset.target as HeroId;
          dispatch({ type: "ability", playerId: getMyId(), ability: { hero: "thief", targetHeroId: target } });
          close();
        });
      });
      break;
    }
    case HeroId.Sorcerer: {
      title.textContent = t("modal.sorcerer_title");
      const players = getPlayers();
      const myIdx = getMyIndex();
      // Can swap with any living player (not assassinated, not self)
      const otherPlayers = players.filter((p, i) => i !== myIdx && !p.assassinated);
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${t("modal.sorcerer_hint")}</p>
        <button class="modal-option" data-mode="draw">${heroPortrait(HeroId.Sorcerer, 24)} ${t("modal.sorcerer_draw")}</button>
        ${otherPlayers.map((p) =>
          `<button class="modal-option" data-mode="swap" data-target="${p.id}">🔄 ${tName(p.name)} — ${p.hand ? p.hand.length : p.handSize} ${t("modal.sorcerer_cards")}</button>`,
        ).join("")}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const btnMode = (btn as HTMLElement).dataset.mode as "draw" | "swap";
          if (btnMode === "draw") {
            dispatch({ type: "ability", playerId: getMyId(), ability: { hero: "sorcerer", mode: "draw" } });
          } else {
            const targetId = (btn as HTMLElement).dataset.target!;
            dispatch({ type: "ability", playerId: getMyId(), ability: { hero: "sorcerer", mode: "swap", targetPlayerId: targetId } });
          }
          close();
        });
      });
      break;
    }
    case HeroId.General: {
      title.textContent = t("modal.general_title");
      const players = getPlayers();
      const me = players[getMyIndex()];
      const targets = players
        .filter((p, i) => i !== getMyIndex() && p.builtDistricts.length > 0 && p.hero !== HeroId.Cleric);
      if (targets.length === 0) {
        options.innerHTML = `<p class="hint">${t("modal.general_no_targets")}</p>`;
        break;
      }
      const targetButtons = targets.flatMap((p) => {
        const pIdx = players.indexOf(p);
        const revealed = isHeroRevealed(pIdx);
        const heroTag = revealed && p.hero ? ` (${heroName(p.hero)})` : "";
        return p.builtDistricts
          .filter((d) => me && d.cost <= me.gold)
          .map((d) =>
            `<button class="modal-option" data-target="${p.id}" data-card="${d.id}">
              💥 ${tDistrict(d.name)} (${d.cost}💰) ${t("modal.general_at")} ${tName(p.name)}${heroTag}
            </button>`,
          );
      });
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${t("modal.general_hint")}</p>
        ${targetButtons.join("") || `<p class="hint">${t("modal.general_no_gold")}</p>`}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = (btn as HTMLElement).dataset.target!;
          const cardId = (btn as HTMLElement).dataset.card!;
          dispatch({
            type: "ability",
            playerId: getMyId(),
            ability: { hero: "general", targetPlayerId: targetId, cardId },
          });
          close();
        });
      });
      break;
    }
    default:
      close();
  }
}

function renderLog() {
  const el = document.getElementById("game-log")!;
  if (!el) return;
  const entries = getLog().slice(-30);
  el.innerHTML = entries.map((e) =>
    `<div class="log-entry"><span class="day-tag">[${t("log.day")} ${e.day}]</span> ${tLog(e.message)}</div>`,
  ).join("");
  el.scrollTop = el.scrollHeight;
  animateLogEntry();
}

function renderBanList() {
  const el = document.getElementById("ban-list")!;
  if (!el) return;
  const phase = getPhase();
  const draft = getDraft();

  if ((phase === "turns" || phase === "end") && draft) {
    const bans = draft.faceUpBans.map((h) =>
      `<span class="ban-up">${heroPortraitSmall(h)} ${heroName(h)}</span>`,
    ).join(", ");
    el.innerHTML = `${t("ban.banned")}${bans} + ${draft.hiddenBanCount} ${t("ban.hidden")}`;
  } else {
    el.innerHTML = "";
  }
}

function renderWinner() {
  const overlay = document.getElementById("winner-overlay")!;
  const card = document.getElementById("winner-card")!;
  if (!overlay || !card) return;
  const phase = getPhase();
  const winner = getWinner();
  if (phase === "end" && winner !== null) {
    const players = getPlayers();
    overlay.classList.add("show");
    card.innerHTML = `🏆 ${tName(players[winner]?.name ?? "???")} ${t("winner.title")}!<br><button class="btn btn-primary" id="btn-to-menu" style="margin-top:10px;">← ${t("winner.to_menu")}</button>`;
    animateWinner();
    document.getElementById("btn-to-menu")?.addEventListener("click", () => {
      ws?.close();
      showMenu();
    });
  } else {
    overlay.classList.remove("show");
  }
}

// Start!
showMenu();
