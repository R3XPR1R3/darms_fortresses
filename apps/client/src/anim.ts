import { animate, stagger } from "animejs";

// ---- Card / district appear animations ----

/** Animate newly appeared district cards (scale + fade in) */
export function animateCardsAppear(container: string | Element) {
  const el = typeof container === "string" ? document.querySelector(container) : container;
  if (!el) return;
  const cards = el.querySelectorAll(".district-card, .hand-card");
  if (!cards.length) return;
  animate(cards, {
    scale: [0.6, 1],
    opacity: [0, 1],
    duration: 400,
    delay: stagger(60),
    ease: "outBack",
  });
}

/** Animate a single action (gold gain, card draw, build) — flash the stats bar */
export function animateStatsPulse(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return;
  animate(el, {
    scale: [1, 1.15, 1],
    duration: 350,
    ease: "outQuad",
  });
}

/** Animate hero buttons appearing in draft */
export function animateDraftHeroes() {
  const buttons = document.querySelectorAll(".hero-btn");
  if (!buttons.length) return;
  animate(buttons, {
    translateY: [30, 0],
    opacity: [0, 1],
    duration: 450,
    delay: stagger(80),
    ease: "outCubic",
  });
}

/** Animate turn banner change */
export function animateBannerSwitch() {
  const el = document.getElementById("turn-banner");
  if (!el) return;
  animate(el, {
    opacity: [0.3, 1],
    translateY: [-8, 0],
    duration: 350,
    ease: "outQuad",
  });
}

/** Animate opponent board switching */
export function animateOpponentBoard() {
  const el = document.getElementById("opponent-board");
  if (!el) return;
  animate(el, {
    opacity: [0, 1],
    translateX: [20, 0],
    duration: 300,
    ease: "outQuad",
  });
}

/** Animate my board sections appearing */
export function animateMyBoard() {
  const el = document.getElementById("my-board");
  if (!el) return;
  const children = el.children;
  if (!children.length) return;
  animate(children, {
    opacity: [0, 1],
    translateY: [12, 0],
    duration: 350,
    delay: stagger(50),
    ease: "outQuad",
  });
}

/** Animate build action — built card pops */
export function animateBuild() {
  const cards = document.querySelectorAll(".my-districts .district-card");
  if (!cards.length) return;
  const last = cards[cards.length - 1];
  animate(last, {
    scale: [0.3, 1],
    opacity: [0, 1],
    rotate: [-8, 0],
    duration: 500,
    ease: "outBack",
  });
}

/** Animate gold/card income — pulse the relevant button area */
export function animateIncome() {
  animateStatsPulse(".my-stats-bar");
}

/** Animate winner overlay appearing */
export function animateWinner() {
  const card = document.querySelector(".winner-card");
  if (!card) return;
  animate(card, {
    scale: [0.5, 1],
    opacity: [0, 1],
    duration: 600,
    ease: "outBack",
  });
}

/** Animate log entry appearing */
export function animateLogEntry() {
  const log = document.getElementById("game-log");
  if (!log) return;
  const last = log.lastElementChild;
  if (!last) return;
  animate(last, {
    opacity: [0, 1],
    translateX: [-10, 0],
    duration: 300,
    ease: "outQuad",
  });
}

/** Animate active player arrow bouncing */
export function animateActiveArrow() {
  const arrow = document.querySelector(".active-arrow");
  if (!arrow) return;
  animate(arrow, {
    translateY: [-3, 3],
    duration: 800,
    loop: true,
    alternate: true,
    ease: "inOutSine",
  });
}

/** Animate turn timer pulse when urgent */
export function animateTimerUrgent() {
  const el = document.querySelector(".turn-timer.timer-urgent");
  if (!el) return;
  animate(el, {
    scale: [1, 1.1, 1],
    duration: 600,
    loop: true,
    ease: "inOutSine",
  });
}
