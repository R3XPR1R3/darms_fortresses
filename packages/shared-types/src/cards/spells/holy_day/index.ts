import type { SpellDef } from "../../types.js";

export const holyDay: SpellDef = {
  id: "holyDay",
  type: "spell",
  cost: 1,
  colors: ["purple"],
  ability: "holy_day",
  count: 2,
  name: { ru: "Священный день", en: "Holy Day" },
  description: {
    ru: "{kw:spell} Все кварталы временно становятся 🔵 синими до конца дня",
    en: "{kw:spell} All districts temporarily become 🔵 blue until end of day",
  },
};

