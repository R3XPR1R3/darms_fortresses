import type { GameState, GameAction, AbilityPayload, PlayerState, MatchDeckBuild, BuildablePurpleId } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS, MAX_HAND_CARDS, CompanionId, COMPANIONS, isPassiveCompanion, PURPLE_CARD_TEMPLATES, DECK_BUILD_PURPLE_SIZE, DECK_BUILD_COMPANION_SIZE, ALL_PURPLE_SPECIAL, ALL_SPELLS, BOT_BUILDS } from "@darms/shared-types";
import { createRng, createMatch, createBaseDeck, processAction, startDraft, botAction, currentDrafter, currentPlayer } from "@darms/game-core";
import { HERO_ICONS, districtColorDot, heroColor, heroPortrait, heroPortraitLarge, heroPortraitSmall, heroPortraitUrl } from "./icons.js";
import { animateCardShatter, animateChanges, resetAnimState } from "./anim.js";
import { t, tHero, tDistrict, tLog, tName, tCompanionName, tCompanionDescription, getLang, setLang, KEYWORDS, kwHtml, expandKw, tSpellName, tSpellDesc, tPurpleName, tPurpleDesc, getGuideHtml } from "./i18n.js";

/** Get companion emoji for indicator circles */
function companionEmoji(id: CompanionId | null): string {
  if (!id) return "";
  const def = COMPANIONS.find((c) => c.id === id);
  return def?.emoji ?? "?";
}
/** Get companion definition */
function companionDef(id: CompanionId | null) {
  if (!id) return null;
  return COMPANIONS.find((c) => c.id === id) ?? null;
}
/** Build companion indicator HTML with optional custom color */
function companionIndicatorHtml(id: CompanionId, cssClass: string): string {
  const def = companionDef(id);
  const customStyle = def?.indicatorColor ? `background:${def.indicatorColor};` : "";
  return `<span class="companion-indicator ${cssClass}" style="${customStyle}">${companionEmoji(id)}</span>`;
}

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
  incomeOffer?: PlayerState["incomeOffer"];
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

interface DraftView {
  availableHeroes: HeroId[];
  faceUpBans: HeroId[];
  hiddenBanCount: number;
  draftOrder: number[];
  currentStep: number;
  draftPhase: "hero" | "companion";
  companionPool: CompanionId[] | null; // shared pool for sequential draft
}

interface LobbyPlayer {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  deckReady: boolean;
  buildLabel?: string;
}

// ---- Auth state ----
interface AuthUser {
  id: number;
  nickname: string;
  email: string | null;
  avatarUrl: string | null;
  gold: number;
  diamonds: number;
}

let authToken: string | null = localStorage.getItem("darms_token");
let authUser: AuthUser | null = null;
let googleClientId = "";
let guestMode = false;

async function fetchAuthConfig() {
  try {
    const res = await fetch("/auth/config");
    const data = await res.json();
    googleClientId = data.googleClientId ?? "";
  } catch { /* auth not available */ }
}

async function handleGoogleCredential(response: { credential: string }) {
  try {
    const res = await fetch("/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: response.credential }),
    });
    if (!res.ok) throw new Error("Auth failed");
    const data = await res.json();
    authToken = data.token;
    guestMode = false;
    authUser = {
      ...data.user,
      gold: Number(data.user?.gold ?? 0),
      diamonds: Number(data.user?.diamonds ?? 0),
    };
    localStorage.setItem("darms_token", data.token);
    renderMenu();
  } catch (e) {
    console.error("Google login error:", e);
  }
}

async function loadAuthUser() {
  if (!authToken) return;
  try {
    const res = await fetch("/auth/me", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) { authToken = null; localStorage.removeItem("darms_token"); return; }
    const user = await res.json();
    authUser = {
      ...user,
      gold: Number(user?.gold ?? 0),
      diamonds: Number(user?.diamonds ?? 0),
    };
  } catch { /* server not available */ }
}

function logout() {
  authToken = null;
  authUser = null;
  guestMode = false;
  localStorage.removeItem("darms_token");
  renderMenu();
}

async function changeNickname() {
  if (!authToken || !authUser) return;
  const newNick = prompt("Новый никнейм:", authUser.nickname);
  if (!newNick || newNick.trim().length === 0) return;
  try {
    await fetch("/auth/nickname", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nickname: newNick.trim() }),
    });
    authUser.nickname = newNick.trim();
    renderMenu();
  } catch { /* ignore */ }
}

// Expose callback for Google GSI
(window as any).handleGoogleCredential = handleGoogleCredential;

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
  const humanBuild = loadSavedBuild();
  // Pick 3 distinct random bot archetypes for local play.
  const shuffled = [...BOT_BUILDS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const botBuilds = shuffled.slice(0, 3);
  return [
    { id: HUMAN_ID, name: t("lobby.you"), build: humanBuild ?? undefined },
    { id: BOT_IDS[0], name: "Бот " + botBuilds[0].name, build: botBuilds[0].build },
    { id: BOT_IDS[1], name: "Бот " + botBuilds[1].name, build: botBuilds[1].build },
    { id: BOT_IDS[2], name: "Бот " + botBuilds[2].name, build: botBuilds[2].build },
  ];
}

let localState: GameState | null = null;
let onlineState: PlayerView | null = null;
let seenLogCount = 0;
let menuPanel: "none" | "store" | "campaign" | "treasury" = "none";
let treasuryTab: "resources" | "covers" | "cards" = "resources";

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

// ---- Init ----
function showMenu() {
  mode = "menu";
  localState = null;
  onlineState = null;
  seenLogCount = 0;
  stopDraftTimer();
  stopTurnTimer();
  myPlayerId = "";
  myRoomId = "";
  document.getElementById("winner-overlay")?.classList.remove("show");
  document.getElementById("ability-modal")?.classList.remove("show");
  renderMenu();
}

function startLocal() {
  mode = "local";
  resetAnimState();
  seenLogCount = 0;
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
function connectWS(playerName: string, roomId: string | null, reconnect = false) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const host = location.host; // includes port if non-standard
  ws = new WebSocket(`${protocol}//${host}/ws`);

  ws.onopen = () => {
    if (reconnect && myRoomId && myPlayerId) {
      ws!.send(JSON.stringify({ type: "reconnect_room", roomId: myRoomId, playerId: myPlayerId }));
      return;
    }
    if (roomId) {
      ws!.send(JSON.stringify({ type: "join_room", roomId, playerName, authToken: authToken ?? undefined }));
    } else {
      ws!.send(JSON.stringify({ type: "create_room", playerName, authToken: authToken ?? undefined }));
    }
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    if ((mode === "lobby" || mode === "online") && myRoomId && myPlayerId) {
      setTimeout(() => {
        if (mode === "lobby" || mode === "online") {
          connectWS("", myRoomId, true);
        }
      }, 1000);
      return;
    }
    if (mode === "lobby" || mode === "online") {
      showMenu();
    }
  };
}

/** If a saved deck-build exists locally, push it to the server immediately. */
function autoSendSavedBuild() {
  const saved = loadSavedBuild();
  if (!saved) return;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "set_deck_build", build: saved }));
  }
}

function handleServerMessage(msg: Record<string, unknown>) {
  switch (msg.type) {
    case "room_created":
      myRoomId = msg.roomId as string;
      myPlayerId = msg.playerId as string;
      isHost = true;
      lobbyPlayers = [{ id: myPlayerId, name: t("lobby.you"), isBot: false, isHost: true, deckReady: false }];
      autoSendSavedBuild();
      renderLobby();
      break;

    case "room_joined":
      myRoomId = msg.roomId as string;
      myPlayerId = msg.playerId as string;
      isHost = false;
      lobbyPlayers = msg.players as LobbyPlayer[];
      autoSendSavedBuild();
      renderLobby();
      break;

    case "room_reconnected":
      myRoomId = msg.roomId as string;
      myPlayerId = msg.playerId as string;
      lobbyPlayers = msg.players as LobbyPlayer[];
      if (mode !== "online") renderLobby();
      break;

    case "lobby_update":
      lobbyPlayers = msg.players as LobbyPlayer[];
      renderLobby();
      break;

    case "game_state":
      if (mode !== "online") resetAnimState();
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

  // Handle any bot with a pending purple placeholder offer (local-only).
  for (const bot of BOT_IDS) {
    const botIdx = localState.players.findIndex((p) => p.id === bot);
    if (botIdx === -1) continue;
    const offer = localState.players[botIdx].pendingPurpleOffer;
    if (offer && offer.length > 0) {
      const action = botAction(localState, bot);
      if (action) {
        const next = processAction(localState, action);
        if (next) {
          localState = next;
          render();
          setTimeout(runLocalBots, 500);
          return;
        }
      }
    }
  }

  // Determine if it's a bot's turn
  let botId: string | null = null;
  if (localState.phase === "draft") {
    // Both hero and companion drafts are sequential now
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
    const draft = localState.draft;
    // Both hero and companion drafts are sequential
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
    const humanIdx = localState.players.findIndex((pp) => pp.id === HUMAN_ID);
    return localState.players.map((p, i) => {
      const isMe = i === humanIdx;
      // Determine if hero is revealed using same logic as isHeroRevealed
      let revealed = isMe;
      if (localState!.phase === "end") revealed = true;
      else if (localState!.phase === "turns" && localState!.turnOrder) {
        const pos = localState!.turnOrder.indexOf(i);
        if (pos !== -1 && pos <= localState!.currentTurnIndex) revealed = true;
      }
      return {
        id: p.id,
        name: p.name,
        gold: p.gold,
        handSize: p.hand.length,
        hand: isMe ? p.hand : null,
        builtDistricts: p.builtDistricts,
        hero: revealed ? p.hero : null,
        incomeTaken: p.incomeTaken,
        incomeOffer: isMe ? (p.incomeOffer ?? null) : null,
        buildsRemaining: p.buildsRemaining,
        abilityUsed: p.abilityUsed,
        assassinated: revealed ? p.assassinated : false,
        robbedHeroId: p.robbedHeroId,
        finishedFirst: p.finishedFirst,
        companion: (isMe || revealed) ? p.companion : null,
        companionUsed: p.companionUsed,
        companionDisabled: p.companionDisabled,
        designerMarkedCardId: p.designerMarkedCardId,
      };
    });
  }
  return [];
}

function getCrownHolder(): number {
  if (mode === "online" && onlineState) return onlineState.crownHolder;
  if (localState) return localState.crownHolder;
  return 0;
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
      draftPhase: localState.draft.draftPhase,
      companionPool: localState.draft.companionChoices?.[0] ?? null,
    };
  }
  return null;
}

