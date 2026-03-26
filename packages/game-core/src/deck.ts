import type { DistrictCard, CardColor } from "@darms/shared-types";

interface CardTemplate {
  name: string;
  cost: number;
  colors: CardColor[];
  count: number;
}

const TEMPLATES: CardTemplate[] = [
  // Yellow — nobility (10 cards)
  { name: "Сторожевая башня", cost: 1, colors: ["yellow"], count: 3 },
  { name: "Тронный зал", cost: 3, colors: ["yellow"], count: 2 },
  { name: "Дворец", cost: 5, colors: ["yellow"], count: 1 },
  { name: "Казармы стражи", cost: 2, colors: ["yellow"], count: 2 },
  { name: "Королевский сад", cost: 4, colors: ["yellow"], count: 2 },

  // Blue — clergy (10 cards)
  { name: "Храм", cost: 1, colors: ["blue"], count: 3 },
  { name: "Часовня", cost: 2, colors: ["blue"], count: 2 },
  { name: "Монастырь", cost: 3, colors: ["blue"], count: 2 },
  { name: "Собор", cost: 5, colors: ["blue"], count: 1 },
  { name: "Святилище", cost: 4, colors: ["blue"], count: 2 },

  // Green — trade (10 cards)
  { name: "Таверна", cost: 1, colors: ["green"], count: 3 },
  { name: "Рынок", cost: 2, colors: ["green"], count: 2 },
  { name: "Торговый пост", cost: 3, colors: ["green"], count: 2 },
  { name: "Порт", cost: 4, colors: ["green"], count: 2 },
  { name: "Ратуша", cost: 5, colors: ["green"], count: 1 },

  // Red — military (10 cards)
  { name: "Застава", cost: 1, colors: ["red"], count: 3 },
  { name: "Тюрьма", cost: 2, colors: ["red"], count: 2 },
  { name: "Крепость", cost: 3, colors: ["red"], count: 2 },
  { name: "Арсенал", cost: 4, colors: ["red"], count: 2 },
  { name: "Цитадель", cost: 5, colors: ["red"], count: 1 },

  // Multi-color cards
  { name: "Торговая палата", cost: 3, colors: ["blue", "green"], count: 2 },
  { name: "Военный совет", cost: 3, colors: ["yellow", "red"], count: 2 },

  // Purple — special (unique cards, not dealt in starting hand)
  { name: "Обсерватория", cost: 5, colors: ["purple"], count: 1 },
  { name: "Лаборатория", cost: 5, colors: ["purple"], count: 1 },
  { name: "Кузница", cost: 5, colors: ["purple"], count: 1 },
  { name: "Библиотека", cost: 6, colors: ["purple"], count: 1 },

  // Multi-color with purple (noble-specific abilities in future)
  { name: "Королевская библиотека", cost: 4, colors: ["yellow", "purple"], count: 1 },
  { name: "Священная роща", cost: 4, colors: ["blue", "purple"], count: 1 },
];

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
        hp: t.cost,
        colors: t.colors,
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
    hp: cost,
    colors,
  };
}

/** Generate a random card of the given cost with a random base color */
export function generateRandomCard(cost: number, rng: { int: (a: number, b: number) => number }): DistrictCard {
  const color = BASE_COLORS[rng.int(0, BASE_COLORS.length - 1)];
  return generateCard(cost, [color]);
}

/** Add a random second color to a card (for Druid) */
export function addRandomColor(card: DistrictCard, rng: { int: (a: number, b: number) => number }): DistrictCard {
  if (card.colors.length >= 2) return card; // already multi-color
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
    // Fallback: use any color
    return generateRandomCard(cost, rng);
  }
  const color = available[rng.int(0, available.length - 1)];
  return generateCard(cost, [color]);
}
