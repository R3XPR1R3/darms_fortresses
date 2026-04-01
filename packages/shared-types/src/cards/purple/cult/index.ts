import type { PurpleSpecialDef } from "../../types.js";

export const cult: PurpleSpecialDef = {
  id: "cult",
  type: "purple",
  cost: 2,
  colors: ["purple", "blue"],
  ability: "cult",
  emoji: "🕯️",
  name: { ru: "Секта", en: "Cult" },
  description: {
    ru: "Только Клерик: {kw:activate} заменяет случайный квартал случайного игрока",
    en: "Cleric only: {kw:activate} replace random district of random player",
  },
};

