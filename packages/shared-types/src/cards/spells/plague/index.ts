import type { SpellDef } from "../../types.js";

export const plague: SpellDef = {
  id: "plague",
  type: "spell",
  cost: 2,
  colors: ["purple"],
  ability: "plague",
  count: 2,
  name: { ru: "Чума", en: "Plague" },
  description: {
    ru: "{kw:spell} Эффект 3 дня: каждый день случайный игрок теряет золото, случайный квартал получает урон",
    en: "{kw:spell} 3-day effect: each day a random player loses gold, a random district takes damage",
  },
};

