import type { PurpleSpecialDef } from "../../types.js";

export const cannon: PurpleSpecialDef = {
  id: "cannon",
  type: "purple",
  cost: 2,
  colors: ["purple", "red"],
  ability: "cannon",
  emoji: "💣",
  name: { ru: "Пушка", en: "Cannon" },
  description: {
    ru: "{kw:activate} За 1💰: −1 HP случайному кварталу противника (без ограничений)",
    en: "{kw:activate} 1💰: deal 1 damage to random enemy district (unlimited uses)",
  },
};

