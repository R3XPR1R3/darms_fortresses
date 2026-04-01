import type { PurpleSpecialDef } from "../../types.js";

export const highway: PurpleSpecialDef = {
  id: "highway",
  type: "purple",
  cost: 4,
  colors: ["purple"],
  ability: "highway",
  emoji: "🛤️",
  name: { ru: "Магистраль", en: "Highway" },
  description: {
    ru: "Скорость вашего героя −1 (ходите раньше)",
    en: "Your hero's speed −1 (act earlier)",
  },
};

