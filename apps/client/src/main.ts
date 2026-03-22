import type { GameState, GameAction, AbilityPayload } from "@darms/shared-types";
import { HeroId, HEROES, WIN_DISTRICTS } from "@darms/shared-types";
import { createRng, createMatch, createBaseDeck, processAction, startDraft, botAction, currentDrafter, currentPlayer } from "@darms/game-core";

const HUMAN_ID = "human";
const BOT_IDS = ["bot-1", "bot-2", "bot-3"];

const PLAYERS = [
  { id: HUMAN_ID, name: "Ты" },
  { id: BOT_IDS[0], name: "Бот Алиса" },
  { id: BOT_IDS[1], name: "Бот Борис" },
  { id: BOT_IDS[2], name: "Бот Вика" },
];

let state: GameState;

function init() {
  const seed = Date.now();
  const rng = createRng(seed);
  const deck = createBaseDeck();
  state = createMatch(PLAYERS, deck, rng);
  state = startDraft(state);
  render();
}

function dispatch(action: GameAction) {
  const next = processAction(state, action);
  if (!next) {
    console.warn("Invalid action:", action);
    return;
  }
  state = next;
  render();

  // Auto-play bots
  setTimeout(runBots, 300);
}

function runBots() {
  let acted = true;
  let safety = 50;
  while (acted && safety-- > 0) {
    acted = false;
    if (state.phase === "end") break;

    if (state.phase === "draft") {
      const dIdx = currentDrafter(state);
      if (dIdx !== null && state.players[dIdx].id !== HUMAN_ID) {
        const action = botAction(state, state.players[dIdx].id);
        if (action) {
          const next = processAction(state, action);
          if (next) { state = next; acted = true; }
        }
      }
    }

    if (state.phase === "turns") {
      const pIdx = currentPlayer(state);
      if (pIdx !== null && state.players[pIdx].id !== HUMAN_ID) {
        const action = botAction(state, state.players[pIdx].id);
        if (action) {
          const next = processAction(state, action);
          if (next) { state = next; acted = true; }
        }
      }
    }

    // If draft ended and new day starts, start new draft
    if (state.phase === "draft" && !state.draft) {
      state = startDraft(state);
      acted = true;
    }
  }

  render();

  // If it's still a bot's turn (e.g. after phase change), keep going
  if (state.phase !== "end") {
    const isHumanTurn = checkHumanTurn();
    if (!isHumanTurn) {
      setTimeout(runBots, 300);
    }
  }
}

function checkHumanTurn(): boolean {
  if (state.phase === "draft") {
    const dIdx = currentDrafter(state);
    return dIdx !== null && state.players[dIdx].id === HUMAN_ID;
  }
  if (state.phase === "turns") {
    const pIdx = currentPlayer(state);
    return pIdx !== null && state.players[pIdx].id === HUMAN_ID;
  }
  return false;
}

// ---- Rendering ----

function heroName(id: HeroId): string {
  return HEROES.find((h) => h.id === id)?.name ?? id;
}

function heroSpeed(id: HeroId): number {
  return HEROES.find((h) => h.id === id)?.speed ?? 0;
}

function colorClass(colors: string[]): string {
  if (colors.length > 1) return "color-multi";
  return `color-${colors[0]}`;
}

function render() {
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
  const labels: Record<string, string> = {
    setup: "Подготовка...",
    draft: `День ${state.day} — Выбор героя`,
    turns: `День ${state.day} — Ходы`,
    end: "Игра окончена",
  };
  el.textContent = labels[state.phase] || state.phase;
}

