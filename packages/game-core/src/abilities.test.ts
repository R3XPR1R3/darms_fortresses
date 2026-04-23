import { describe, it, expect } from "vitest";
import { createRng } from "./rng.js";
import { createMatch } from "./setup.js";
import { createBaseDeck } from "./deck.js";
import { initDraft, draftPick } from "./draft.js";
import { buildTurnOrder, buildDistrict } from "./turns.js";
import { useAbility, checkWinCondition, calculateScores } from "./abilities.js";
import { HeroId, WIN_DISTRICTS } from "@darms/shared-types";
import type { GameState, PlayerState, DistrictCard } from "@darms/shared-types";

const PLAYERS = [
  { id: "p1", name: "Alice" },
  { id: "p2", name: "Bob" },
  { id: "p3", name: "Charlie" },
  { id: "p4", name: "Diana" },
];

function makeCard(id: string, name: string, cost: number, color: "yellow" | "blue" | "green" | "red"): DistrictCard {
  return { id, name, cost, hp: cost, colors: [color] };
}

function makeTestState(overrides?: Partial<GameState>): GameState {
  const rng = createRng(42);
  const deck = createBaseDeck();
  const state = createMatch(PLAYERS, deck, rng);
  return { ...state, phase: "turns", ...overrides };
}

function assignHeroes(state: GameState, assignments: HeroId[]): GameState {
  return {
    ...state,
    players: state.players.map((p, i) => ({
      ...p,
      hero: assignments[i] || null,
      abilityUsed: false,
      buildsRemaining: assignments[i] === HeroId.Architect ? 3 : 1,
    })),
  };
}

