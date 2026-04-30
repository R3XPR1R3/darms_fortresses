import type { PurpleSpecialDef } from "../../types.js";

export const heavyArtillery: PurpleSpecialDef = {
  id: "heavyArtillery",
  type: "purple",
  cost: 3,
  colors: ["purple", "red"],
  ability: "heavy_artillery",
  emoji: "💥",
  name: { ru: "Тяжёлая артиллерия", en: "Heavy Artillery" },
  description: {
    ru: "{kw:activate} За 3💰: 6 случайных выстрелов по кварталам противников. После залпа стоимость и урон −1 (один залп за ход)",
    en: "{kw:activate} 3💰: fire 6 random shots at opponent districts. After the volley, cost and damage drop by 1 (one volley per turn)",
  },
};
