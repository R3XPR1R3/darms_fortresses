import type { PurpleSpecialDef } from "../../types.js";

export const altarDarkness: PurpleSpecialDef = {
  id: "altarDarkness",
  type: "purple",
  cost: 2,
  colors: ["purple"],
  ability: "altar_darkness",
  emoji: "🌑",
  name: { ru: "Алтарь тьмы", en: "Altar of Darkness" },
  description: {
    ru: "{kw:altar}: постройте 4 алтаря тьмы для победы. Можно строить дубликаты",
    en: "{kw:altar}: build 4 Altars of Darkness to win. Duplicates allowed",
  },
};
