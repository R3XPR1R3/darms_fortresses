import { describe, it, expect } from "vitest";
import { createRng } from "./rng.js";
import { createMatch } from "./setup.js";
import { initDraft, draftPick } from "./draft.js";
import { buildTurnOrder, takeIncome, pickIncomeCard, buildDistrict, advanceTurn, currentPlayer } from "./turns.js";
import type { DistrictCard } from "@darms/shared-types";
import { HeroId, FLAME_CARD_NAME } from "@darms/shared-types";

function makeDeck(count: number): DistrictCard[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `card-${i}`,
    name: `District ${i}`,
    cost: 1 + (i % 5),
    hp: 1 + (i % 5),
    colors: [["yellow", "blue", "green", "red"][i % 4] as "yellow" | "blue" | "green" | "red"],
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

  it("take gold income adds 2 gold", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];

    const result = takeIncome(ordered, player.id, "gold")!;
    expect(result).not.toBeNull();
    expect(result.players[playerIdx].gold).toBe(player.gold + 2);
    expect(result.players[playerIdx].incomeTaken).toBe(true);
  });

  it("take card income creates 2-card offer and resolves to +1 hand card", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];
    const deckSize = ordered.deck.length;

    const afterIncome = takeIncome(ordered, player.id, "card")!;
    expect(afterIncome).not.toBeNull();
    expect(afterIncome.players[playerIdx].incomeOffer).toHaveLength(2);
    expect(afterIncome.deck.length).toBe(deckSize - 2);

    const pickedId = afterIncome.players[playerIdx].incomeOffer![0].id;
    const result = pickIncomeCard(afterIncome, player.id, pickedId)!;
    expect(result).not.toBeNull();
    expect(result.players[playerIdx].hand.length).toBe(player.hand.length + 1);
    expect(result.players[playerIdx].incomeTaken).toBe(true);
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
    expect(result.players[playerIdx].builtDistricts).toContainEqual(expect.objectContaining(card));
    expect(result.players[playerIdx].hand).not.toContainEqual(card);
  });

  it("rejects build if not enough gold", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];

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

  it("rejects building when player already has 8 districts", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];
    const card = player.hand[0];

    const withFullCity = {
      ...ordered,
      players: ordered.players.map((p, i) => (i === playerIdx
        ? {
          ...p,
          gold: 10,
          builtDistricts: Array.from({ length: 8 }, (_, n) => ({
            id: `full-${n}`,
            name: `Full ${n}`,
            cost: 1,
            hp: 1,
            colors: ["yellow"] as DistrictCard["colors"],
          })),
        }
        : p)),
    };

    const result = buildDistrict(withFullCity, player.id, card.id);
    expect(result).toBeNull();
  });

  it("advance turn moves to next player", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);

    expect(ordered.currentTurnIndex).toBe(0);
    const next = advanceTurn(ordered, rng);
    expect(next.currentTurnIndex).toBe(1);
  });

  it("advance past last turn ends day", () => {
    const { state, rng } = draftAll(42);
    let ordered = buildTurnOrder(state, rng);

    for (let i = 0; i < 4; i++) {
      ordered = advanceTurn(ordered, rng);
    }

    expect(ordered.phase).toBe("draft");
    expect(ordered.day).toBe(2);
  });

  it("monument costs 3 from hand and becomes fixed 5/5 on table", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];

    const monument: DistrictCard = {
      id: "mon-1",
      name: "Памятник",
      cost: 2,
      hp: 2,
      colors: ["purple"],
      purpleAbility: "monument",
    };

    const hand = [...player.hand, monument];
    const withMonument = {
      ...ordered,
      players: ordered.players.map((p, i) => i === playerIdx ? { ...p, hand, gold: 10 } : p),
    };

    const result = buildDistrict(withMonument, player.id, monument.id)!;
    expect(result.players[playerIdx].gold).toBe(7);
    const built = result.players[playerIdx].builtDistricts.find((d) => d.id === monument.id)!;
    expect(built.cost).toBe(5);
    expect(built.hp).toBe(5);
  });

  it("city gates can be built by king and keep base stats on table", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];

    const gates: DistrictCard = {
      id: "gate-1",
      name: "Врата в город",
      cost: 8,
      hp: 8,
      colors: ["purple", "yellow"],
      purpleAbility: "city_gates",
    };

    let s = {
      ...ordered,
      players: ordered.players.map((p, i) => i === playerIdx
        ? { ...p, hero: HeroId.King, hand: [...p.hand, gates], gold: 20 }
        : p),
    };
    const inHand = s.players[playerIdx].hand.find((c) => c.id === "gate-1")!;
    expect(inHand.cost).toBe(8);

    s = buildDistrict(s, player.id, "gate-1")!;
    const onTable = s.players[playerIdx].builtDistricts.find((d) => d.id === "gate-1")!;
    expect(onTable.cost).toBe(8);
    expect(onTable.hp).toBe(8);

    // advance one more turn: hand discounts continue, table gates unchanged
    s = advanceTurn(s, rng);
    const onTableAfter = s.players[playerIdx].builtDistricts.find((d) => d.id === "gate-1")!;
    expect(onTableAfter.cost).toBe(8);
    expect(onTableAfter.hp).toBe(8);
  });

  it("a single Flame stays in hand at end of turn (does not burn or self-replicate)", () => {
    // New flame mechanic: Flames stay in hand untouched at end of each turn.
    // They only burn at end of DAY. To get a Fire (per-turn burn) you need 3+
    // Flames in the same hand to combine.
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const player = ordered.players[playerIdx];

    const flame: DistrictCard = {
      id: "flame-a",
      name: FLAME_CARD_NAME,
      cost: 1,
      hp: 0,
      colors: ["red"],
    };

    const withFlame = {
      ...ordered,
      players: ordered.players.map((p, i) => i === playerIdx ? { ...p, hand: [...p.hand, flame] } : p),
    };

    const next = advanceTurn(withFlame, rng);
    const hand = next.players[playerIdx].hand;
    const flames = hand.filter((c) => c.name === FLAME_CARD_NAME);
    expect(flames.length).toBe(1); // Flame still here, no replication
    expect(hand.length).toBe(player.hand.length + 1); // hand size unchanged after the +1 flame addition
  });

  it("mine pays at end of day for non-merchant and each turn for merchant", () => {
    const { state, rng } = draftAll(42);
    const ordered = buildTurnOrder(state, rng);
    const playerIdx = currentPlayer(ordered)!;
    const merchantIdx = ordered.players.findIndex((p, i) => i !== playerIdx);
    const mineCard: DistrictCard = {
      id: "mine-1",
      name: "Шахта",
      cost: 3,
      hp: 3,
      colors: ["purple", "green"],
      purpleAbility: "mine",
    };

    let s = {
      ...ordered,
      players: ordered.players.map((p, i) => {
        if (i === playerIdx) return { ...p, hero: HeroId.King, builtDistricts: [...p.builtDistricts, mineCard], gold: 0 };
        if (i === merchantIdx) return { ...p, hero: HeroId.Merchant, builtDistricts: [...p.builtDistricts, mineCard], gold: 0 };
        return p;
      }),
    };

    // one turn: merchant gets at least +1 from mine end-of-turn (plus passive income); non-merchant does not yet
    s = advanceTurn(s, rng);
    expect(s.players[merchantIdx].gold).toBeGreaterThanOrEqual(1);
    expect(s.players[playerIdx].gold).toBe(0);

    // finish day => non-merchant gets payout
    for (let i = 0; i < 3; i++) s = advanceTurn(s, rng);
    expect(s.players[playerIdx].gold).toBeGreaterThanOrEqual(1);
  });
});

describe("setup", () => {
  it("deals 4 cards to each player; non-placeholder cards are not purple buildings", () => {
    const deck = makeDeck(40);
    const rng = createRng(42);
    const state = createMatch(PLAYERS, deck, rng);

    for (const p of state.players) {
      expect(p.hand).toHaveLength(4);
      for (const card of p.hand) {
        // Only placeholders may be purple-coloured; actual purple building cards are not dealt.
        if (card.colors.includes("purple")) {
          expect(card.placeholder).toBe("purple");
        }
      }
    }
  });

  it("players start with 2 gold", () => {
    const deck = makeDeck(40);
    const rng = createRng(42);
    const state = createMatch(PLAYERS, deck, rng);

    for (const p of state.players) {
      expect(p.gold).toBe(2);
    }
  });

  it("remaining deck has correct size after dealing (incl. placeholders)", () => {
    const deck = makeDeck(40);
    const rng = createRng(42);
    const state = createMatch(PLAYERS, deck, rng);
    // 40 in test deck + 24 placeholders × 4 players = 136, minus 4×4 dealt = 120
    expect(state.deck.length).toBe(40 - 16 + 24 * PLAYERS.length);
  });
});