/** Returns the current player's pending purple placeholder offer, if any. */
function getPendingPurpleOffer(): any[] | null {
  if (mode === "online" && onlineState) return (onlineState as any).pendingPurpleOffer ?? null;
  if (localState) {
    const myIdx = localState.players.findIndex((p) => p.id === getMyId());
    if (myIdx === -1) return null;
    return localState.players[myIdx].pendingPurpleOffer ?? null;
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

/** Map building name → texture file (color_cost) */
function buildingTextureUrl(d: { colors: string[]; cost: number; spellAbility?: string }): string {
  if (d.spellAbility) return "/buildings/purple.png";
  const color = d.colors[0] ?? "purple";
  const key = `${color}_${d.cost}`;
  return `/buildings/${key}.png`;
}

function districtCardHtml(d: { colors: string[]; name: string; cost: number; hp?: number; spellAbility?: string; purpleAbility?: string; placeholder?: string }, opts: { info?: boolean } = {}): string {
  const cs = colorStyle(d.colors);
  const hpLabel = d.hp != null && d.hp !== d.cost ? `<div class="card-hp">HP ${d.hp}</div>` : "";
  const spellClass = d.spellAbility ? "spell-card" : "";
  const spellLabel = d.spellAbility ? `<div class="spell-badge">✦ ${kwHtml("spell")} ✦</div>` : "";
  const texUrl = buildingTextureUrl(d);
  const infoBtn = opts.info !== false
    ? `<button class="card-info-btn" data-card-info="${encodeCardPayload(d)}" title="Info">ℹ</button>`
    : "";
  return `<div class="district-card ${cs.cls} ${spellClass}" style="${cs.style}">
    <img class="card-texture" src="${texUrl}" alt="" />
    <div class="card-cost-badge">${d.cost}</div>
    ${spellLabel}
    <div class="card-name">${tDistrict(d.name)}</div>
    ${hpLabel}
    ${infoBtn}
  </div>`;
}

/** Encode a card reference for the info popover (JSON in a data attribute). */
function encodeCardPayload(c: { name: string; cost: number; colors: string[]; hp?: number; spellAbility?: string; purpleAbility?: string; placeholder?: string }): string {
  const payload = {
    name: c.name,
    cost: c.cost,
    colors: c.colors,
    hp: c.hp,
    spellAbility: c.spellAbility,
    purpleAbility: c.purpleAbility,
    placeholder: c.placeholder,
  };
  // Use base64 of JSON so quotes/braces don't break the attribute.
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodeCardPayload(encoded: string): { name: string; cost: number; colors: string[]; hp?: number; spellAbility?: string; purpleAbility?: string; placeholder?: string } | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    return null;
  }
}

/**
 * Open the card-info popover for a card. Works for purple buildings,
 * spells, placeholder stubs, and plain coloured districts.
 */
function showCardInfoPopover(card: { name: string; cost: number; colors: string[]; hp?: number; spellAbility?: string; purpleAbility?: string; placeholder?: string }) {
  let overlay = document.getElementById("card-info-popover");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "card-info-popover";
    document.body.appendChild(overlay);
  }

  // Resolve display label, description, emoji.
  let emoji = "🏠";
  let title = tDistrict(card.name);
  let desc = "";
  let extraTag = "";

  if (card.placeholder === "purple") {
    emoji = "🟣";
    title = tDistrict(card.name); // already i18n-aware
    desc = t("purple.placeholder_desc");
    extraTag = t("deck.placeholder") ?? "placeholder";
  } else if (card.purpleAbility) {
    const tpl = PURPLE_CARD_TEMPLATES.find((t) => t.ability === card.purpleAbility);
    emoji = tpl?.emoji ?? "🔮";
    title = tPurpleName(card.purpleAbility);
    desc = expandKw(tPurpleDesc(card.purpleAbility));
    extraTag = t("deck.building") ?? "building";
  } else if (card.spellAbility) {
    emoji = "✨";
    title = tSpellName(card.spellAbility);
    desc = expandKw(tSpellDesc(card.spellAbility));
    extraTag = t("pool.spells") ?? "spell";
  }

  const colorDots = card.colors.map((c) => districtColorDot(c)).join(" ");
  const hpLine = card.hp != null && card.hp !== card.cost
    ? `<div class="cip-line">❤️ HP: <b>${card.hp}</b> / ${card.cost}</div>`
    : "";

  overlay.innerHTML = `
    <div class="cip-backdrop"></div>
    <div class="cip-content" role="dialog" aria-modal="true">
      <button class="cip-close" title="Close">✕</button>
      <div class="cip-head">
        <div class="cip-emoji">${emoji}</div>
        <div class="cip-title">
          <div class="cip-name">${title}</div>
          <div class="cip-meta">${colorDots} &nbsp; ${card.cost}💰 ${extraTag ? `&nbsp; <span class="db-tag">${extraTag}</span>` : ""}</div>
        </div>
      </div>
      ${hpLine}
      ${desc ? `<div class="cip-desc">${desc}</div>` : `<div class="cip-desc cip-desc-muted">${t("info.plain_district") ?? "Обычный квартал — без особых эффектов."}</div>`}
    </div>
  `;
  overlay.classList.add("show");

  const close = () => overlay!.classList.remove("show");
  overlay.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t.classList.contains("cip-backdrop") || t.closest(".cip-close")) close();
  };
}

/** Global delegated handler — any click on [data-card-info] opens the info popover. */
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest<HTMLElement>("[data-card-info]");
  if (!btn) return;
  e.stopPropagation();
  e.preventDefault();
  const payload = btn.dataset.cardInfo;
  if (!payload) return;
  const card = decodeCardPayload(payload);
  if (card) showCardInfoPopover(card);
}, true);

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

  // Auth section
  let authHtml = "";
  if (authUser) {
    const avatar = authUser.avatarUrl
      ? `<img class="auth-avatar" src="${authUser.avatarUrl}" alt="" referrerpolicy="no-referrer"/>`
      : "";
    authHtml = `
      <div class="auth-bar">
        ${avatar}
        <span class="auth-nickname" id="auth-nickname" title="Сменить никнейм">${authUser.nickname}</span>
        <button class="auth-logout" id="auth-logout">выйти</button>
      </div>
    `;
  } else if (googleClientId && !guestMode) {
    authHtml = `
      <div id="google-signin-btn"></div>
      <button class="btn btn-secondary btn-small" id="btn-guest-login">${t("menu.guest_login")}</button>
    `;
  } else if (guestMode) {
    authHtml = `<div class="hint">${t("menu.guest_mode")}</div>`;
  }

  const defaultName = authUser?.nickname ?? t("menu.default_name");
  const menuGold = authUser?.gold ?? 0;
  const menuDiamonds = authUser?.diamonds ?? 0;

  const storePanel = `
    <div class="menu-feature-card">
      <div class="menu-feature-title">🛒 ${t("menu.store")}</div>
      <div class="menu-feature-text">${t("menu.store_empty")}</div>
    </div>
  `;
  const campaignPanel = `
    <div class="menu-feature-card">
      <div class="menu-feature-title">📖 ${t("menu.campaign")}</div>
      <div class="menu-feature-text">${t("menu.coming_soon")}</div>
    </div>
  `;
  const treasuryPanel = `
    <div class="menu-feature-card">
      <div class="menu-feature-title">🏦 ${t("menu.treasury")}</div>
      <div class="menu-tabs">
        <button class="btn btn-secondary btn-small menu-tab ${treasuryTab === "resources" ? "active" : ""}" data-treasury-tab="resources">${t("menu.treasury_resources")}</button>
        <button class="btn btn-secondary btn-small menu-tab ${treasuryTab === "covers" ? "active" : ""}" data-treasury-tab="covers">${t("menu.treasury_covers")}</button>
        <button class="btn btn-secondary btn-small menu-tab ${treasuryTab === "cards" ? "active" : ""}" data-treasury-tab="cards">${t("menu.treasury_cards")}</button>
      </div>
      <div class="menu-feature-text">${t("menu.empty")}</div>
    </div>
  `;
  const activePanelHtml =
    menuPanel === "store" ? storePanel
      : menuPanel === "campaign" ? campaignPanel
        : menuPanel === "treasury" ? treasuryPanel
          : "";

  const hasBuild = !!loadSavedBuild();
  const gateAttr = hasBuild ? "" : "disabled";
  const gateHint = hasBuild
    ? ""
    : `<div class="hint" style="color:#e8a030;margin:4px 0">⚠ ${t("menu.deck_required") ?? "Соберите колоду, чтобы играть"}</div>`;

  app.innerHTML = `
    <h1>⚔ Darms: Fortresses</h1>
    <div class="menu-screen">
      ${authHtml}
      <div class="menu-title">${t("menu.subtitle")}</div>
      <button class="btn btn-secondary btn-small" id="btn-lang">${t("lang.toggle")}</button>
      <div class="menu-resources">💰 ${t("menu.gold")}: <b>${menuGold}</b> &nbsp; ♦ ${t("menu.diamonds")}: <b>${menuDiamonds}</b></div>
      <input type="text" id="player-name" placeholder="${t("menu.name_placeholder")}" value="${defaultName}" class="menu-input" maxlength="20"/>
      <button class="btn ${hasBuild ? "btn-secondary" : "btn-primary"} btn-large" id="btn-deckbuilder-menu">🃏 ${hasBuild ? t("lobby.edit_deck") : t("lobby.build_deck")}</button>
      ${gateHint}
      <button class="btn btn-primary btn-large" id="btn-local" ${gateAttr}>🎮 ${t("menu.local")}</button>
      <button class="btn btn-secondary btn-large" id="btn-card-pool">📚 ${t("menu.card_pool")}</button>
      <button class="btn btn-secondary btn-large" id="btn-store">🛒 ${t("menu.store")}</button>
      <button class="btn btn-secondary btn-large" id="btn-campaign">📖 ${t("menu.campaign")}</button>
      <button class="btn btn-secondary btn-large" id="btn-treasury">🏦 ${t("menu.treasury")}</button>
      ${activePanelHtml ? `<div id="menu-feature-panel">${activePanelHtml}</div>` : ""}
      <div class="menu-divider">${t("menu.online_divider")}</div>
      <button class="btn btn-secondary btn-large" id="btn-create" ${gateAttr}>🌐 ${t("menu.create_room")}</button>
      <button class="btn btn-secondary btn-large" id="btn-join" ${gateAttr}>🔗 ${t("menu.join_room")}</button>
    </div>
  `;

  // Render Google Sign-In button
  if (!authUser && googleClientId && (window as any).google?.accounts?.id) {
    const g = (window as any).google.accounts.id;
    g.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
    });
    const btnContainer = document.getElementById("google-signin-btn");
    if (btnContainer) {
      g.renderButton(btnContainer, {
        theme: "filled_black",
        size: "medium",
        shape: "pill",
        text: "signin_with",
      });
    }
  }

  // Auth event listeners
  document.getElementById("auth-nickname")?.addEventListener("click", changeNickname);
  document.getElementById("auth-logout")?.addEventListener("click", logout);
  document.getElementById("btn-guest-login")?.addEventListener("click", () => {
    guestMode = true;
    renderMenu();
  });

  document.getElementById("btn-lang")!.addEventListener("click", () => {
    const next = getLang() === "en" ? "ru" : getLang() === "ru" ? "id" : "en";
    setLang(next);
    renderMenu();
  });
  document.getElementById("btn-local")!.addEventListener("click", startLocal);
  document.getElementById("btn-card-pool")!.addEventListener("click", showCardPoolModal);
  document.getElementById("btn-store")?.addEventListener("click", () => {
    menuPanel = "store";
    renderMenu();
  });
  document.getElementById("btn-campaign")?.addEventListener("click", () => {
    menuPanel = "campaign";
    renderMenu();
  });
  document.getElementById("btn-treasury")?.addEventListener("click", () => {
    menuPanel = "treasury";
    renderMenu();
  });
  document.querySelectorAll("[data-treasury-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = (btn as HTMLElement).dataset.treasuryTab as "resources" | "covers" | "cards";
      treasuryTab = tab;
      menuPanel = "treasury";
      renderMenu();
    });
  });
  document.getElementById("btn-create")!.addEventListener("click", () => showLobbyScreen("create"));
  document.getElementById("btn-join")!.addEventListener("click", () => showLobbyScreen("join"));
  document.getElementById("btn-deckbuilder-menu")?.addEventListener("click", () => openDeckBuilderModal());
}

