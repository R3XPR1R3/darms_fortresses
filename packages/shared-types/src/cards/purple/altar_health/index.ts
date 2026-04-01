import type { PurpleSpecialDef } from "../../types.js";

export const altarHealth: PurpleSpecialDef = {
  id: "altarHealth",
  type: "purple",
  cost: 1,
  colors: ["purple"],
  ability: "altar_health",
  emoji: "🛐",
  name: { ru: "Алтарь здоровья", en: "Altar of Health" },
  description: {
    ru: "{kw:altar}: постройте 3 разных алтаря для победы",
    en: "{kw:altar}: build 3 different altars to win",
  },
};

