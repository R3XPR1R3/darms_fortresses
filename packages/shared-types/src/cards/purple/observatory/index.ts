import type { PurpleSpecialDef } from "../../types.js";

export const observatory: PurpleSpecialDef = {
  id: "observatory",
  type: "purple",
  cost: 3,
  colors: ["purple"],
  ability: "observatory",
  emoji: "🔭",
  name: { ru: "Обсерватория", en: "Observatory" },
  description: {
    ru: "{kw:activate} Сбросьте 1 карту из руки → возьмите 2 карты",
    en: "{kw:activate} Discard 1 from hand → draw 2",
  },
};
