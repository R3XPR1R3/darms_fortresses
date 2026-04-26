import type { SpecialDef } from "../../types.js";

/**
 * Fire — appears when 3 Flames combine in a hand. Discards a random non-flame
 * non-fire card from the owner's hand at the END OF EACH TURN, and self-removes
 * at end of day. Owner can pay 3💰 to "play" it and clear the burn early.
 */
export const fire: SpecialDef = {
  id: "fire",
  type: "special",
  cost: 3,
  colors: ["red"],
  name: { ru: "🔥 Пожар", en: "🔥 Fire" },
};
