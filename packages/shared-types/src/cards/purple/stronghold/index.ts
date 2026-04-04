import type { PurpleSpecialDef } from "../../types.js";

export const stronghold: PurpleSpecialDef = {
  id: "stronghold",
  type: "purple",
  cost: 4,
  colors: ["purple"],
  ability: "stronghold",
  emoji: "🧱",
  name: { ru: "Укрепрайон", en: "Stronghold" },
  description: {
    ru: "{kw:protect}: нельзя разрушить или повредить",
    en: "{kw:protect}: cannot be destroyed or damaged",
  },
};

