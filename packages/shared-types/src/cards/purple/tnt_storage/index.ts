import type { PurpleSpecialDef } from "../../types.js";

export const tntStorage: PurpleSpecialDef = {
  id: "tntStorage",
  type: "purple",
  cost: 2,
  colors: ["purple"],
  ability: "tnt_storage",
  emoji: "🧨",
  name: { ru: "Склад тротила", en: "TNT Storage" },
  description: {
    ru: "{kw:activate} Самоуничтожение за 2💰: {kw:destroy} 2 случайных квартала у каждого",
    en: "{kw:activate} Self-destroy for 2💰: {kw:destroy} 2 random districts per player",
  },
};

