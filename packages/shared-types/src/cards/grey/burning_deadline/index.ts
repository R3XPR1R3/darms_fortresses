import type { GreyDef } from "../../types.js";

export const burningDeadline: GreyDef = {
  id: "burningDeadline",
  type: "grey",
  cost: 1,
  colors: [],
  count: 4,
  ability: "burning_deadline",
  name: { ru: "Горящий срок", en: "Burning Deadline" },
  description: {
    ru: "Возьмите 1 карту. Если вы не построите её на этом ходу — она превратится в 🔥 Пламя",
    en: "Draw 1 card. If you do not build it this turn, it transforms into 🔥 Flame",
  },
};
