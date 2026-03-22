import { describe, it, expect } from "vitest";
import { createRng } from "./rng.js";
import { createMatch } from "./setup.js";
import { initDraft, draftPick, currentDrafter } from "./draft.js";
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

describe("draft phase", () => {
  it("initializes with 6 available heroes and 2 bans", () => {
    const rng = createRng(42);
    const state = createMatch(PLAYERS, makeDeck(40), rng);
    const drafted = initDraft(state, rng);

    expect(drafted.phase).toBe("draft");
    expect(drafted.draft).not.toBeNull();
    expect(drafted.draft!.availableHeroes).toHaveLength(6);
    expect(drafted.draft!.faceUpBans).toHaveLength(1);
    expect(drafted.draft!.faceDownBans).toHaveLength(1);
  });

  it("all 8 heroes are accounted for after init", () => {
    const rng = createRng(123);
    const state = createMatch(PLAYERS, makeDeck(40), rng);
    const drafted = initDraft(state, rng);
    const draft = drafted.draft!;

    const allHeroes = [
      ...draft.availableHeroes,
      ...draft.faceUpBans,
      ...draft.faceDownBans,
    ];
    expect(allHeroes).toHaveLength(8);
    expect(new Set(allHeroes).size).toBe(8);
  });

  it("players pick heroes in order, draft completes", () => {
    const rng = createRng(99);
    let state = createMatch(PLAYERS, makeDeck(40), rng);
    state = initDraft(state, rng);

    // All 4 players pick in order
    for (let step = 0; step < 4; step++) {
      const drafterIdx = currentDrafter(state)!;
      expect(drafterIdx).not.toBeNull();

      const player = state.players[drafterIdx];
      const heroToPick = state.draft!.availableHeroes[0];

      const next = draftPick(state, player.id, heroToPick, rng);
      expect(next).not.toBeNull();
      state = next!;
    }

    // After all picks, phase should be "turns"
    expect(state.phase).toBe("turns");
    // Each player should have a hero
    for (const p of state.players) {
      expect(p.hero).not.toBeNull();
    }
    // All heroes accounted for (4 picked + 4 banned)
    const picked = state.players.map((p) => p.hero!);
    const banned = [
      ...state.draft!.faceUpBans,
      ...state.draft!.faceDownBans,
    ];
    expect(new Set([...picked, ...banned]).size).toBe(8);
  });

  it("rejects invalid pick (wrong player)", () => {
    const rng = createRng(55);
    let state = createMatch(PLAYERS, makeDeck(40), rng);
    state = initDraft(state, rng);

    // Try to pick with wrong player
    const hero = state.draft!.availableHeroes[0];
    const wrongPlayer = state.players.find(
      (_, i) => i !== state.draft!.draftOrder[0],
    )!;

    const result = draftPick(state, wrongPlayer.id, hero, rng);
    expect(result).toBeNull();
  });

  it("rejects pick of unavailable hero", () => {
    const rng = createRng(77);
    let state = createMatch(PLAYERS, makeDeck(40), rng);
    state = initDraft(state, rng);

    const drafterIdx = currentDrafter(state)!;
    const player = state.players[drafterIdx];
    const bannedHero = state.draft!.faceUpBans[0];

    const result = draftPick(state, player.id, bannedHero, rng);
    expect(result).toBeNull();
  });

  it("is deterministic with same seed", () => {
    const rng1 = createRng(42);
    const state1 = initDraft(createMatch(PLAYERS, makeDeck(40), rng1), rng1);

    const rng2 = createRng(42);
    const state2 = initDraft(createMatch(PLAYERS, makeDeck(40), rng2), rng2);

    expect(state1.draft!.availableHeroes).toEqual(state2.draft!.availableHeroes);
    expect(state1.draft!.faceUpBans).toEqual(state2.draft!.faceUpBans);
    expect(state1.draft!.faceDownBans).toEqual(state2.draft!.faceDownBans);
  });
});
