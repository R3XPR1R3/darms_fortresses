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
    ru: "{kw:activate} Самоуничтожение за 2💰: 8 урона, распределённого случайно между постройками всех игроков (Цитадель неуязвима)",
    en: "{kw:activate} Self-destroy for 2💰: deal 8 damage spread randomly across every player's districts (Stronghold is immune)",
  },
};

