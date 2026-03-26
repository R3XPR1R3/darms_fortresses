import { animate } from "animejs";

// ---- Snapshot of previous state for diff-based animations ----
interface Snapshot {
  phase: string;
  activeIdx: number | null;
  myDistrictCount: number;
  myGold: number;
  myHandSize: number;
  oppIdx: number | null;
  oppDistrictCount: number;
  logCount: number;
  winner: number | null;
  draftStep: number;
}

let prev: Snapshot = {
  phase: "",
  activeIdx: null,
  myDistrictCount: 0,
  myGold: 0,
  myHandSize: 0,
  oppIdx: null,
  oppDistrictCount: 0,
  logCount: 0,
  winner: null,
  draftStep: -1,
};

/** Call AFTER render with current state values. Compares to prev and fires targeted animations. */
export function animateChanges(cur: Snapshot) {
  // -- New district built by me --
  if (cur.myDistrictCount > prev.myDistrictCount) {
    const cards = document.querySelectorAll("#my-board .my-districts .district-card");
    if (cards.length) {
      const last = cards[cards.length - 1] as HTMLElement;
      last.style.opacity = "0";
      animate(last, {
        scale: [0.3, 1],
        opacity: [0, 1],
        rotate: [-5, 0],
        duration: 450,
        ease: "outBack",
      });
    }
  }

  // -- Gold or hand size changed → pulse stats --
  if (cur.myGold !== prev.myGold || cur.myHandSize !== prev.myHandSize) {
    const stats = document.querySelector("#my-board .my-stats-bar");
    if (stats && prev.phase !== "") {
      animate(stats, {
        scale: [1, 1.12, 1],
        duration: 300,
        ease: "outQuad",
      });
    }
  }

  // -- Turn changed (active player switched) --
  if (cur.activeIdx !== prev.activeIdx && prev.activeIdx !== null) {
    const banner = document.getElementById("turn-banner");
    if (banner) {
      animate(banner, {
        opacity: [0.4, 1],
        translateY: [-6, 0],
        duration: 300,
        ease: "outQuad",
      });
    }
  }

  // -- Switched to a different opponent tab --
  if (cur.oppIdx !== prev.oppIdx && prev.oppIdx !== null) {
    const board = document.getElementById("opponent-board");
    if (board) {
      animate(board, {
        opacity: [0, 1],
        translateX: [15, 0],
        duration: 250,
        ease: "outQuad",
      });
    }
  }

  // -- Opponent built something --
  if (cur.oppIdx === prev.oppIdx && cur.oppDistrictCount > prev.oppDistrictCount) {
    const cards = document.querySelectorAll("#opponent-board .opp-districts .district-card");
    if (cards.length) {
      const last = cards[cards.length - 1] as HTMLElement;
      last.style.opacity = "0";
      animate(last, {
        scale: [0.4, 1],
        opacity: [0, 1],
        duration: 400,
        ease: "outBack",
      });
    }
  }

  // -- New log entries --
  if (cur.logCount > prev.logCount) {
    const log = document.getElementById("game-log");
    if (log && log.classList.contains("show")) {
      const entries = log.querySelectorAll(".log-entry");
      const newCount = cur.logCount - prev.logCount;
      const startIdx = Math.max(0, entries.length - newCount);
      for (let i = startIdx; i < entries.length; i++) {
        const entry = entries[i] as HTMLElement;
        entry.style.opacity = "0";
        animate(entry, {
          opacity: [0, 1],
          translateX: [-8, 0],
          duration: 250,
          delay: (i - startIdx) * 40,
          ease: "outQuad",
        });
      }
    }
  }

  // -- Draft step changed (new hero selection round) --
  if (cur.draftStep !== prev.draftStep && cur.phase === "draft") {
    const buttons = document.querySelectorAll(".hero-btn");
    if (buttons.length) {
      buttons.forEach((btn, i) => {
        (btn as HTMLElement).style.opacity = "0";
      });
      animate(buttons, {
        translateY: [20, 0],
        opacity: [0, 1],
        duration: 350,
        delay: (_el: Element, i: number) => i * 60,
        ease: "outCubic",
      });
    }
  }

  // -- Winner appeared --
  if (cur.winner !== null && prev.winner === null) {
    const card = document.querySelector(".winner-card");
    if (card) {
      animate(card, {
        scale: [0.5, 1],
        opacity: [0, 1],
        duration: 500,
        ease: "outBack",
      });
    }
  }

  // -- Phase changed (e.g. draft → turns) --
  if (cur.phase !== prev.phase && prev.phase !== "") {
    const board = document.getElementById("game-board");
    if (board) {
      animate(board, {
        opacity: [0.7, 1],
        duration: 300,
        ease: "outQuad",
      });
    }
  }

  // Save for next comparison
  prev = { ...cur };
}

/** Reset snapshot (call when entering a new game) */
export function resetAnimState() {
  prev = {
    phase: "",
    activeIdx: null,
    myDistrictCount: 0,
    myGold: 0,
    myHandSize: 0,
    oppIdx: null,
    oppDistrictCount: 0,
    logCount: 0,
    winner: null,
    draftStep: -1,
  };
}
