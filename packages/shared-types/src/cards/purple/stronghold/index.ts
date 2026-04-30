import type { PurpleSpecialDef } from "../../types.js";

export const stronghold: PurpleSpecialDef = {
  id: "stronghold",
  type: "purple",
  cost: 4,
  colors: ["purple"],
  ability: "stronghold",
  emoji: "🧱",
  // Display rename: "Bastion" replaces "Stronghold" in the EN client to
  // disambiguate from the Citadel district that previously translated as
  // "Stronghold" via the i18n alias. The card id stays "stronghold" so save
  // games and bot builds keep working.
  name: { ru: "Бастион", en: "Bastion" },
  description: {
    ru: "{kw:protect}: Бастион нельзя разрушить или повредить",
    en: "{kw:protect}: Bastion cannot be destroyed or damaged",
  },
};

