import type { DistrictCard, CardColor } from "@darms/shared-types";
import { ALL_DISTRICTS, ALL_PURPLE_BASIC, ALL_SPELLS, ALL_GREY } from "@darms/shared-types";
import type { DistrictDef, PurpleBasicDef, SpellDef, GreyDef } from "@darms/shared-types";

/** Unified template used for deck generation */
interface CardTemplate {
  name: string;
  cost: number;
  colors: CardColor[];
  count: number;
  spellAbility?: string;
  greyAbility?: string;
}

/** Build TEMPLATES from the card registry (single source of truth) */
function buildTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];

  for (const d of ALL_DISTRICTS as readonly DistrictDef[]) {
    templates.push({ name: d.name.ru, cost: d.cost, colors: d.colors, count: d.count });
  }
  for (const p of ALL_PURPLE_BASIC as readonly PurpleBasicDef[]) {
    templates.push({ name: p.name.ru, cost: p.cost, colors: p.colors, count: p.count });
  }
  for (const s of ALL_SPELLS as readonly SpellDef[]) {
    templates.push({ name: s.name.ru, cost: s.cost, colors: ["purple"], count: s.count, spellAbility: s.ability });
  }
  for (const g of ALL_GREY as readonly GreyDef[]) {
    templates.push({ name: g.name.ru, cost: g.cost, colors: [], count: g.count, greyAbility: g.ability });
  }

  return templates;
}

const TEMPLATES = buildTemplates();

let _nextId = 0;

export function createBaseDeck(): DistrictCard[] {
  _nextId = 0;
  const cards: DistrictCard[] = [];
  for (const t of TEMPLATES) {
    for (let i = 0; i < t.count; i++) {
      cards.push({
        id: `d-${_nextId++}`,
        name: t.name,
        cost: t.cost,
        originalCost: t.cost,
        hp: t.cost,
        colors: t.colors as CardColor[],
        baseColors: t.colors as CardColor[],
        spellAbility: t.spellAbility as DistrictCard["spellAbility"],
        greyAbility: t.greyAbility as DistrictCard["greyAbility"],
      });
    }
  }
  return cards;
}

/** Check if a card has purple in its colors (special card) */
export function isPurpleCard(card: DistrictCard): boolean {
  return card.colors.includes("purple");
}

const BASE_COLORS: CardColor[] = ["yellow", "blue", "green", "red"];

/** Map of cost → card names for generating random cards */
const COST_NAME_MAP: Record<number, string[]> = {};
for (const t of TEMPLATES) {
  if (t.colors.includes("purple")) continue; // skip purple for random generation
  if (!COST_NAME_MAP[t.cost]) COST_NAME_MAP[t.cost] = [];
  COST_NAME_MAP[t.cost].push(t.name);
}

let _genId = 1000;

/** Generate a random district card of a given cost and color */
export function generateCard(cost: number, colors: CardColor[]): DistrictCard {
  const names = COST_NAME_MAP[cost];
  const name = names ? names[Math.floor(Math.random() * names.length)] : `Квартал (${cost})`;
  return {
    id: `gen-${_genId++}`,
    name,
    cost,
    originalCost: cost,
    hp: cost,
    colors,
    baseColors: colors,
  };
}

/** Generate a random card of the given cost with a random base color */
export function generateRandomCard(cost: number, rng: { int: (a: number, b: number) => number }): DistrictCard {
  const color = BASE_COLORS[rng.int(0, BASE_COLORS.length - 1)];
  return generateCard(cost, [color]);
}

/** Add a random second color to a card (for Druid) */
export function addRandomColor(card: DistrictCard, rng: { int: (a: number, b: number) => number }): DistrictCard {
  if (card.colors.length >= 2) return card;
  const available = BASE_COLORS.filter((c) => !card.colors.includes(c));
  if (available.length === 0) return card;
  const extra = available[rng.int(0, available.length - 1)];
  return { ...card, colors: [...card.colors, extra] };
}

/** Generate a card of the same cost but a different color */
export function generateDifferentColorCard(
  cost: number,
  excludeColors: CardColor[],
  rng: { int: (a: number, b: number) => number },
): DistrictCard {
  const available = BASE_COLORS.filter((c) => !excludeColors.includes(c));
  if (available.length === 0) {
    return generateRandomCard(cost, rng);
  }
  const color = available[rng.int(0, available.length - 1)];
  return generateCard(cost, [color]);
}
