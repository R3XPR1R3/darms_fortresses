import type { PurpleSpecialDef } from "../../types.js";

export const mine: PurpleSpecialDef = {
  id: "mine",
  type: "purple",
  cost: 3,
  colors: ["purple", "green"],
  ability: "mine",
  emoji: "⛏️",
  name: { ru: "Шахта", en: "Mine" },
  description: {
    ru: "+1💰 в конце дня для всех. Казначей также получает +1💰 в конце каждого хода",
    en: "+1💰 at end of day for everyone. Treasurer also gets +1💰 at end of each turn",
  },
};

