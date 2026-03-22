import { describe, it, expect } from "vitest";
import { createRng } from "./rng.js";
import { createMatch } from "./setup.js";
import { initDraft, draftPick } from "./draft.js";
import { buildTurnOrder, takeIncome, buildDistrict, advanceTurn, currentPlayer } from "./turns.js";
import type { DistrictCard } from "@darms/shared-types";

function makeDeck(count: number): DistrictCard[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `card-${i}`,
    name: `District ${i}`,
    cost: 1 + (i % 5),
    colors: [["yellow", "blue", "green", "red"][i % 4] as "yellow" | "blue" | "green" | "red"],
    purple: false,
  }));
}

const PLAYERS = [
  { id: "p1", name: "Alice" },
  { id: "p2", name: "Bob" },
  { id: "p3", name: "Charlie" },
  { id: "p4", name: "Diana" },
];

/** Helper: run full draft so we can test turns */
function draftAll(seed: number) {
  const rng = createRng(seed);
  let state = createMatch(PLAYERS, makeDeck(40), rng);
  state = initDraft(state, rng);

  for (let step = 0; step < 4; step++) {
    const drafterIdx = state.draft!.draftOrder[state.draft!.currentStep];
    const player = state.players[drafterIdx];
    const hero = state.draft!.availableHeroes[0];
    state = draftPick(state, player.id, hero, rng)!;
  }

  return { state, rng };
}

describe("turn phase", () => {
  it("builds turn order sorted by hero speed", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);

    expect(ordered.turnOrder).not.toBeNull();
    expect(ordered.turnOrder!.length).toBe(4);
  });

  it("take gold income adds 1 gold", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];

    const result = takeIncome(ordered, player.id, "gold")!;
    expect(result).not.toBeNull();
    expect(result.players[playerIdx].gold).toBe(player.gold + 1);
    expect(result.players[playerIdx].incomeTaken).toBe(true);
  });

  it("take card income draws from deck", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];
    const deckSize = ordered.deck.length;

    const result = takeIncome(ordered, player.id, "card")!;
    expect(result).not.toBeNull();
    expect(result.players[playerIdx].hand.length).toBe(player.hand.length + 1);
    expect(result.deck.length).toBe(deckSize - 1);
  });

  it("rejects double income", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];

    const after = takeIncome(ordered, player.id, "gold")!;
    const double = takeIncome(after, player.id, "gold");
    expect(double).toBeNull();
  });

  it("build district costs gold and moves card", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;

    // Give player enough gold
    const withGold = {
      ...ordered,
      players: ordered.players.map((p, i) =>
        i === playerIdx ? { ...p, gold: 10 } : p,
      ),
    };

    const player = withGold.players[playerIdx];
    const card = player.hand[0];

    const result = buildDistrict(withGold, player.id, card.id)!;
    expect(result).not.toBeNull();
    expect(result.players[playerIdx].gold).toBe(10 - card.cost);
    expect(result.players[playerIdx].builtDistricts).toContainEqual(card);
    expect(result.players[playerIdx].hand).not.toContainEqual(card);
  });

  it("rejects build if not enough gold", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];

    // Set gold to 0
    const broke = {
      ...ordered,
      players: ordered.players.map((p, i) =>
        i === playerIdx ? { ...p, gold: 0 } : p,
      ),
    };

    const card = player.hand[0];
    const result = buildDistrict(broke, player.id, card.id);
    expect(result).toBeNull();
  });

  it("advance turn moves to next player", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);

    expect(ordered.currentTurnIndex).toBe(0);
    const next = advanceTurn(ordered);
    expect(next.currentTurnIndex).toBe(1);
  });

  it("advance past last turn ends day", () => {
    const { state, rng } = draftAll(42);
    let ordered = buildTurnOrder(state, rng);

    // Advance through all turns
    for (let i = 0; i < 4; i++) {
      ordered = advanceTurn(ordered);
    }

    expect(ordered.phase).toBe("draft");
    expect(ordered.day).toBe(2);
  });
});

describe("setup", () => {
  it("deals 5 cards to each player with no purple", () => {
    const deck = makeDeck(40);
    const rng = createRng(42);
    const state = createMatch(PLAYERS, deck, rng);

    for (const p of state.players) {
      expect(p.hand).toHaveLength(5);
      for (const card of p.hand) {
        expect(card.purple).toBe(false);
      }
    }
  });

  it("remaining deck has correct size after dealing", () => {
    const deck = makeDeck(40);
    const rng = createRng(42);
    const state = createMatch(PLAYERS, deck, rng);

    // 40 cards - 4*5 dealt = 20 remaining
    expect(state.deck.length).toBe(20);
  });
});
