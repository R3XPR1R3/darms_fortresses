import type { SpellDef } from "../../types.js";

export const bombardment: SpellDef = {
  id: "bombardment",
  type: "spell",
  cost: 6,
  colors: ["purple", "red"],
  ability: "bombardment",
  count: 1,
  name: { ru: "Обстрел", en: "Bombardment" },
  description: {
    ru: "{kw:spell} Выберите эффект: 2 выстрела по 3 урона ИЛИ 6 выстрелов по 1 урона по случайным кварталам противников",
    en: "{kw:spell} Choose: 2 shots × 3 damage OR 6 shots × 1 damage at random opponent districts",
  },
};