function renderPlayers() {
  const el = document.getElementById("players-area")!;
  const activeIdx = state.phase === "turns" ? currentPlayer(state) : currentDrafter(state);

  el.innerHTML = state.players.map((p, i) => {
    const isActive = i === activeIdx;
    const hero = p.hero ? `${heroName(p.hero)} [${heroSpeed(p.hero)}]` : "—";
    const districts = p.builtDistricts.map(
      (d) => `<span class="district-chip ${colorClass(d.colors)}">${d.name} (${d.cost})</span>`,
    ).join("");

    return `
      <div class="player-card ${isActive ? "active" : ""}">
        <div class="name">${p.name} ${p.id === HUMAN_ID ? "👤" : "🤖"} ${p.finishedFirst ? "⭐" : ""}</div>
        <div class="hero">${hero} ${p.assassinated ? "💀" : ""}</div>
        <div class="stats">
          💰 ${p.gold} | 🃏 ${p.hand.length} | 🏠 ${p.builtDistricts.length}/${WIN_DISTRICTS}
        </div>
        ${districts ? `<div class="districts">${districts}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderDraft() {
  const el = document.getElementById("draft-area")!;
  if (state.phase !== "draft" || !state.draft) {
    el.innerHTML = "";
    return;
  }

  const dIdx = currentDrafter(state);
  const isHuman = dIdx !== null && state.players[dIdx].id === HUMAN_ID;

  const bans = state.draft.faceUpBans.map((h) =>
    `<span class="ban-up">${heroName(h)}</span>`,
  ).join(", ");
  const hiddenBans = state.draft.faceDownBans.length;

  let heroButtons = "";
  if (isHuman) {
    heroButtons = state.draft.availableHeroes.map((h) => `
      <button class="hero-btn" data-hero="${h}">
        ${heroName(h)}<br><span class="speed">Скорость ${heroSpeed(h)}</span>
      </button>
    `).join("");
  }

  el.innerHTML = `
    <h2>Драфт героев</h2>
    <div class="bans">Забанены: ${bans} + ${hiddenBans} скрытых</div>
    ${isHuman ? '<p style="font-size:12px;margin:6px 0;color:#aaa;">Выбери героя:</p>' : '<p style="font-size:12px;color:#aaa;">Боты выбирают...</p>'}
    <div class="draft-heroes">${heroButtons}</div>
  `;

  if (isHuman) {
    el.querySelectorAll(".hero-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const heroId = (btn as HTMLElement).dataset.hero as HeroId;
        dispatch({ type: "draft_pick", playerId: HUMAN_ID, heroId });
      });
    });
  }
}

function renderHand() {
  const area = document.getElementById("hand-area")!;
  const cardsEl = document.getElementById("hand-cards")!;
  const human = state.players.find((p) => p.id === HUMAN_ID)!;

  if (human.hand.length === 0 || state.phase === "end") {
    area.style.display = "none";
    return;
  }
  area.style.display = "block";

  const pIdx = currentPlayer(state);
  const isMyTurn = pIdx !== null && state.players[pIdx].id === HUMAN_ID;
  const canBuild = isMyTurn && human.buildsRemaining > 0 && human.incomeTaken;

  cardsEl.innerHTML = human.hand.map((c) => {
    const affordable = human.gold >= c.cost;
    const duplicate = human.builtDistricts.some((d) => d.name === c.name);
    const buildable = canBuild && affordable && !duplicate;
    return `
      <div class="hand-card ${colorClass(c.colors)} ${buildable ? "" : ""}">
        <span class="card-cost">${c.cost}</span> ${c.name}
        ${buildable ? `<button class="btn btn-primary" style="font-size:10px;padding:2px 6px;margin-left:4px;" data-build="${c.id}">Строить</button>` : ""}
      </div>
    `;
  }).join("");

  cardsEl.querySelectorAll("[data-build]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cardId = (btn as HTMLElement).dataset.build!;
      dispatch({ type: "build", playerId: HUMAN_ID, cardId });
    });
  });
}

