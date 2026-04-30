import type { PurpleSpecialDef } from "../../types.js";

export const salvageYard: PurpleSpecialDef = {
  id: "salvageYard",
  type: "purple",
  cost: 3,
  colors: ["purple"],
  ability: "salvage_yard",
  emoji: "♻️",
  name: { ru: "Утиль цех", en: "Salvage Yard" },
  description: {
    ru: "Когда любой ваш квартал разрушен — +1🃏 и +⌈cost/2⌉💰 (срабатывает и при разрушении самого Утиль цеха)",
    en: "When any of your districts is destroyed — gain 1 card and ⌈cost/2⌉💰 (triggers on its own destruction too)",
  },
};
