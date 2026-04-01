import type { PurpleSpecialDef } from "../../types.js";

export const cityGates: PurpleSpecialDef = {
  id: "cityGates",
  type: "purple",
  cost: 8,
  colors: ["purple", "yellow"],
  ability: "city_gates",
  emoji: "🚪",
  name: { ru: "Врата в город", en: "City Gates" },
  description: {
    ru: "В руке: цена −2 каждый ход. Лидер строит автоматически и бесплатно",
    en: "In hand: cost −2 each turn. Leader auto-builds it free",
  },
};