function renderActions() {
  const el = document.getElementById("actions")!;
  if (state.phase !== "turns") {
    el.innerHTML = "";
    return;
  }

  const pIdx = currentPlayer(state);
  if (pIdx === null || state.players[pIdx].id !== HUMAN_ID) {
    el.innerHTML = '<p style="font-size:12px;color:#aaa;">Ждём ход ботов...</p>';
    return;
  }

  const player = state.players[pIdx];
  const buttons: string[] = [];

  // Ability
  if (!player.abilityUsed && player.hero) {
    const hasActiveAbility = [HeroId.Assassin, HeroId.Thief, HeroId.Sorcerer, HeroId.General].includes(player.hero);
    if (hasActiveAbility) {
      buttons.push(`<button class="btn btn-secondary" id="btn-ability">🎯 Способность</button>`);
    } else {
      // Auto-use passive
      buttons.push(`<button class="btn btn-secondary" id="btn-ability-passive">✓ Пассивка</button>`);
    }
  }

  // Income
  if (!player.incomeTaken) {
    buttons.push(`<button class="btn btn-gold" id="btn-gold">💰 +1 Золото</button>`);
    buttons.push(`<button class="btn btn-card" id="btn-draw">🃏 Взять карту</button>`);
  }

  // End turn
  buttons.push(`<button class="btn btn-primary" id="btn-end">Завершить ход ➡</button>`);

  el.innerHTML = buttons.join("");

  document.getElementById("btn-gold")?.addEventListener("click", () => {
    dispatch({ type: "income", playerId: HUMAN_ID, choice: "gold" });
  });
  document.getElementById("btn-draw")?.addEventListener("click", () => {
    dispatch({ type: "income", playerId: HUMAN_ID, choice: "card" });
  });
  document.getElementById("btn-end")?.addEventListener("click", () => {
    dispatch({ type: "end_turn", playerId: HUMAN_ID });
  });
  document.getElementById("btn-ability")?.addEventListener("click", () => {
    showAbilityModal(player.hero!);
  });
  document.getElementById("btn-ability-passive")?.addEventListener("click", () => {
    dispatch({ type: "ability", playerId: HUMAN_ID, ability: { hero: player.hero! } as AbilityPayload });
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
        `<button class="modal-option" data-target="${h}">${heroName(h)}</button>`,
      ).join("");
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = (btn as HTMLElement).dataset.target as HeroId;
          dispatch({ type: "ability", playerId: HUMAN_ID, ability: { hero: "assassin", targetHeroId: target } });
          close();
        });
      });
      break;
    }
    case HeroId.Thief: {
      title.textContent = "Кого обокрасть?";
      const targets = Object.values(HeroId).filter((h) => h !== HeroId.Thief && h !== HeroId.Assassin);
      options.innerHTML = targets.map((h) =>
        `<button class="modal-option" data-target="${h}">${heroName(h)}</button>`,
      ).join("");
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const target = (btn as HTMLElement).dataset.target as HeroId;
          dispatch({ type: "ability", playerId: HUMAN_ID, ability: { hero: "thief", targetHeroId: target } });
          close();
        });
      });
      break;
    }
    case HeroId.Sorcerer: {
      title.textContent = "Способность Чародея";
      const otherPlayers = state.players.filter((p) => p.id !== HUMAN_ID);
      options.innerHTML = `
        <button class="modal-option" data-mode="draw">📥 Взять 2 карты</button>
        ${otherPlayers.map((p) =>
          `<button class="modal-option" data-mode="swap" data-target="${p.id}">🔄 Обмен с ${p.name} (${p.hand.length} карт)</button>`,
        ).join("")}
      `;
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const mode = (btn as HTMLElement).dataset.mode as "draw" | "swap";
          if (mode === "draw") {
            dispatch({ type: "ability", playerId: HUMAN_ID, ability: { hero: "sorcerer", mode: "draw" } });
          } else {
            const targetId = (btn as HTMLElement).dataset.target!;
            dispatch({ type: "ability", playerId: HUMAN_ID, ability: { hero: "sorcerer", mode: "swap", targetPlayerId: targetId } });
          }
          close();
        });
      });
      break;
    }
    case HeroId.General: {
      title.textContent = "Чей квартал разрушить?";
      const human = state.players.find((p) => p.id === HUMAN_ID)!;
      const targets = state.players
        .filter((p) => p.id !== HUMAN_ID && p.builtDistricts.length > 0 && p.hero !== HeroId.Cleric);
      if (targets.length === 0) {
        options.innerHTML = '<p style="color:#aaa;">Нет доступных целей</p>';
        break;
      }
      options.innerHTML = targets.flatMap((p) =>
        p.builtDistricts
          .filter((d) => d.cost <= human.gold)
          .map((d) =>
            `<button class="modal-option" data-target="${p.id}" data-card="${d.id}">
              💥 ${d.name} (${d.cost}💰) у ${p.name}
            </button>`,
          ),
      ).join("") || '<p style="color:#aaa;">Не хватает золота</p>';
      options.querySelectorAll(".modal-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = (btn as HTMLElement).dataset.target!;
          const cardId = (btn as HTMLElement).dataset.card!;
          dispatch({
            type: "ability",
            playerId: HUMAN_ID,
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
  const entries = state.log.slice(-30);
  el.innerHTML = entries.map((e) =>
    `<div class="log-entry"><span class="day-tag">[День ${e.day}]</span> ${e.message}</div>`,
  ).join("");
  el.scrollTop = el.scrollHeight;
}

function renderWinner() {
  const el = document.getElementById("winner-banner")!;
  if (state.phase === "end" && state.winner !== null) {
    el.classList.add("show");
    el.textContent = `🏆 Победил ${state.players[state.winner].name}!`;
  } else {
    el.classList.remove("show");
  }
}

// Start!
init();
