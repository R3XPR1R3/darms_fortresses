import type { GameState, GameAction, AbilityPayload, PlayerState } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS } from "@darms/shared-types";
import { createRng, createMatch, createBaseDeck, processAction, startDraft, botAction, currentDrafter, currentPlayer } from "@darms/game-core";
import { HERO_ICONS, heroIconLarge, districtColorDot } from "./icons.js";

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
const LOCAL_PLAYERS = [
  { id: HUMAN_ID, name: "Ты" },
  { id: BOT_IDS[0], name: "Бот Алиса" },
  { id: BOT_IDS[1], name: "Бот Борис" },
  { id: BOT_IDS[2], name: "Бот Вика" },
];

let localState: GameState | null = null;
let onlineState: PlayerView | null = null;

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
  localState = createMatch(LOCAL_PLAYERS, deck, rng);
  localState = startDraft(localState);
  render();
}

function showLobbyScreen(action: "create" | "join") {
  const app = document.getElementById("app")!;
  const playerName = (document.getElementById("player-name") as HTMLInputElement)?.value?.trim() || "Игрок";

  if (action === "create") {
    connectWS(playerName, null);
  } else {
    const roomInput = prompt("Введи код комнаты:");
    if (!roomInput) return;
    connectWS(playerName, roomInput.toUpperCase().trim());
  }

  mode = "lobby";
  app.innerHTML = `
    <h1>⚔ Darms: Fortresses</h1>
    <div class="phase-label">Подключение...</div>
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
      lobbyPlayers = [{ id: myPlayerId, name: "Ты", isBot: false, isHost: true }];
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

function runLocalBots() {
  if (!localState || localState.phase === "end") return;

  let acted = true;
  let safety = 50;
  while (acted && safety-- > 0) {
    acted = false;
    if (localState.phase === "end") break;

    if (localState.phase === "draft") {
      const dIdx = currentDrafter(localState);
      if (dIdx !== null && localState.players[dIdx].id !== HUMAN_ID) {
        const action = botAction(localState, localState.players[dIdx].id);
        if (action) {
          const next = processAction(localState, action);
          if (next) { localState = next; acted = true; }
        }
      }
    }

    if (localState.phase === "turns") {
      const pIdx = currentPlayer(localState);
      if (pIdx !== null && localState.players[pIdx].id !== HUMAN_ID) {
        const action = botAction(localState, localState.players[pIdx].id);
        if (action) {
          const next = processAction(localState, action);
          if (next) { localState = next; acted = true; }
        }
      }
    }

    if (localState.phase === "draft" && !localState.draft) {
      localState = startDraft(localState);
      acted = true;
    }
  }

  render();

  if (localState.phase !== "end") {
    const isHumanTurn = checkLocalHumanTurn();
    if (!isHumanTurn) {
      setTimeout(runLocalBots, 300);
    }
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
  return HEROES.find((h) => h.id === id)?.name ?? id;
}

function heroSpeed(id: HeroId): number {
  return HEROES.find((h) => h.id === id)?.speed ?? 0;
}

function heroIcon(id: HeroId | string): string {
  return HERO_ICONS[id] ?? "";
}

function colorClass(colors: string[]): string {
  if (colors.length > 1) return "color-multi";
  return `color-${colors[0]}`;
}

// ---- Rendering ----
function renderMenu() {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <h1>⚔ Darms: Fortresses</h1>
    <div class="menu-screen">
      <div class="menu-title">Карточная стратегия</div>
      <input type="text" id="player-name" placeholder="Твоё имя" value="Игрок" class="menu-input" maxlength="20"/>
      <button class="btn btn-primary btn-large" id="btn-local">🎮 Локальная игра (с ботами)</button>
      <div class="menu-divider">— онлайн —</div>
      <button class="btn btn-secondary btn-large" id="btn-create">🌐 Создать комнату</button>
      <button class="btn btn-secondary btn-large" id="btn-join">🔗 Войти по коду</button>
    </div>
  `;

  document.getElementById("btn-local")!.addEventListener("click", startLocal);
  document.getElementById("btn-create")!.addEventListener("click", () => showLobbyScreen("create"));
  document.getElementById("btn-join")!.addEventListener("click", () => showLobbyScreen("join"));
}

