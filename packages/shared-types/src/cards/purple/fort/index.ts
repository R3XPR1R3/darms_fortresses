import type { PurpleSpecialDef } from "../../types.js";

export const fort: PurpleSpecialDef = {
  id: "fort",
  type: "purple",
  cost: 1,
  colors: ["purple"],
  ability: "fort",
  emoji: "🏰",
  name: { ru: "Оборонительный форт", en: "Defensive Fort" },
  description: {
    ru: "Другие постройки −1 HP. При разрушении получаете золото",
    en: "Other districts get −1 HP. Refund gold when destroyed",
  },
};

