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

  // Dual-color cards (bonus variety)
  { name: "Торговая палата", cost: 3, colors: ["blue", "green"], count: 2 },
  { name: "Военный совет", cost: 3, colors: ["yellow", "red"], count: 2 },
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
        colors: t.colors,
        purple: false,
      });
    }
  }
  return cards;
}
