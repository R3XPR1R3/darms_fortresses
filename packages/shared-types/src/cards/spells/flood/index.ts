import type { SpellDef } from "../../types.js";

export const flood: SpellDef = {
  id: "flood",
  type: "spell",
  cost: 0,
  colors: ["purple"],
  ability: "flood",
  count: 2,
  name: { ru: "Потоп", en: "Flood" },
  description: {
    ru: "{kw:spell} До 4 случайных кварталов у каждого возвращаются в руку",
    en: "{kw:spell} Up to 4 random districts per player return to hand",
  },
};

