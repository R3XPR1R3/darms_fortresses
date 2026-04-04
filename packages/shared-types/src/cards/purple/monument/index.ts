import type { PurpleSpecialDef } from "../../types.js";

export const monument: PurpleSpecialDef = {
  id: "monument",
  type: "purple",
  cost: 3,
  colors: ["purple"],
  ability: "monument",
  emoji: "🗿",
  name: { ru: "Памятник", en: "Monument" },
  description: {
    ru: "В руке: стоит 3💰. На столе: всегда 5💰/5 HP",
    en: "In hand: costs 3💰 to build. On board: always 5💰/5 HP",
  },
};

