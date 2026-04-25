import type { SpellDef } from "../../types.js";

export const fireRitual: SpellDef = {
  id: "fire_ritual",
  type: "spell",
  cost: 3,
  colors: ["purple"],
  ability: "fire_ritual",
  count: 2,
  name: { ru: "Ритуал огня", en: "Fire Ritual" },
  description: {
    ru: "{kw:spell} Сожгите вашу постройку. За каждое золото её цены подбрасывает 🔥 Пламя в руку случайного противника",
    en: "{kw:spell} Burn one of your built districts. For every gold of its cost, plant a 🔥 Flame in a random opponent's hand",
  },
};
