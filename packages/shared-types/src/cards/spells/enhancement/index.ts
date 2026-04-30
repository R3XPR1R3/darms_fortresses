import type { SpellDef } from "../../types.js";

export const enhancement: SpellDef = {
  id: "enhancement",
  type: "spell",
  cost: 3,
  colors: ["purple"],
  ability: "enhancement",
  count: 1,
  name: { ru: "Усиление", en: "Enhancement" },
  description: {
    ru: "{kw:spell} Выберите эффект (до конца игры): при доходе картой — выбираете +1 карту; при доходе золотом — +1💰. Эффекты складываются от каждой сыгранной Усиление",
    en: "{kw:spell} Choose (permanent): card-income picks +1 extra card OR gold-income gives +1💰. Stacks per casting",
  },
};
