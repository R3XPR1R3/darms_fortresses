import type { SpellDef } from "../../types.js";

export const ignite: SpellDef = {
  id: "ignite",
  type: "spell",
  cost: 1,
  colors: ["purple"],
  ability: "ignite",
  count: 2,
  name: { ru: "Поджигание", en: "Ignite" },
  description: {
    ru: "{kw:spell} Заменяет случайную карту в руке противника на 🔥 Пламя",
    en: "{kw:spell} Replace a random card in opponent's hand with 🔥 Flame",
  },
};

