import type { PurpleSpecialDef } from "../../types.js";

export const altarPower: PurpleSpecialDef = {
  id: "altarPower",
  type: "purple",
  cost: 1,
  colors: ["purple"],
  ability: "altar_power",
  emoji: "🛐",
  name: { ru: "Алтарь силы", en: "Altar of Power" },
  description: {
    ru: "{kw:altar}: постройте 3 разных алтаря для победы",
    en: "{kw:altar}: build 3 different altars to win",
  },
};

