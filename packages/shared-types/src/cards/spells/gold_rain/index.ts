import type { SpellDef } from "../../types.js";

export const goldRain: SpellDef = {
  id: "goldRain",
  type: "spell",
  cost: 0,
  colors: ["purple"],
  ability: "gold_rain",
  count: 2,
  name: { ru: "Золотой дождь", en: "Gold Rain" },
  description: {
    ru: "{kw:spell} Все игроки получают +1💰",
    en: "{kw:spell} All players gain +1💰",
  },
};

