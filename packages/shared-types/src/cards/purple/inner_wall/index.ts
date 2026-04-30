import type { PurpleSpecialDef } from "../../types.js";

export const innerWall: PurpleSpecialDef = {
  id: "innerWall",
  type: "purple",
  cost: 4,
  colors: ["purple"],
  ability: "inner_wall",
  emoji: "🧱",
  name: { ru: "Внутренняя стена", en: "Inner Wall" },
  description: {
    ru: "При постройке: уничтожает ваш случайный квартал и прибавляет его стоимость к собственной",
    en: "On build: destroys one of your random districts and absorbs its cost into its own value",
  },
};
