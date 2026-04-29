import type { GameState, DistrictCard, PlayerState, MatchDeckBuild, CompanionSlot } from "@darms/shared-types";
import { PURPLE_PLACEHOLDERS_PER_MATCH, findPurpleByAbility, findSpellByAbility, CompanionId } from "@darms/shared-types";
import type { Rng } from "./rng.js";

/** Default test build — used when a caller doesn't specify one (tests / sandbox). */
export const DEFAULT_TEST_BUILD: MatchDeckBuild = {
  purple: ["mine", "mine", "cannon", "cult", "stronghold", "altar_darkness"],
  companions: [CompanionId.Farmer, CompanionId.Hunter, CompanionId.Mason],
};

let _purpleGenId = 5000;

/** Canonical name for the purple placeholder stub card. UI translates via i18n. */
export const PURPLE_PLACEHOLDER_NAME = "Фиолетовая карта!";

/** Build a purple placeholder stub card (cost 0, played like a spell to pick a real purple). */
export function createPurplePlaceholder(): DistrictCard {
  return {
    id: `ph-purple-${_purpleGenId++}`,
    name: PURPLE_PLACEHOLDER_NAME,
    cost: 0,
    originalCost: 0,
    hp: 0,
    colors: ["purple"],
    baseColors: ["purple"],
    placeholder: "purple",
  };
}

/** Build a concrete purple DistrictCard from an ability id. Supports both purple
 *  buildings (purpleAbility) and purple spells (spellAbility). */
export function createPurpleFromAbility(ability: string): DistrictCard | null {
  const pDef = findPurpleByAbility(ability);
  if (pDef) {
    return {
      id: `purple-${_purpleGenId++}`,
      name: pDef.name.ru,
      cost: pDef.cost,
      originalCost: pDef.cost,
      hp: pDef.cost,
      colors: [...pDef.colors],
      baseColors: [...pDef.colors],
      purpleAbility: pDef.ability,
    };
  }
  const sDef = findSpellByAbility(ability);
  if (sDef) {
    return {
      id: `spell-${_purpleGenId++}`,
      name: sDef.name.ru,
      cost: sDef.cost,
      originalCost: sDef.cost,
      hp: 0,
      colors: ["purple"],
      baseColors: ["purple"],
      spellAbility: sDef.ability,
    };
  }
  return null;
}

/** Materialise a deck-build's 6 purple picks into DistrictCards (order preserved). */
export function materialiseBuildPurplePool(build: MatchDeckBuild): DistrictCard[] {
  const out: DistrictCard[] = [];
  for (const ability of build.purple) {
    const card = createPurpleFromAbility(ability);
    if (card) out.push(card);
  }
  return out;
}

function makeCompanionDeck(build: MatchDeckBuild): CompanionSlot[] {
  return build.companions.map((id) => ({ id, state: "available" as const }));
}

/**
 * Create the initial game state for a 4-player match.
 *
 * Each player supplies a deck-build:
 *   - 6 purple cards become the player's purplePool (drawn via placeholder stubs)
 *   - 3 companions become the player's companionDeck (personal pool)
 *
 * Each player's starting deck contribution includes 24 purple placeholder
 * stubs which are shuffled in with the common non-purple deck.
 */
export function createMatch(
  playerInfos: Array<{ id: string; name: string; build?: MatchDeckBuild }>,
  deck: DistrictCard[],
  rng: Rng,
): GameState {
  // All purple cards (buildings and spells) are excluded from the shared deck —
  // they come exclusively from each player's deck-build via placeholders.
  const normalCards = deck.filter((c) => !c.colors.includes("purple"));

  // Mix in placeholder stubs — one set per player, so total placeholders = N × 24.
  const placeholders: DistrictCard[] = [];
  for (let i = 0; i < playerInfos.length; i++) {
    for (let k = 0; k < PURPLE_PLACEHOLDERS_PER_MATCH; k++) {
      placeholders.push(createPurplePlaceholder());
    }
  }

  const shuffled = [...normalCards, ...placeholders];
  rng.shuffle(shuffled);

  const players: PlayerState[] = playerInfos.map((info) => {
    const hand = shuffled.splice(0, 4);
    const build = info.build ?? DEFAULT_TEST_BUILD;
    return {
      id: info.id,
      name: info.name,
      gold: 2,
      hand,
      builtDistricts: [],
      hero: null,
      incomeTaken: false,
      incomeOffer: null,
      buildsRemaining: 0,
      abilityUsed: false,
      assassinated: false,
      robbedHeroId: null,
      finishedFirst: false,
      companion: null,
      companionUsed: false,
      companionDisabled: false,
      royalGuardDraft: false,
      designerMarkedCardId: null,
      contractorTargetHeroId: null,
      purplePool: materialiseBuildPurplePool(build),
      companionDeck: makeCompanionDeck(build),
      pendingPurpleOffer: null,
    };
  });

  const crownHolder = rng.int(0, players.length - 1);

  return {
    phase: "setup",
    players,
    crownHolder,
    day: 1,
    deck: shuffled,
    discardPile: [],
    draft: null,
    turnOrder: null,
    currentTurnIndex: 0,
    winner: null,
    log: [],
    rng: rng.getSeed(),
    bardUsageCount: 0,
    bannedCompanions: [],
    plagueDaysLeft: 0,
  };
}
