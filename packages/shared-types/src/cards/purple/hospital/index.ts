import type { PurpleSpecialDef } from "../../types.js";

export const hospital: PurpleSpecialDef = {
  id: "hospital",
  type: "purple",
  cost: 4,
  colors: ["purple"],
  ability: "hospital",
  emoji: "🏥",
  name: { ru: "Госпиталь", en: "Hospital" },
  description: {
    ru: "Если ваш герой убит — вы можете взять доход и использовать компаньона (но не строить и не использовать пассивку героя)",
    en: "If your hero is assassinated — you can still take income and use your companion (no building, no passive hero ability)",
  },
};