describe("hero abilities", () => {
  it("assassin kills a hero", () => {
    const rng = createRng(1);
    let state = makeTestState();
    state = assignHeroes(state, [HeroId.Assassin, HeroId.King, HeroId.Merchant, HeroId.General]);

    const result = useAbility(state, "p1", { hero: "assassin", targetHeroId: HeroId.King }, rng);
    expect(result).not.toBeNull();
    const king = result!.players.find((p) => p.hero === HeroId.King)!;
    expect(king.assassinated).toBe(true);
  });

  it("assassin only kills one hero", () => {
    const rng = createRng(1);
    let state = makeTestState();
    state = assignHeroes(state, [HeroId.Assassin, HeroId.King, HeroId.Merchant, HeroId.General]);

    const result = useAbility(state, "p1", { hero: "assassin", targetHeroId: HeroId.King }, rng);
    expect(result).not.toBeNull();
    expect(result!.players[1].assassinated).toBe(true);
    expect(result!.players[2].assassinated).toBe(false);
    expect(result!.players[0].abilityUsed).toBe(true);
  });

  it("thief sets up robbery", () => {
    const rng = createRng(1);
    let state = makeTestState();
    state = assignHeroes(state, [HeroId.Thief, HeroId.King, HeroId.Merchant, HeroId.General]);

    const result = useAbility(state, "p1", { hero: "thief", targetHeroId: HeroId.Merchant }, rng);
    expect(result).not.toBeNull();
    expect(result!.players[0].robbedHeroId).toBe(HeroId.Merchant);
  });

  it("thief cannot target assassin", () => {
    const rng = createRng(1);
    let state = makeTestState();
    state = assignHeroes(state, [HeroId.Thief, HeroId.Assassin, HeroId.Merchant, HeroId.General]);

    const result = useAbility(state, "p1", { hero: "thief", targetHeroId: HeroId.Assassin }, rng);
    expect(result).toBeNull();
  });

  it("sorcerer discards 2 random cards and draws 2", () => {
    const rng = createRng(1);
    let state = makeTestState();
    state = assignHeroes(state, [HeroId.Sorcerer, HeroId.King, HeroId.Merchant, HeroId.General]);
    const handBefore = state.players[0].hand.length;
    const deckBefore = state.deck.length;

    const result = useAbility(state, "p1", { hero: "sorcerer", mode: "draw" }, rng);
    expect(result).not.toBeNull();
    // hand = handBefore - 2 discarded + 2 drawn = handBefore
    expect(result!.players[0].hand.length).toBe(handBefore);
    expect(result!.deck.length).toBe(deckBefore - 2);
  });

  it("sorcerer swaps hands", () => {
    const rng = createRng(1);
    let state = makeTestState();
    state = assignHeroes(state, [HeroId.Sorcerer, HeroId.King, HeroId.Merchant, HeroId.General]);
    const hand0 = [...state.players[0].hand];
    const hand1 = [...state.players[1].hand];

    const result = useAbility(state, "p1", { hero: "sorcerer", mode: "swap", targetPlayerId: "p2" }, rng);
    expect(result).not.toBeNull();
    expect(result!.players[0].hand).toEqual(hand1);
    expect(result!.players[1].hand).toEqual(hand0);
  });

  it("sorcerer can swap hands with assassinated player", () => {
    const rng = createRng(1);
    let state = makeTestState();
    state = assignHeroes(state, [HeroId.Sorcerer, HeroId.King, HeroId.Merchant, HeroId.General]);
    // Mark p2 as assassinated
    const newPlayers = [...state.players];
    newPlayers[1] = { ...newPlayers[1], assassinated: true };
    state = { ...state, players: newPlayers };

    const result = useAbility(state, "p1", { hero: "sorcerer", mode: "swap", targetPlayerId: "p2" }, rng);
    expect(result).not.toBeNull();
  });

  it("general destroys a district for its cost", () => {
    const rng = createRng(1);
    let state = makeTestState();
    state = assignHeroes(state, [HeroId.General, HeroId.King, HeroId.Merchant, HeroId.Cleric]);
    const targetCard = makeCard("test-1", "Рынок", 2, "green");
    state = {
      ...state,
      players: state.players.map((p) => {
        if (p.id === "p1") return { ...p, gold: 10 };
        if (p.id === "p2") return { ...p, builtDistricts: [targetCard] };
        return p;
      }),
    };

    const result = useAbility(state, "p1", { hero: "general", targetPlayerId: "p2", cardId: "test-1" }, rng);
    expect(result).not.toBeNull();
    expect(result!.players[0].gold).toBe(8); // 10 - 2
    expect(result!.players[1].builtDistricts).toHaveLength(0);
  });

  it("general damages district HP without destroying it if not enough gold", () => {
    const rng = createRng(1);
    let state = makeTestState();
    state = assignHeroes(state, [HeroId.General, HeroId.King, HeroId.Merchant, HeroId.Cleric]);
    const targetCard = makeCard("test-1", "Дворец", 5, "yellow");
    state = {
      ...state,
      players: state.players.map((p) => {
        if (p.id === "p1") return { ...p, gold: 3 };
        if (p.id === "p2") return { ...p, builtDistricts: [targetCard] };
        return p;
      }),
    };

    const result = useAbility(state, "p1", { hero: "general", targetPlayerId: "p2", cardId: "test-1" }, rng);
    expect(result).not.toBeNull();
    expect(result!.players[0].gold).toBe(0); // spent all 3
    expect(result!.players[1].builtDistricts).toHaveLength(1); // not destroyed
    expect(result!.players[1].builtDistricts[0].hp).toBe(2); // 5 - 3
  });

  it("general cannot destroy cleric districts", () => {
    const rng = createRng(1);
    let state = makeTestState();
    state = assignHeroes(state, [HeroId.General, HeroId.King, HeroId.Merchant, HeroId.Cleric]);
    const targetCard = makeCard("test-1", "Храм", 1, "blue");
    state = {
      ...state,
      players: state.players.map((p) => {
        if (p.id === "p1") return { ...p, gold: 10 };
        if (p.id === "p4") return { ...p, builtDistricts: [targetCard] };
        return p;
      }),
    };

    const result = useAbility(state, "p1", { hero: "general", targetPlayerId: "p4", cardId: "test-1" }, rng);
    expect(result).toBeNull();
  });
});

describe("win condition", () => {
  it("detects when player builds 8 districts", () => {
    let state = makeTestState();
    const districts = Array.from({ length: WIN_DISTRICTS }, (_, i) =>
      makeCard(`w-${i}`, `Win District ${i}`, 1, "yellow"),
    );
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, builtDistricts: districts } : p,
      ),
    };

    const result = checkWinCondition(state);
    expect(result.players[0].finishedFirst).toBe(true);
  });

  it("calculates scores with bonuses", () => {
    let state = makeTestState();
    const districts: DistrictCard[] = [
      makeCard("s1", "D1", 3, "yellow"),
      makeCard("s2", "D2", 2, "blue"),
      makeCard("s3", "D3", 4, "green"),
      makeCard("s4", "D4", 1, "red"),
    ];
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, builtDistricts: districts, finishedFirst: true } : p,
      ),
    };

    const result = calculateScores(state);
    expect(result.phase).toBe("end");
    expect(result.winner).toBe(0);
    // Score: 3+2+4+1 = 10, +4 first, +3 all colors = 17
  });
});