// ---- Deck builder ----

const DECK_STORAGE_KEY = "darms_deck_build_v1";

/** Load the deck-build from localStorage, or null if none saved. */
function loadSavedBuild(): MatchDeckBuild | null {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed && Array.isArray(parsed.purple) && parsed.purple.length === DECK_BUILD_PURPLE_SIZE
      && Array.isArray(parsed.companions) && parsed.companions.length === DECK_BUILD_COMPANION_SIZE
      && new Set(parsed.companions).size === DECK_BUILD_COMPANION_SIZE
    ) {
      return parsed as MatchDeckBuild;
    }
  } catch { /* noop */ }
  return null;
}

function saveBuildLocal(build: MatchDeckBuild) {
  try { localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(build)); } catch { /* noop */ }
}

/** All 16 picks for the purple deck-build pool: 11 buildings + 5 spells.
 *  Names and descriptions come from the i18n layer (three-language canonical source). */
function getAllPurpleOptions(): Array<{ id: BuildablePurpleId; name: string; cost: number; emoji: string; desc: string; isSpell: boolean }> {
  const out: Array<{ id: BuildablePurpleId; name: string; cost: number; emoji: string; desc: string; isSpell: boolean }> = [];
  for (const p of ALL_PURPLE_SPECIAL) {
    out.push({ id: p.ability, name: tPurpleName(p.ability), cost: p.cost, emoji: p.emoji, desc: expandKw(tPurpleDesc(p.ability)), isSpell: false });
  }
  for (const s of ALL_SPELLS) {
    out.push({ id: s.ability, name: tSpellName(s.ability), cost: s.cost, emoji: "✨", desc: expandKw(tSpellDesc(s.ability)), isSpell: true });
  }
  return out;
}

function openDeckBuilderModal() {
  // Working draft — starts from previously saved build or an empty slate.
  const saved = loadSavedBuild();
  let draftPurple: (BuildablePurpleId | null)[] = Array(DECK_BUILD_PURPLE_SIZE).fill(null);
  let draftCompanions: (CompanionId | null)[] = Array(DECK_BUILD_COMPANION_SIZE).fill(null);
  if (saved) {
    for (let i = 0; i < DECK_BUILD_PURPLE_SIZE; i++) draftPurple[i] = saved.purple[i] ?? null;
    for (let i = 0; i < DECK_BUILD_COMPANION_SIZE; i++) draftCompanions[i] = saved.companions[i] ?? null;
  }

  // Create modal overlay.
  let overlay = document.getElementById("deck-builder-modal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "deck-builder-modal";
    document.body.appendChild(overlay);
  }
  overlay.classList.add("show");

  const close = () => {
    overlay!.classList.remove("show");
    // Menu gate reflects the saved build — re-render to refresh button states.
    if (mode === "menu") renderMenu();
    if (mode === "lobby") renderLobby();
  };

  const render = () => {
    const companions = COMPANIONS;
    const purples = getAllPurpleOptions();

    const purpleSlots = draftPurple.map((id, i) => {
      if (!id) return `<div class="db-slot db-slot-empty" data-purple-slot="${i}">+</div>`;
      const opt = purples.find((p) => p.id === id);
      return `<div class="db-slot db-slot-filled" data-purple-slot="${i}" title="${opt?.desc ?? ""}">
        <div style="font-size:20px">${opt?.emoji ?? "🔮"}</div>
        <div style="font-size:10px">${opt?.name ?? id}</div>
        <div class="db-slot-x">×</div>
      </div>`;
    }).join("");

    const compSlots = draftCompanions.map((id, i) => {
      if (!id) return `<div class="db-slot db-slot-empty" data-companion-slot="${i}">+</div>`;
      const def = companions.find((c) => c.id === id);
      return `<div class="db-slot db-slot-filled" data-companion-slot="${i}" title="${tCompanionDescription(id).replace(/\{kw:[^}]+\}/g, "")}">
        <div style="font-size:20px">${def?.emoji ?? "?"}</div>
        <div style="font-size:10px">${tCompanionName(id)}</div>
        <div class="db-slot-x">×</div>
      </div>`;
    }).join("");

    const purpleGrid = purples.map((p) => {
      const count = draftPurple.filter((x) => x === p.id).length;
      const disabled = draftPurple.every((x) => x !== null);
      const tag = p.isSpell ? `<span class="db-tag db-tag-spell">${t("pool.spells") ?? "спел"}</span>` : `<span class="db-tag">${t("deck.building") ?? "постройка"}</span>`;
      return `<button class="db-card ${p.isSpell ? "db-card-spell" : ""}" data-pick-purple="${p.id}" ${disabled ? "disabled" : ""}>
        <div class="db-card-head">
          <span class="db-card-emoji">${p.emoji}</span>
          <span class="db-card-cost">${p.cost}💰</span>
        </div>
        <div class="db-card-name">${p.name}</div>
        <div class="db-card-tags">${tag}</div>
        <div class="db-card-desc">${p.desc}</div>
        ${count > 0 ? `<span class="db-card-count">×${count}</span>` : ""}
      </button>`;
    }).join("");

    const compGrid = companions.map((c) => {
      const already = draftCompanions.includes(c.id);
      const slotsFull = draftCompanions.every((x) => x !== null);
      const disabled = already || slotsFull;
      const modeTag = `<span class="db-tag ${c.passive ? "db-tag-passive" : "db-tag-active"}">${c.passive ? t("companion.passive") : t("companion.active")}</span>`;
      const colorTag = c.heroColor ? `<span class="db-tag" style="color:${COLOR_HEX[c.heroColor] ?? "#888"}">${districtColorDot(c.heroColor)} ${t("companion.only_color")}</span>` : "";
      const desc = expandKw(tCompanionDescription(c.id));
      return `<button class="db-card ${already ? "db-card-used" : ""}" data-pick-companion="${c.id}" ${disabled ? "disabled" : ""}>
        <div class="db-card-head">
          <span class="db-card-emoji">${c.emoji}</span>
        </div>
        <div class="db-card-name">${tCompanionName(c.id)}</div>
        <div class="db-card-tags">${modeTag}${colorTag}</div>
        <div class="db-card-desc">${desc}</div>
      </button>`;
    }).join("");

    const purpleFilled = draftPurple.filter((x) => x !== null).length;
    const compFilled = draftCompanions.filter((x) => x !== null).length;
    const canSave = purpleFilled === DECK_BUILD_PURPLE_SIZE && compFilled === DECK_BUILD_COMPANION_SIZE;

    overlay!.innerHTML = `
      <div class="modal-content deck-builder-content">
        <div class="deck-builder-header">
          <h2>🃏 ${t("deck.title") ?? "Деклбилдинг"}</h2>
          <button class="db-close">✕</button>
        </div>
        <div class="deck-builder-body">
          <section class="db-section">
            <h3>⚔ ${t("deck.companions") ?? "Компаньоны"} (${compFilled}/${DECK_BUILD_COMPANION_SIZE}) <span class="db-hint">— ${t("deck.companions_hint") ?? "3 разных"}</span></h3>
            <div class="db-slot-row">${compSlots}</div>
            <div class="db-grid">${compGrid}</div>
          </section>
          <section class="db-section">
            <h3>🔮 ${t("deck.purple") ?? "Фиолетовые карты"} (${purpleFilled}/${DECK_BUILD_PURPLE_SIZE}) <span class="db-hint">— ${t("deck.purple_hint") ?? "повторы разрешены"}</span></h3>
            <div class="db-slot-row">${purpleSlots}</div>
            <div class="db-grid">${purpleGrid}</div>
          </section>
        </div>
        <div class="deck-builder-footer">
          <button class="btn btn-secondary" id="db-preset">⚙ ${t("deck.preset") ?? "Готовый билд"}</button>
          <button class="btn btn-secondary" id="db-clear">🗑 ${t("deck.clear") ?? "Очистить"}</button>
          <button class="btn btn-primary" id="db-save" ${canSave ? "" : "disabled"}>💾 ${t("deck.save") ?? "Сохранить"}</button>
        </div>
      </div>
    `;

    // Slot clicks (remove).
    overlay!.querySelectorAll("[data-purple-slot]").forEach((el) => {
      el.addEventListener("click", () => {
        const i = parseInt((el as HTMLElement).dataset.purpleSlot!, 10);
        draftPurple[i] = null;
        render();
      });
    });
    overlay!.querySelectorAll("[data-companion-slot]").forEach((el) => {
      el.addEventListener("click", () => {
        const i = parseInt((el as HTMLElement).dataset.companionSlot!, 10);
        draftCompanions[i] = null;
        render();
      });
    });

    // Pick clicks.
    overlay!.querySelectorAll<HTMLButtonElement>("[data-pick-purple]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const id = btn.dataset.pickPurple as BuildablePurpleId;
        const nextEmpty = draftPurple.findIndex((x) => x === null);
        if (nextEmpty === -1) return;
        draftPurple[nextEmpty] = id;
        render();
      });
    });
    overlay!.querySelectorAll<HTMLButtonElement>("[data-pick-companion]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const id = btn.dataset.pickCompanion as CompanionId;
        const nextEmpty = draftCompanions.findIndex((x) => x === null);
        if (nextEmpty === -1) return;
        draftCompanions[nextEmpty] = id;
        render();
      });
    });

    document.getElementById("db-clear")?.addEventListener("click", () => {
      draftPurple = Array(DECK_BUILD_PURPLE_SIZE).fill(null);
      draftCompanions = Array(DECK_BUILD_COMPANION_SIZE).fill(null);
      render();
    });

    document.getElementById("db-preset")?.addEventListener("click", () => {
      const archetype = BOT_BUILDS[Math.floor(Math.random() * BOT_BUILDS.length)];
      draftPurple = [...archetype.build.purple];
      draftCompanions = [...archetype.build.companions];
      render();
    });

    document.getElementById("db-save")?.addEventListener("click", () => {
      if (!canSave) return;
      const build: MatchDeckBuild = {
        purple: draftPurple.filter((x): x is BuildablePurpleId => x !== null),
        companions: draftCompanions.filter((x): x is CompanionId => x !== null),
      };
      saveBuildLocal(build);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "set_deck_build", build }));
      }
      close();
    });
  };

  render();
  // Delegated click handler — survives any inner re-renders and catches both
  // the backdrop click and the ✕ button click (anywhere inside .db-close).
  overlay!.onclick = (e) => {
    const target = e.target as HTMLElement;
    if (target === overlay) { close(); return; }
    if (target.closest(".db-close")) { close(); return; }
  };
}

