import type { GreyDef } from "../../types.js";

export const newOpportunities: GreyDef = {
  id: "newOpportunities",
  type: "grey",
  cost: 2,
  colors: [],
  count: 8,
  ability: "new_opportunities",
  name: { ru: "Новые возможности", en: "New Opportunities" },
  description: {
    ru: "Возьмите 2 случайные карты из колоды",
    en: "Draw 2 random cards from the deck",
  },
};
