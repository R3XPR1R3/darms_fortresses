import type { PurpleSpecialDef } from "../../types.js";

export const altarStamina: PurpleSpecialDef = {
  id: "altarStamina",
  type: "purple",
  cost: 1,
  colors: ["purple"],
  ability: "altar_stamina",
  emoji: "🛐",
  name: { ru: "Алтарь выносливости", en: "Altar of Stamina" },
  description: {
    ru: "{kw:altar}: постройте 3 разных алтаря для победы",
    en: "{kw:altar}: build 3 different altars to win",
  },
};

