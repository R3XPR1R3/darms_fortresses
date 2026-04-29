import type { SpellDef } from "../../types.js";

export const fireMagic: SpellDef = {
  id: "fireMagic",
  type: "spell",
  cost: 2,
  colors: ["purple"],
  ability: "fire_magic",
  count: 1,
  name: { ru: "Магия огня", en: "Fire Magic" },
  description: {
    ru: "{kw:spell} Создаёт 2 случайных заклинания (фиолетовых или серых) со стоимостью −1. Если не разыграны на этом ходу — превращаются в 🔥 Пламя",
    en: "{kw:spell} Create 2 random spells (purple or grey) with cost −1. Unplayed by end of turn → 🔥 Flame",
  },
};