function showCardPoolModal() {
  const modal = document.getElementById("card-pool-modal")!;
  const body = document.getElementById("card-pool-body")!;
  const close = () => modal.classList.remove("show");

  const deck = createBaseDeck();
  const districts = [...new Map(
    deck
      .filter((c) => !c.colors.includes("purple") && !c.spellAbility)
      .map((c) => [c.name, c]),
  ).values()].sort((a, b) => a.cost - b.cost || tDistrict(a.name).localeCompare(tDistrict(b.name)));

  const spells = [...new Map(
    deck
      .filter((c) => c.spellAbility)
      .map((c) => [c.spellAbility!, c]),
  ).values()];

  // ---- Cards tab ----
  const heroesHtml = HEROES
    .slice()
    .sort((a, b) => a.speed - b.speed)
    .map((h) => `
      <div class="pool-item">
        <div class="pool-item-title">${heroPortrait(h.id, 20)} ${heroName(h.id)} <span style="color:#888">⚡${h.speed}</span></div>
        <div class="pool-item-sub">${t("class." + h.id)} — ${expandKw(t("ability_desc." + h.id))}</div>
      </div>
    `).join("");

  const districtsHtml = districts
    .map((d) => `
      <div class="pool-item">
        <div class="pool-item-title">${tDistrict(d.name)} <span style="color:#e2b714">${d.cost}💰</span></div>
        <div class="pool-item-sub">${d.colors.map((c) => districtColorDot(c)).join(" ")}</div>
      </div>
    `).join("");

  const spellsHtml = spells
    .map((s) => `
      <div class="pool-item" style="border-color:#8e44ad">
        <div class="pool-item-title">✦ ${tSpellName(s.name)} <span style="color:#e2b714">${s.cost}💰</span></div>
        <div class="pool-item-sub">${expandKw(tSpellDesc(s.spellAbility!))}</div>
      </div>
    `).join("");

  const companionsHtml = COMPANIONS
    .map((c) => {
      const colorTag = c.heroColor ? ` <span style="color:${COLOR_HEX[c.heroColor] ?? "#888"};font-size:10px">${districtColorDot(c.heroColor)}</span>` : "";
      return `
      <div class="pool-item">
        <div class="pool-item-title">${c.emoji} ${tCompanionName(c.id, c.name)}${colorTag}</div>
        <div class="pool-item-sub">${expandKw(tCompanionDescription(c.id, c.description))}</div>
      </div>
    `;}).join("");

  const specialCompanionsHtml = "";

  const purpleHtml = PURPLE_CARD_TEMPLATES
    .slice()
    .sort((a, b) => a.cost - b.cost || tPurpleName(a.name).localeCompare(tPurpleName(b.name)))
    .map((p) => `
      <div class="pool-item" style="border-color:#9060e0">
        <div class="pool-item-title">${p.emoji} ${tPurpleName(p.name)} <span style="color:#e2b714">${p.cost}💰</span></div>
        <div class="pool-item-sub">${p.colors.map((c) => districtColorDot(c)).join(" ")} • ${expandKw(tPurpleDesc(p.ability))}</div>
      </div>
    `).join("");

  const cardsContent = `
    <div class="pool-section">
      <h4>${t("pool.heroes")}</h4>
      <div class="pool-grid">${heroesHtml}</div>
    </div>
    <div class="pool-section">
      <h4>${t("pool.districts")}</h4>
      <div class="pool-grid">${districtsHtml}</div>
    </div>
    <div class="pool-section">
      <h4>${t("pool.spells")}</h4>
      <div class="pool-grid">${spellsHtml}</div>
    </div>
    <div class="pool-section">
      <h4>${t("pool.companions")}</h4>
      <div class="pool-grid">${companionsHtml}</div>
    </div>
    <div class="pool-section">
      <h4>${t("pool.special_companions")}</h4>
      <div class="pool-grid">${specialCompanionsHtml}</div>
    </div>
    <div class="pool-section">
      <h4>${t("pool.purple")}</h4>
      <div class="pool-grid">${purpleHtml}</div>
    </div>
  `;

  // ---- Keywords tab ----
  const keywordsContent = `
    <div class="pool-section">
      <h4>${t("pool.keywords")}</h4>
      <div class="pool-grid keywords-grid">
        ${KEYWORDS.map((kw) => `
          <div class="pool-item kw-item">
            <div class="pool-item-title">${kwHtml(kw.id)}</div>
            <div class="pool-item-sub">${kw.description[getLang()] ?? kw.description.en}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  // ---- Guide tab ----
  const guideContent = `<div class="pool-section guide-content">${getGuideHtml()}</div>`;

  body.innerHTML = `
    <div class="pool-tabs">
      <button class="pool-tab active" data-tab="cards">${t("pool.tab.cards")}</button>
      <button class="pool-tab" data-tab="keywords">${t("pool.tab.keywords")}</button>
      <button class="pool-tab" data-tab="guide">${t("pool.tab.guide")}</button>
    </div>
    <div class="pool-tab-content" data-tab-content="cards">${cardsContent}</div>
    <div class="pool-tab-content" data-tab-content="keywords" style="display:none">${keywordsContent}</div>
    <div class="pool-tab-content" data-tab-content="guide" style="display:none">${guideContent}</div>
  `;

  // Tab switching
  body.querySelectorAll<HTMLButtonElement>(".pool-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      body.querySelectorAll<HTMLButtonElement>(".pool-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab!;
      body.querySelectorAll<HTMLElement>(".pool-tab-content").forEach((el) => {
        el.style.display = el.dataset.tabContent === tab ? "" : "none";
      });
    });
  });

  modal.classList.add("show");
  modal.onclick = (e) => { if (e.target === modal) close(); };
  document.getElementById("card-pool-close")!.textContent = t("pool.close");
  document.getElementById("card-pool-title")!.textContent = t("pool.title");
  document.getElementById("card-pool-close")!.onclick = close;
}

