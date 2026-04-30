import type { GreyDef } from "../../types.js";

export const plan: GreyDef = {
  id: "plan",
  type: "grey",
  cost: 4,
  colors: [],
  count: 4,
  ability: "plan",
  name: { ru: "План", en: "Plan" },
  description: {
    ru: "Откройте 2 карты — выберите 1 в руку. Повторите ещё раз. Остальные возвращаются в колоду",
    en: "Reveal 2 cards — pick 1 to hand. Repeat once more. Rejected cards return to the deck",
  },
};
