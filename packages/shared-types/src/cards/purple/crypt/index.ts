import type { PurpleSpecialDef } from "../../types.js";

export const crypt: PurpleSpecialDef = {
  id: "crypt",
  type: "purple",
  cost: 4,
  colors: ["purple"],
  ability: "crypt",
  emoji: "⚰️",
  name: { ru: "Склеп", en: "Crypt" },
  description: {
    ru: "{kw:activate} Самоуничтожение за 2💰. При любом разрушении: +2 случайные фиолетовые карты",
    en: "{kw:activate} Self-destroy for 2💰. On any destroy: +2 random purple cards",
  },
};