function renderLobby() {
  const app = document.getElementById("app")!;
  const playersList = lobbyPlayers.map((p) => {
    const deckBadge = p.deckReady
      ? `<span class="lobby-badge lobby-badge-ready">✅ ${t("lobby.deck_ready") ?? "колода готова"}</span>`
      : `<span class="lobby-badge lobby-badge-pending">⏳ ${t("lobby.deck_pending") ?? "колода не собрана"}</span>`;
    const buildLbl = p.isBot && p.buildLabel ? ` <span class="lobby-build-label">[${p.buildLabel}]</span>` : "";
    return `<div class="lobby-player ${p.isHost ? "host" : ""}">
      ${p.isBot ? "🤖" : "👤"} ${tName(p.name)}${buildLbl} ${p.isHost ? t("lobby.host") : ""}
      ${deckBadge}
    </div>`;
  }).join("");

  const myLobbyEntry = lobbyPlayers.find((p) => p.id === myPlayerId);
  const myDeckReady = !!myLobbyEntry?.deckReady;
  const allReady = lobbyPlayers.every((p) => p.deckReady);
  const enoughPlayers = lobbyPlayers.length >= 4;
  const canStart = isHost && enoughPlayers && allReady;

  let startHint = "";
  if (isHost) {
    if (!enoughPlayers) startHint = t("lobby.need_four") ?? "Нужно 4 игрока";
    else if (!allReady) startHint = t("lobby.wait_decks") ?? "Ждём пока все соберут колоду";
  }

  app.innerHTML = `
    <h1>⚔ Darms: Fortresses</h1>
    <div class="lobby-screen">
      <div class="room-code">${t("lobby.room_code")}<strong>${myRoomId}</strong></div>
      <div class="lobby-info">${t("lobby.share_code")}</div>
      <div class="lobby-players">${playersList}</div>
      <div class="lobby-count">${lobbyPlayers.length}/4 ${t("lobby.players_count")}</div>
      <div class="lobby-actions">
        <button class="btn ${myDeckReady ? "btn-secondary" : "btn-primary"}" id="btn-deckbuilder">
          ${myDeckReady ? `✏️ ${t("lobby.edit_deck") ?? "Изменить колоду"}` : `🃏 ${t("lobby.build_deck") ?? "Собрать колоду"}`}
        </button>
      </div>
      ${isHost ? `
        <div class="lobby-actions">
          <button class="btn btn-secondary" id="btn-add-bot">🤖 ${t("lobby.add_bot")}</button>
          <button class="btn btn-primary btn-large" id="btn-start" ${canStart ? "" : "disabled"}>▶ ${t("lobby.start_game")}</button>
        </div>
        ${startHint ? `<div class="lobby-info" style="color:#e8a030">${startHint}</div>` : ""}
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
  document.getElementById("btn-deckbuilder")?.addEventListener("click", () => {
    openDeckBuilderModal();
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

  const allLogs = getLog();
  if (allLogs.length < seenLogCount) seenLogCount = 0;
  const newEntries = allLogs.slice(seenLogCount);
  if (newEntries.some((e) => e.message.includes("рассыпались"))) {
    animateCardShatter();
  }
  seenLogCount = allLogs.length;

  // Diff-based animations: compare current state to previous, animate only changes
  const players = getPlayers();
  const myIdx = getMyIndex();
  const me = players[myIdx];
  const draft = getDraft();
  animateChanges({
    phase: getPhase(),
    activeIdx: getActiveIndex(),
    myDistrictCount: me?.builtDistricts.length ?? 0,
    myGold: me?.gold ?? 0,
    myHandSize: me?.hand ? me.hand.length : (me?.handSize ?? 0),
    oppIdx: selectedOpponentIndex,
    oppDistrictCount: selectedOpponentIndex !== null ? (players[selectedOpponentIndex]?.builtDistricts.length ?? 0) : 0,
    logCount: getLog().length,
    winner: getWinner(),
    draftStep: draft?.currentStep ?? -1,
  });
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
    const draft = getDraft();
    const isCompanionPhase = draft?.draftPhase === "companion";
    el.className = "turn-banner" + (myTurn || isCompanionPhase ? " my-turn" : "");
    el.id = "turn-banner";
    if (isCompanionPhase) {
      el.innerHTML = `⚔ ${t("banner.day")} ${day} — ${t("draft.companion_title")}`;
    } else {
      el.innerHTML = myTurn
        ? `⚔ ${t("banner.day")} ${day} — ${t("banner.your_pick")}`
        : `${t("banner.day")} ${day} — ${t("banner.hero_pick")}`;
    }
    return;
  }

  if (phase === "turns" && activeIdx !== null) {
    const activePlayer = players[activeIdx];
    const revealed = isHeroRevealed(activeIdx);
    el.className = "turn-banner" + (myTurn ? " my-turn" : "");
    el.id = "turn-banner";

    if (myTurn) {
      startTurnTimer(activeIdx);
      const timerCls = turnTimerRemaining <= 10 ? "turn-timer timer-urgent" : "turn-timer";
      const timerHtml = `<span id="turn-timer" class="${timerCls}">${turnTimerRemaining}s</span>`;
      const heroId = activePlayer?.hero;
      el.innerHTML = heroId
        ? `${heroPortraitSmall(heroId)} ${t("banner.your_turn")} — <span style="color:${heroColor(heroId)}">${heroName(heroId)}</span> ${timerHtml}`
        : `⚔ ${t("banner.your_turn")}! ${timerHtml}`;
    } else {
      stopTurnTimer();
      if (revealed && activePlayer?.hero) {
        el.innerHTML = `${heroPortraitSmall(activePlayer.hero)} ${t("banner.turn_of")}<span style="color:${heroColor(activePlayer.hero)}">${heroName(activePlayer.hero)}</span> (${tName(activePlayer.name)})`;
      } else {
        el.innerHTML = `⏳ ${t("banner.turn_of")}${tName(activePlayer?.name ?? "...")}`;
      }
    }
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

  if (phase !== "draft" && phase !== "turns" && phase !== "end") {
    el.innerHTML = "";
    return;
  }

  const opponents = players
    .map((p, i) => ({ player: p, index: i }))
    .filter((x) => x.index !== myIdx);

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
    const hColor = (revealed && p.hero) ? heroColor(p.hero) : "";

    if (revealed && p.hero) {
      label = heroName(p.hero);
      heroLine = `<span class="tab-hero">${heroPortraitSmall(p.hero)}</span>`;
    } else {
      label = tName(p.name);
      heroLine = `<span class="tab-sleep">💤</span>`;
    }

    const handCount = p.hand ? p.hand.length : p.handSize;
    const stats = `<span class="tab-stats">💰${p.gold} 🃏${handCount} 🏠${p.builtDistricts.length}/${WIN_DISTRICTS}</span>`;
    const arrow = isActive ? `<span class="active-arrow">▼</span>` : "";
    const tabStyle = hColor ? `style="--hero-clr:${hColor}"` : "";

    return `
      <button class="opp-tab ${selected ? "active" : ""} ${isActive ? "is-current-turn" : ""}" data-opp-idx="${i}" ${tabStyle}>
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

  // Hero display with tooltip
  let heroSection: string;
  if (revealed && p.hero) {
    const heroDef = HEROES.find((h) => h.id === p.hero);
    const hClr = heroColor(p.hero);
    heroSection = `
      <div class="opp-hero-display tooltip-host tooltip-below" style="--hero-clr:${hClr}">
        <div class="hero-icon-large" style="position:relative;display:inline-block">${heroPortrait(p.hero, 64)}${p.companion ? companionIndicatorHtml(p.companion, "companion-indicator-opp") : ""}</div>
        <div class="hero-name">${heroName(p.hero)}</div>
        <div class="hero-speed">${t("draft.speed")} ${heroDef?.speed ?? "?"}</div>
        <div class="tooltip-content" style="--hero-clr:${hClr}">
          <div class="tt-name">${heroName(p.hero)}</div>
          <div class="tt-class">${t("class." + p.hero)} — ⚡${heroDef?.speed ?? "?"}</div>
          <div class="tt-ability">${getAbilityDescription(p.hero)}</div>
          <div class="tt-desc">${t("ability_desc." + p.hero)}</div>
        </div>
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
  const isCrown = getCrownHolder() === selectedOpponentIndex;
  const statsBar = `
    <div class="opp-stats-bar">
      ${isCrown ? `<span>👑</span>` : ""}
      <span>💰 ${p.gold}</span>
      <span>🃏 ${p.hand ? p.hand.length : p.handSize}</span>
      <span>🏠 ${p.builtDistricts.length}/${WIN_DISTRICTS}</span>
      ${p.finishedFirst ? `<span>⭐ ${t("my.first")}</span>` : ""}
    </div>
  `;

  // Companion — always show name + short description so new players can read what the opponent has.
  const companionHtml = p.companion ? (() => {
    const def = companionDef(p.companion);
    const name = tCompanionName(p.companion, def?.name ?? p.companion);
    const desc = def ? expandKw(tCompanionDescription(p.companion, def.description)) : "";
    const passiveTag = def?.passive ? `<span class="opp-companion-tag">${t("my.passive")}</span>` : "";
    return `
      <div class="opp-companion">
        <div class="opp-companion-head">${companionEmoji(p.companion)} <b>${name}</b>${passiveTag}${p.companionDisabled ? " ❌" : ""}</div>
        <div class="opp-companion-desc">${desc}</div>
      </div>
    `;
  })() : "";

  // Districts
  const districts = p.builtDistricts.map((d) => districtCardHtml(d)).join("");
  const districtsSection = districts
    ? `<div class="opp-districts">${districts}</div>`
    : `<div class="opp-districts" style="color:#666;font-size:12px;">${t("opp.no_districts")}</div>`;

  const assassinated = p.assassinated
    ? `<div class="opp-assassinated">💀 ${t("opp.killed_today")}</div>`
    : "";

  el.innerHTML = heroSection + statsBar + companionHtml + districtsSection + assassinated;
}

function renderMyBoard() {
  const el = document.getElementById("my-board")!;
  if (!el) return;
  const phase = getPhase();
  const players = getPlayers();
  const me = players[getMyIndex()];
  if (!me) { el.innerHTML = ""; return; }

  if (phase === "setup") {
    el.innerHTML = "";
    return;
  }

  // During draft — show simplified board (stats + districts only, no hand/actions)
  if (phase === "draft") {
    const draftCrown = getCrownHolder() === getMyIndex();
    const draftStats = `
      <div class="my-stats-bar">
        ${draftCrown ? `<span>👑</span>` : ""}
        <span>💰 ${me.gold}</span>
        <span>🃏 ${me.hand ? me.hand.length : me.handSize}</span>
        <span>🏠 ${me.builtDistricts.length}/${WIN_DISTRICTS}</span>
      </div>
    `;
    const districts = me.builtDistricts.map((d) => districtCardHtml(d)).join("");
    const districtsSection = districts ? `<div class="my-districts">${districts}</div>` : "";
    el.innerHTML = draftStats + districtsSection;
    return;
  }

  const myTurnNow = isMyTurn();
  const hand = getMyHand();

  // My hero row with tooltip
  let heroRow = "";
  if (me.hero) {
    const heroDef = HEROES.find((h) => h.id === me.hero);
    const abilityTag = heroDef
      ? `<span class="my-hero-ability-tag">${getAbilityDescription(me.hero)}</span>`
      : "";
    const myHClr = heroColor(me.hero);
    heroRow = `
      <div class="my-hero-row tooltip-host tooltip-above" style="--hero-clr:${myHClr}">
        <div class="hero-icon-large" style="position:relative;display:inline-block">${heroPortrait(me.hero, 48)}${me.companion ? companionIndicatorHtml(me.companion, "companion-indicator-me") : ""}</div>
        <div class="my-hero-info">
          <div class="my-hero-name">${heroName(me.hero)}</div>
          <div class="my-hero-speed">${t("draft.speed")} ${heroDef?.speed ?? "?"}</div>
          ${abilityTag}
        </div>
        <div class="tooltip-content" style="--hero-clr:${myHClr}">
          <div class="tt-name">${heroName(me.hero)}</div>
          <div class="tt-class">${t("class." + me.hero)} — ⚡${heroDef?.speed ?? "?"}</div>
          <div class="tt-ability">${getAbilityDescription(me.hero)}</div>
          <div class="tt-desc">${t("ability_desc." + me.hero)}</div>
        </div>
      </div>
    `;
  }

  // Stats bar
  const myIsCrown = getCrownHolder() === getMyIndex();
  const statsBar = `
    <div class="my-stats-bar">
      ${myIsCrown ? `<span>👑</span>` : ""}
      <span>💰 ${me.gold}</span>
      <span>🃏 ${hand.length}</span>
      <span>🏠 ${me.builtDistricts.length}/${WIN_DISTRICTS}</span>
      ${me.finishedFirst ? `<span>⭐ ${t("my.first")}</span>` : ""}
    </div>
  `;

  // Companion section
  let companionHtml = "";
  if (me.companion) {
    const cDef = companionDef(me.companion);
    companionHtml = `
      <div class="my-companion">
        <span class="companion-name">${companionEmoji(me.companion)} ${tCompanionName(me.companion, cDef?.name ?? me.companion)}${me.companionDisabled ? " ❌" : ""}</span>
        <span style="font-size:9px;color:#888">${expandKw(tCompanionDescription(me.companion, cDef?.description ?? ""))}</span>
      </div>
    `;
  }

  // My districts — purple buildings with active abilities are clickable
  const activePurple = new Set(["cannon", "crypt", "tnt_storage", "cult"]);
  const districts = me.builtDistricts.map((d) => {
    const isClickable = myTurnNow && d.purpleAbility && activePurple.has(d.purpleAbility);
    const tpl = d.purpleAbility ? PURPLE_CARD_TEMPLATES.find((t) => t.ability === d.purpleAbility) : null;
    const clickClass = isClickable ? "purple-clickable" : "";
    const clickAttr = isClickable ? `data-activate="${d.id}"` : "";
    const tooltipHtml = tpl ? `<div class="purple-tooltip">${tpl.emoji} ${expandKw(tPurpleDesc(tpl.ability))}</div>` : "";
    return `<div class="district-wrapper ${clickClass}" ${clickAttr}>${districtCardHtml(d)}${tooltipHtml}</div>`;
  }).join("");
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
      const texUrl = buildingTextureUrl(c);
      const placeholderAction = c.placeholder === "purple" && myTurnNow && !getPendingPurpleOffer();
      const buildBtn = c.placeholder === "purple"
        ? (placeholderAction ? `<button class="btn btn-primary btn-build" data-build="${c.id}">🟣 ${t("my.play_placeholder") ?? "Разыграть"}</button>` : "")
        : (buildable ? `<button class="btn btn-primary btn-build" data-build="${c.id}">${t("my.build")}</button>` : "");
      return `
        <div class="hand-card ${cs.cls} ${c.placeholder === "purple" ? "placeholder-card" : ""}" style="${cs.style}">
          <img class="card-texture" src="${texUrl}" alt="" />
          <div class="card-cost">${c.cost}</div>
          <div class="card-name-text">${tDistrict(c.name)}</div>
          <button class="card-info-btn" data-card-info="${encodeCardPayload(c)}" title="Info">ℹ</button>
          ${buildBtn}
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

      if (!me.companionUsed && me.companion && !me.companionDisabled && !isPassiveCompanion(me.companion)) {
        const cDef = companionDef(me.companion);
        const costInfo = cDef?.useCost ? ` (${cDef.useCost}💰)` : "";
        buttons.push(`<button class="btn btn-secondary" id="btn-companion">${companionEmoji(me.companion)} ${tCompanionName(me.companion, cDef?.name ?? me.companion)}${costInfo}</button>`);
      }

      if (me.incomeOffer && me.incomeOffer.length > 0) {
        const offerCards = me.incomeOffer.map((c) => {
          const cs = colorStyle(c.colors);
          const texUrl = buildingTextureUrl(c);
          return `<div class="income-offer-card ${cs.cls}" style="${cs.style}" data-income-pick="${c.id}">
            <img class="card-texture" src="${texUrl}" alt="" />
            <div class="card-cost-badge">${c.cost}</div>
            <div class="card-name">${tDistrict(c.name)}</div>
            ${c.spellAbility ? `<div class="spell-badge">✦</div>` : ""}
          </div>`;
        }).join("");
        buttons.push(`
          <div class="income-offer-panel">
            <div class="hint">${t("my.income_pick_hint")}</div>
            <div class="income-offer-grid">${offerCards}</div>
          </div>
        `);
      } else if (!me.incomeTaken) {
        const handIsFull = hand.length >= MAX_HAND_CARDS;
        buttons.push(`<button class="btn btn-gold" id="btn-gold">💰 ${t("my.gold_income")}</button>`);
        buttons.push(`<button class="btn btn-card" id="btn-draw" ${handIsFull ? "disabled" : ""} title="${handIsFull ? "Лимит руки: 10 карт" : ""}">🃏 ${t("my.draw_card")}</button>`);
      }

      buttons.push(`<button class="btn btn-primary" id="btn-end">${t("my.end_turn")} ➡</button>`);
      actionsSection = `<div id="my-actions">${buttons.join("")}</div>`;
    }
  }

  el.innerHTML = heroRow + statsBar + companionHtml + districtsSection + handSection + actionsSection;

  // Wire up events — purple building activation
  el.querySelectorAll("[data-activate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cardId = (btn as HTMLElement).dataset.activate!;
      dispatch({ type: "activate_building", playerId: getMyId(), cardId });
    });
  });
  el.querySelectorAll("[data-build]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cardId = (btn as HTMLElement).dataset.build!;
      const me = getPlayers()[getMyIndex()];
      const card = me?.hand?.find((c: any) => c.id === cardId);
      // Placeholder cards use their own action (free, opens purple offer).
      if (card?.placeholder === "purple") {
        dispatch({ type: "purple_placeholder_play", playerId: getMyId(), cardId });
      } else {
        dispatch({ type: "build", playerId: getMyId(), cardId });
      }
    });
  });
  document.getElementById("btn-gold")?.addEventListener("click", () => {
    dispatch({ type: "income", playerId: getMyId(), choice: "gold" });
  });
  document.getElementById("btn-draw")?.addEventListener("click", () => {
    dispatch({ type: "income", playerId: getMyId(), choice: "card" });
  });
  el.querySelectorAll("[data-income-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cardId = (btn as HTMLElement).dataset.incomePick!;
      dispatch({ type: "income_pick", playerId: getMyId(), cardId });
    });
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
  document.getElementById("btn-companion")?.addEventListener("click", () => {
    const myCompanion = getPlayers()[getMyIndex()].companion;
    const cDef = companionDef(myCompanion);
    if (cDef?.targetType) {
      showCompanionModal(myCompanion!);
    } else {
      dispatch({ type: "use_companion", playerId: getMyId() });
    }
  });
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
      const currentDraft = getDraft();
      if (currentDraft && isMyTurn()) {
        if (currentDraft.draftPhase === "companion" && currentDraft.companionPool) {
          // Auto-pick eligible companion
          const me = getPlayers()[getMyIndex()];
          const myHeroClr = me?.hero ? (HEROES.find((h) => h.id === me.hero)?.color ?? null) : null;
          const eligible = currentDraft.companionPool.filter((cId) => {
            const def = companionDef(cId);
            return !def?.heroColor || def.heroColor === myHeroClr;
          });
          if (eligible.length > 0) {
            const companionId = eligible[Math.floor(Math.random() * eligible.length)];
            dispatch({ type: "companion_pick", playerId: getMyId(), companionId });
          } else {
            // No eligible — skip (personal pool exhausted)
            dispatch({ type: "companion_skip", playerId: getMyId() });
          }
        } else if (currentDraft.availableHeroes.length > 0) {
          // Auto-pick a random hero
          const randomIdx = Math.floor(Math.random() * currentDraft.availableHeroes.length);
          const heroId = currentDraft.availableHeroes[randomIdx];
          dispatch({ type: "draft_pick", playerId: getMyId(), heroId });
        }
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
      }
    }
    if (turnTimerRemaining <= 0) {
      stopTurnTimer();
      // Auto-act when timer expires
      const me = getPlayers()[getMyIndex()];
      if (me && !me.incomeTaken) {
        // Random income choice then end turn
        const choice = Math.random() < 0.5 ? "gold" : "card";
        dispatch({ type: "income", playerId: getMyId(), choice });
      }
      // End turn after random action
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

  // Pending purple placeholder offer — modal-style choice.
  const offer = getPendingPurpleOffer();
  if (offer && offer.length > 0) {
    const cardButtons = offer.map((card: any, idx: number) => {
      const tpl = PURPLE_CARD_TEMPLATES.find((t) => t.ability === card.purpleAbility);
      const desc = tpl?.description ?? (card.spellAbility ? `(${card.spellAbility})` : "");
      const emoji = tpl?.emoji ?? (card.spellAbility ? "✨" : "🔮");
      return `
        <button class="purple-card-offer" data-purple-offer-pick="${idx}">
          <div style="font-size:28px">${emoji}</div>
          <div style="font-weight:bold;font-size:13px">${card.name} (${card.cost}💰)</div>
          <div style="font-size:10px;color:#ccc;margin-top:4px">${desc}</div>
          <div style="margin-top:4px;font-size:10px;color:#888">${card.colors.map((c: string) => districtColorDot(c)).join(" ")}</div>
        </button>
      `;
    }).join("");
    el.innerHTML = `
      <h2 style="font-size:13px">🔮 ${t("purple.title")}</h2>
      <p class="hint">${t("purple.choose_one")}</p>
      <div class="purple-draft-grid">${cardButtons}</div>
    `;
    el.querySelectorAll("[data-purple-offer-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt((btn as HTMLElement).dataset.purpleOfferPick!, 10);
        dispatch({ type: "purple_placeholder_pick", playerId: getMyId(), offerIndex: idx });
      });
    });
    return;
  }

  if (phase !== "draft" && phase !== "turns") {
    el.innerHTML = "";
    stopDraftTimer();
    return;
  }

  // During turns phase, bans are rendered in #ban-list
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

  // --- Companion draft phase (sequential) ---
  if (draft.draftPhase === "companion") {
    const myTurnComp = isMyTurn();
    const pool = draft.companionPool;

    if (myTurnComp) {
      startDraftTimer(draft);
    } else {
      stopDraftTimer();
    }

    if (!myTurnComp || !pool) {
      const timerHtml = myTurnComp
        ? `<span id="draft-timer" class="draft-timer ${draftTimerRemaining <= 10 ? 'timer-urgent' : ''}">${draftTimerRemaining}s</span>`
        : "";
      el.innerHTML = `
        <h2 style="font-size:13px">${t("draft.companion_title")} ${timerHtml}</h2>
        <p class="hint">${t("draft.others_choosing")}</p>
      `;
      return;
    }

    const timerHtml = `<span id="draft-timer" class="draft-timer ${draftTimerRemaining <= 10 ? 'timer-urgent' : ''}">${draftTimerRemaining}s</span>`;

    // Deduplicate for display
    let unique = [...new Set(pool)];
    // Get my hero color for restriction check
    const me = getPlayers()[getMyIndex()];
    const myHero = me?.hero;
    const myHeroColor = myHero ? (HEROES.find((h) => h.id === myHero)?.color ?? null) : null;

    const hasEligibleBase = unique.some((cId) => {
      const def = companionDef(cId);
      return !(def?.heroColor && def.heroColor !== myHeroColor);
    });
    // No fallback companions any more — personal pool may be fully locked, in
    // which case the player sees a skip button (rendered below).
    const poolLocked = unique.length === 0 || !hasEligibleBase;

    const companionCards = unique.map((cId) => {
      const def = companionDef(cId);
      const passiveTag = def?.passive ? `<span style="font-size:8px;color:#aaa">${t("companion.passive")}</span>` : "";
      // Check hero color restriction
      const restricted = def?.heroColor && def.heroColor !== myHeroColor;
      const disabledClass = restricted ? "companion-card-disabled" : "";
      const disabledAttr = restricted ? "disabled" : "";
      return `
        <button class="companion-card ${disabledClass}" data-companion="${restricted ? "" : cId}" ${disabledAttr}>
          <div class="companion-card-portrait">${def?.emoji ?? "?"}</div>
          <div class="companion-card-body">
            <div class="companion-card-name">${def ? tCompanionName(cId, def.name) : cId} ${passiveTag}</div>
            <div class="companion-card-desc">${def ? expandKw(tCompanionDescription(cId, def.description)) : ""}</div>
            ${restricted ? `<div style="font-size:8px;color:#e04050">⛔ ${t("companion.only_color")} ${def.heroColor === "yellow" ? "🟡" : def.heroColor === "blue" ? "🔵" : def.heroColor === "green" ? "🟢" : "🔴"}</div>` : ""}
          </div>
        </button>`;
    }).join("");

    // Pad to 4 slots with empty placeholders
    const emptySlots = Math.max(0, 4 - unique.length);
    let emptyHtml = "";
    for (let i = 0; i < emptySlots; i++) {
      emptyHtml += `<div class="companion-card companion-card-empty"></div>`;
    }

    const skipBtn = poolLocked
      ? `<button class="btn btn-secondary" id="btn-companion-skip" style="margin-top:8px">➖ ${t("draft.skip_companion") ?? "Пропустить выбор"}</button>`
      : "";

    el.innerHTML = `
      <h2 style="font-size:13px">${t("draft.companion_title")} ${timerHtml}</h2>
      <p class="hint">${t("draft.choose_companion")}</p>
      <div class="companion-draft-grid">${companionCards}${emptyHtml}</div>
      ${skipBtn}
    `;

    el.querySelectorAll(".companion-card[data-companion]").forEach((btn) => {
      btn.addEventListener("click", () => {
        stopDraftTimer();
        const companionId = (btn as HTMLElement).dataset.companion as CompanionId;
        dispatch({ type: "companion_pick", playerId: getMyId(), companionId });
      });
    });
    document.getElementById("btn-companion-skip")?.addEventListener("click", () => {
      stopDraftTimer();
      dispatch({ type: "companion_skip", playerId: getMyId() });
    });
    return;
  }

  // --- Hero draft phase ---
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
    heroButtons = draft.availableHeroes.map((h) => {
      const hColor = heroColor(h);
      const colorTag = HEROES.find((hd) => hd.id === h)?.color;
      const colorDot = colorTag ? `<span class="hero-card-color-dot" style="background:${COLOR_HEX[colorTag] ?? '#888'}"></span>` : "";
      return `
      <button class="hero-card" data-hero="${h}" style="--hero-clr:${hColor}">
        <div class="hero-card-portrait">
          <img src="${heroPortraitUrl(h)}" alt="${h}" />
        </div>
        <div class="hero-card-body">
          <div class="hero-card-class">${t("class." + h)} ${colorDot}</div>
          <div class="hero-card-name">${heroName(h)}</div>
          <div class="hero-card-speed">⚡ ${heroSpeed(h)}</div>
          <div class="hero-card-ability">${t("ability." + h)}</div>
          <div class="hero-card-desc">${t("ability_desc." + h)}</div>
        </div>
      </button>`;
    }).join("");
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
    el.querySelectorAll(".hero-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        stopDraftTimer();
        const heroId = (btn as HTMLElement).dataset.hero as HeroId;
        dispatch({ type: "draft_pick", playerId: getMyId(), heroId });
      });
    });
  }
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

function showCompanionModal(companionId: CompanionId) {
  const modal = document.getElementById("ability-modal")!;
  const title = document.getElementById("modal-title")!;
  const options = document.getElementById("modal-options")!;
  modal.classList.add("show");

  const close = () => modal.classList.remove("show");
  modal.onclick = (e) => { if (e.target === modal) close(); };

  const cDef = companionDef(companionId);
  const companionLabel = cDef ? tCompanionName(companionId, cDef.name) : companionId;
  const companionHint = cDef ? expandKw(tCompanionDescription(companionId, cDef.description)) : "";
  const players = getPlayers();
  const myIdx = getMyIndex();
  const me = players[myIdx];

  switch (companionId) {
    case CompanionId.Hunter: {
      title.textContent = `🏹 ${companionLabel}`;
      const targets = players.filter((_p, i) => i !== myIdx && !_p.assassinated);
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${targets.map((p) => {
          const revealed = isHeroRevealed(players.indexOf(p));
          const heroTag = revealed && p.hero ? ` ${heroPortraitSmall(p.hero)}` : "";
          return `<button class="modal-option" data-target="${p.id}">${heroTag} ${tName(p.name)} (🃏${p.hand ? p.hand.length : p.handSize})</button>`;
        }).join("")}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = (btn as HTMLElement).dataset.target!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetPlayerId: targetId });
          close();
        });
      });
      break;
    }

    case CompanionId.Saboteur: {
      title.textContent = `💣 ${companionLabel}`;
      const targets = players.filter((_p, i) => i !== myIdx && _p.companion && !_p.companionDisabled);
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${targets.length > 0 ? targets.map((p) => {
          const cName = p.companion ? tCompanionName(p.companion, companionDef(p.companion)?.name ?? "") : "";
          return `<button class="modal-option" data-target="${p.id}">${tName(p.name)} — ${companionEmoji(p.companion)} ${cName}</button>`;
        }).join("") : `<p class="hint">${t("companion_modal.no_valid_targets")}</p>`}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = (btn as HTMLElement).dataset.target!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetPlayerId: targetId });
          close();
        });
      });
      break;
    }

    case CompanionId.Bard: {
      title.textContent = `🎵 ${companionLabel}`;
      const targets = players.filter((_p, i) => i !== myIdx && _p.companion && !isHeroRevealed(i));
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${targets.length > 0 ? targets.map((p) => {
          const cName = p.companion ? tCompanionName(p.companion, companionDef(p.companion)?.name ?? "") : "";
          return `<button class="modal-option" data-target="${p.id}">${tName(p.name)} — ${companionEmoji(p.companion)} ${cName}</button>`;
        }).join("") : `<p class="hint">${t("companion_modal.no_valid_targets")}</p>`}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = (btn as HTMLElement).dataset.target!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetPlayerId: targetId });
          close();
        });
      });
      break;
    }

    case CompanionId.Blacksmith: {
      title.textContent = `⚒️ ${companionLabel}`;
      const allDistricts = players.flatMap((p, i) =>
        p.builtDistricts.map((d) => ({ card: d, player: p, playerIdx: i }))
      );
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${allDistricts.map((item) =>
          `<button class="modal-option" data-target-player="${item.player.id}" data-target-card="${item.card.id}">
            ${tDistrict(item.card.name)} (${item.card.cost}💰) — ${tName(item.player.name)}
          </button>`
        ).join("")}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetPlayerId = (btn as HTMLElement).dataset.targetPlayer!;
          const targetCardId = (btn as HTMLElement).dataset.targetCard!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetPlayerId, targetCardId });
          close();
        });
      });
      break;
    }

    case CompanionId.Alchemist: {
      title.textContent = `⚗️ ${companionLabel}`;
      const upgradeable = me.builtDistricts.filter((d) => d.cost < 5);
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${upgradeable.length > 0 ? upgradeable.map((d) =>
          `<button class="modal-option" data-target-card="${d.id}">${tDistrict(d.name)} (${d.cost}💰 → ${d.cost + 1}💰)</button>`
        ).join("") : `<p class="hint">${t("companion_modal.no_upgrade")}</p>`}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetCardId = (btn as HTMLElement).dataset.targetCard!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetCardId });
          close();
        });
      });
      break;
    }

    case CompanionId.Cannoneer: {
      title.textContent = `💥 ${companionLabel}`;
      const hand = getMyHand().filter((c) => c.name !== "🔥 Пламя");
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${hand.length > 0 ? hand.map((c) =>
          `<button class="modal-option" data-target-card="${c.id}">${tDistrict(c.name)} (${c.cost}💰)</button>`
        ).join("") : `<p class="hint">${t("companion_modal.no_cards")}</p>`}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetCardId = (btn as HTMLElement).dataset.targetCard!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetCardId });
          close();
        });
      });
      break;
    }

    case CompanionId.StrangeMerchant: {
      title.textContent = `🧳 ${companionLabel}`;
      const hand = getMyHand();
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${hand.length > 0 ? hand.map((c) =>
          `<button class="modal-option" data-target-card="${c.id}">${tDistrict(c.name)} (${c.cost}💰)</button>`
        ).join("") : `<p class="hint">${t("companion_modal.no_cards")}</p>`}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetCardId = (btn as HTMLElement).dataset.targetCard!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetCardId });
          close();
        });
      });
      break;
    }

    case CompanionId.Pyromancer: {
      title.textContent = `🔥 ${companionLabel}`;
      const hand = getMyHand().filter((c) => c.name !== "🔥 Пламя");
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${hand.length > 0 ? hand.map((c) =>
          `<button class="modal-option" data-target-card="${c.id}">${tDistrict(c.name)} (${c.cost}💰)</button>`
        ).join("") : `<p class="hint">${t("companion_modal.no_cards")}</p>`}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetCardId = (btn as HTMLElement).dataset.targetCard!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetCardId });
          close();
        });
      });
      break;
    }

    case CompanionId.UnluckyMage: {
      title.textContent = `💫 ${companionLabel}`;
      const hand = getMyHand();
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${hand.length > 0 ? hand.map((c) =>
          `<button class="modal-option" data-target-card="${c.id}">${tDistrict(c.name)} (${c.cost}💰)</button>`
        ).join("") : `<p class="hint">${t("companion_modal.no_cards")}</p>`}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetCardId = (btn as HTMLElement).dataset.targetCard!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetCardId });
          close();
        });
      });
      break;
    }

    case CompanionId.Sniper: {
      title.textContent = `🎯 ${companionLabel}`;
      const targets = players.filter((_p, i) => i !== myIdx && _p.companion);
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${targets.length > 0 ? targets.map((p) => {
          const cName = p.companion ? tCompanionName(p.companion, companionDef(p.companion)?.name ?? "") : "";
          return `<button class="modal-option" data-target="${p.id}">${tName(p.name)} — ${companionEmoji(p.companion)} ${cName}</button>`;
        }).join("") : `<p class="hint">${t("companion_modal.no_valid_targets")}</p>`}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = (btn as HTMLElement).dataset.target!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetPlayerId: targetId });
          close();
        });
      });
      break;
    }

    case CompanionId.Designer: {
      title.textContent = `📐 ${companionLabel}`;
      const ownDistricts = me.builtDistricts;
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${ownDistricts.length > 0 ? ownDistricts.map((d) =>
          `<button class="modal-option" data-target-card="${d.id}">${tDistrict(d.name)} (${d.cost}💰)</button>`
        ).join("") : `<p class="hint">${t("companion_modal.no_districts")}</p>`}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetCardId = (btn as HTMLElement).dataset.targetCard!;
          dispatch({ type: "use_companion", playerId: getMyId(), targetCardId });
          close();
        });
      });
      break;
    }

    case CompanionId.Contractor: {
      title.textContent = `📋 ${companionLabel}`;
      const draft = getDraft();
      const faceUpBans = draft?.faceUpBans ?? [];
      // Exclude face-up bans, Assassin, and already-revealed heroes (already acted).
      const revealedHeroes = new Set(
        players
          .map((p, i) => (isHeroRevealed(i) ? p.hero : null))
          .filter((h): h is HeroId => h !== null),
      );
      const targets = Object.values(HeroId).filter((h) =>
        h !== HeroId.Assassin && !faceUpBans.includes(h) && !revealedHeroes.has(h),
      );
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${targets.map((h) =>
          `<button class="modal-option" data-target="${h}">${heroPortrait(h, 24)} ${heroName(h)} <span style="color:#888;font-size:10px;">⚡${heroSpeed(h)}</span></button>`,
        ).join("")}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = (btn as HTMLElement).dataset.target as HeroId;
          dispatch({ type: "use_companion", playerId: getMyId(), targetHeroId: target });
          close();
        });
      });
      break;
    }

    case CompanionId.NightShadow: {
      title.textContent = `🌑 ${companionLabel}`;
      const draft = getDraft();
      const faceUpBans = draft?.faceUpBans ?? [];
      const myHero = me.hero;
      const revealedHeroes = new Set(
        players
          .map((p, i) => (isHeroRevealed(i) ? p.hero : null))
          .filter((h): h is HeroId => h !== null),
      );
      // Exclude self hero, already revealed heroes and face-up bans
      const targets = Object.values(HeroId).filter((h) =>
        h !== myHero && !faceUpBans.includes(h) && !revealedHeroes.has(h),
      );
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${companionHint}</p>
        ${targets.map((h) =>
          `<button class="modal-option" data-target="${h}">${heroPortrait(h, 24)} ${heroName(h)} <span style="color:#888;font-size:10px;">⚡${heroSpeed(h)}</span></button>`,
        ).join("")}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = (btn as HTMLElement).dataset.target as HeroId;
          dispatch({ type: "use_companion", playerId: getMyId(), targetHeroId: target });
          close();
        });
      });
      break;
    }

    default:
      // No targeting needed (Farmer, Innkeeper, Peacemaker, etc.)
      dispatch({ type: "use_companion", playerId: getMyId() });
      close();
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
      const players = getPlayers();
      const revealedHeroes = new Set(
        players
          .map((p, i) => (isHeroRevealed(i) ? p.hero : null))
          .filter((h): h is HeroId => h !== null),
      );
      // Exclude self, revealed heroes and face-up banned heroes (known to not be in play)
      const targets = Object.values(HeroId).filter((h) =>
        h !== HeroId.Assassin && !faceUpBans.includes(h) && !revealedHeroes.has(h),
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
      // Can swap with any player (including assassinated, not self)
      const otherPlayers = players.filter((_p, i) => i !== myIdx);
      options.innerHTML = `
        <p class="hint" style="margin-bottom:8px;">${t("modal.sorcerer_hint")}</p>
        <button class="modal-option" data-mode="draw">${heroPortrait(HeroId.Sorcerer, 24)} ${t("modal.sorcerer_draw")}</button>
        ${otherPlayers.map((p) => {
          const pIdx = players.indexOf(p);
          const revealed = isHeroRevealed(pIdx);
          const heroTag = revealed && p.hero
            ? `${heroPortrait(p.hero, 20)} <span style="color:${heroColor(p.hero)}">${heroName(p.hero)}</span>`
            : "❓";
          return `<button class="modal-option" data-mode="swap" data-target="${p.id}">${heroTag} ${tName(p.name)} — ${p.hand ? p.hand.length : p.handSize} ${t("modal.sorcerer_cards")}</button>`;
        }).join("")}
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
      // Target any player except self and Cleric (Cleric's districts are immune)
      const targets = players
        .filter((p, i) => i !== getMyIndex() && p.builtDistricts.length > 0 && p.hero !== HeroId.Cleric);
      if (targets.length === 0) {
        options.innerHTML = `<p class="hint">${t("modal.general_no_targets")}</p>`;
        break;
      }
      const targetButtons = targets.flatMap((p) => {
        const pIdx = players.indexOf(p);
        const revealed = isHeroRevealed(pIdx);
        const heroTag = revealed && p.hero
          ? ` ${heroPortrait(p.hero, 16)} <span style="color:${heroColor(p.hero)}">${heroName(p.hero)}</span>`
          : "";
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
    document.getElementById("btn-to-menu")?.addEventListener("click", () => {
      ws?.close();
      showMenu();
    });
  } else {
    overlay.classList.remove("show");
  }
}

// Start! Load auth config, then show menu.
(async () => {
  await fetchAuthConfig();
  await loadAuthUser();
  showMenu();
})();