function renderLobby() {
  const app = document.getElementById("app")!;
  const playersList = lobbyPlayers.map((p) =>
    `<div class="lobby-player ${p.isHost ? "host" : ""}">
      ${p.isBot ? "🤖" : "👤"} ${p.name} ${p.isHost ? "(хост)" : ""}
    </div>`
  ).join("");

  app.innerHTML = `
    <h1>⚔ Darms: Fortresses</h1>
    <div class="lobby-screen">
      <div class="room-code">Код комнаты: <strong>${myRoomId}</strong></div>
      <div class="lobby-info">Отправь код друзьям для подключения</div>
      <div class="lobby-players">${playersList}</div>
      <div class="lobby-count">${lobbyPlayers.length}/6 игроков (мин. 4)</div>
      ${isHost ? `
        <div class="lobby-actions">
          <button class="btn btn-secondary" id="btn-add-bot">🤖 Добавить бота</button>
          <button class="btn btn-primary btn-large" id="btn-start" ${lobbyPlayers.length < 4 ? "disabled" : ""}>▶ Начать игру</button>
        </div>
      ` : '<div class="lobby-info">Ожидаем запуска хостом...</div>'}
      <button class="btn btn-secondary" id="btn-back-menu" style="margin-top:12px;">← Назад</button>
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

function render() {
  if (mode === "menu") { renderMenu(); return; }
  if (mode === "lobby") { renderLobby(); return; }
  renderPhaseLabel();
  renderPlayers();
  renderDraft();
  renderHand();
  renderActions();
  renderLog();
  renderWinner();
}

function renderPhaseLabel() {
  const el = document.getElementById("phase-label")!;
  if (!el) return;
  const phase = getPhase();
  const day = getDay();
  const labels: Record<string, string> = {
    setup: "Подготовка...",
    draft: `День ${day} — Выбор героя`,
    turns: `День ${day} — Ходы`,
    end: "Игра окончена",
  };
  el.textContent = labels[phase] || phase;
}

function renderPlayers() {
  const el = document.getElementById("players-area")!;
  if (!el) return;
  const players = getPlayers();
  const activeIdx = getActiveIndex();

  el.innerHTML = players.map((p, i) => {
    const isActive = i === activeIdx;
    const isMe = i === getMyIndex();
    const heroId = p.hero;
    const heroDisplay = heroId
      ? `<span class="hero-badge">${heroIcon(heroId)} ${heroName(heroId)} <span class="speed-badge">${heroSpeed(heroId)}</span></span>`
      : "—";
    const districts = p.builtDistricts.map(
      (d) => `<span class="district-chip ${colorClass(d.colors)}">${d.colors.map(c => districtColorDot(c)).join("")} ${d.name} (${d.cost})</span>`,
    ).join("");

    return `
      <div class="player-card ${isActive ? "active" : ""} ${isMe ? "me" : ""}">
        <div class="player-header">
          <span class="name">${isMe ? "👤" : "🤖"} ${p.name} ${p.finishedFirst ? "⭐" : ""}</span>
          ${p.assassinated ? '<span class="status-dead">💀</span>' : ""}
        </div>
        <div class="hero-line">${heroDisplay}</div>
        <div class="stats">
          💰 ${p.gold} | 🃏 ${p.hand ? p.hand.length : p.handSize} | 🏠 ${p.builtDistricts.length}/${WIN_DISTRICTS}
        </div>
        ${districts ? `<div class="districts">${districts}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderDraft() {
  const el = document.getElementById("draft-area")!;
  if (!el) return;
  const phase = getPhase();
  const draft = getDraft();

  if (phase !== "draft" || !draft) {
    el.innerHTML = "";
    return;
  }

  const myTurn = isMyTurn();

  const bans = draft.faceUpBans.map((h) =>
    `<span class="ban-up">${heroIcon(h)} ${heroName(h)}</span>`,
  ).join(", ");

  let heroButtons = "";
  if (myTurn) {
    heroButtons = draft.availableHeroes.map((h) => `
      <button class="hero-btn" data-hero="${h}">
        <div class="hero-btn-icon">${heroIconLarge(h)}</div>
        <div class="hero-btn-name">${heroName(h)}</div>
        <div class="speed">Скорость ${heroSpeed(h)}</div>
      </button>
    `).join("");
  }

  el.innerHTML = `
    <h2>Драфт героев</h2>
    <div class="bans">Забанены: ${bans} + ${draft.hiddenBanCount} скрытых</div>
    ${myTurn ? '<p class="hint">Выбери героя:</p>' : '<p class="hint">Другие игроки выбирают...</p>'}
    <div class="draft-heroes">${heroButtons}</div>
  `;

  if (myTurn) {
    el.querySelectorAll(".hero-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const heroId = (btn as HTMLElement).dataset.hero as HeroId;
        dispatch({ type: "draft_pick", playerId: getMyId(), heroId });
      });
    });
  }
}

function renderHand() {
  const area = document.getElementById("hand-area")!;
  const cardsEl = document.getElementById("hand-cards")!;
  if (!area || !cardsEl) return;
  const hand = getMyHand();
  const phase = getPhase();

  if (hand.length === 0 || phase === "end") {
    area.style.display = "none";
    return;
  }
  area.style.display = "block";

  const players = getPlayers();
  const me = players[getMyIndex()];
  const myTurnNow = isMyTurn();
  const canBuild = myTurnNow && me && me.buildsRemaining > 0 && me.incomeTaken;

  cardsEl.innerHTML = hand.map((c) => {
    const affordable = me && me.gold >= c.cost;
    const duplicate = me && me.builtDistricts.some((d) => d.name === c.name);
    const buildable = canBuild && affordable && !duplicate;
    return `
      <div class="hand-card ${colorClass(c.colors)}">
        <span class="card-colors">${c.colors.map(col => districtColorDot(col)).join("")}</span>
        <span class="card-cost">${c.cost}</span> ${c.name}
        ${buildable ? `<button class="btn btn-primary btn-build" data-build="${c.id}">Строить</button>` : ""}
      </div>
    `;
  }).join("");

  cardsEl.querySelectorAll("[data-build]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cardId = (btn as HTMLElement).dataset.build!;
      dispatch({ type: "build", playerId: getMyId(), cardId });
    });
  });
}

function renderActions() {
  const el = document.getElementById("actions")!;
  if (!el) return;
  const phase = getPhase();

  if (phase !== "turns") {
    el.innerHTML = "";
    return;
  }

  if (!isMyTurn()) {
    el.innerHTML = '<p class="hint">Ждём ход других игроков...</p>';
    return;
  }

  const players = getPlayers();
  const me = players[getMyIndex()];
  if (!me) return;
  const buttons: string[] = [];

  // Ability
  if (!me.abilityUsed && me.hero) {
    const hasActiveAbility = [HeroId.Assassin, HeroId.Thief, HeroId.Sorcerer, HeroId.General].includes(me.hero);
    if (hasActiveAbility) {
      buttons.push(`<button class="btn btn-secondary" id="btn-ability">${heroIcon(me.hero)} Способность</button>`);
    } else {
      buttons.push(`<button class="btn btn-secondary" id="btn-ability-passive">✓ Пассивка</button>`);
    }
  }

  // Income
  if (!me.incomeTaken) {
    buttons.push(`<button class="btn btn-gold" id="btn-gold">💰 +1 Золото</button>`);
    buttons.push(`<button class="btn btn-card" id="btn-draw">🃏 Взять карту</button>`);
  }

  // End turn
  buttons.push(`<button class="btn btn-primary" id="btn-end">Завершить ход ➡</button>`);

  el.innerHTML = buttons.join("");

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

function showAbilityModal(heroId: HeroId) {
  const modal = document.getElementById("ability-modal")!;
  const title = document.getElementById("modal-title")!;
  const options = document.getElementById("modal-options")!;
  modal.classList.add("show");

  const close = () => modal.classList.remove("show");
  modal.onclick = (e) => { if (e.target === modal) close(); };

  switch (heroId) {
    case HeroId.Assassin: {
      title.textContent = "Кого убить?";
      const targets = Object.values(HeroId).filter((h) => h !== HeroId.Assassin);
      options.innerHTML = targets.map((h) =>
        `<button class="modal-option" data-target="${h}">${heroIcon(h)} ${heroName(h)}</button>`,
      ).join("");
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
      title.textContent = "Кого обокрасть?";
      const targets = Object.values(HeroId).filter((h) => h !== HeroId.Thief && h !== HeroId.Assassin);
      options.innerHTML = targets.map((h) =>
        `<button class="modal-option" data-target="${h}">${heroIcon(h)} ${heroName(h)}</button>`,
      ).join("");
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
      title.textContent = "Способность Чародея";
      const players = getPlayers();
      const myIdx = getMyIndex();
      const otherPlayers = players.filter((_, i) => i !== myIdx);
      options.innerHTML = `
        <button class="modal-option" data-mode="draw">${heroIcon(HeroId.Sorcerer)} Взять 2 карты</button>
        ${otherPlayers.map((p) =>
          `<button class="modal-option" data-mode="swap" data-target="${p.id}">🔄 Обмен с ${p.name} (${p.hand ? p.hand.length : p.handSize} карт)</button>`,
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
      title.textContent = "Чей квартал разрушить?";
      const players = getPlayers();
      const me = players[getMyIndex()];
      const targets = players
        .filter((p, i) => i !== getMyIndex() && p.builtDistricts.length > 0 && p.hero !== HeroId.Cleric);
      if (targets.length === 0) {
        options.innerHTML = '<p class="hint">Нет доступных целей</p>';
        break;
      }
      options.innerHTML = targets.flatMap((p) =>
        p.builtDistricts
          .filter((d) => me && d.cost <= me.gold)
          .map((d) =>
            `<button class="modal-option" data-target="${p.id}" data-card="${d.id}">
              💥 ${d.name} (${d.cost}💰) у ${p.name}
            </button>`,
          ),
      ).join("") || '<p class="hint">Не хватает золота</p>';
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
  const el = document.getElementById("log")!;
  if (!el) return;
  const entries = getLog().slice(-30);
  el.innerHTML = entries.map((e) =>
    `<div class="log-entry"><span class="day-tag">[День ${e.day}]</span> ${e.message}</div>`,
  ).join("");
  el.scrollTop = el.scrollHeight;
}

function renderWinner() {
  const el = document.getElementById("winner-banner")!;
  if (!el) return;
  const phase = getPhase();
  const winner = getWinner();
  if (phase === "end" && winner !== null) {
    const players = getPlayers();
    el.classList.add("show");
    el.innerHTML = `🏆 Победил ${players[winner]?.name ?? "???"}!<br><button class="btn btn-primary" id="btn-to-menu" style="margin-top:10px;">← В меню</button>`;
    document.getElementById("btn-to-menu")?.addEventListener("click", () => {
      ws?.close();
      showMenu();
    });
  } else {
    el.classList.remove("show");
  }
}

// Start!
showMenu();
