import type { CardColor } from "../hero.js";
import type { PurpleAbility, SpellAbility } from "../card.js";

export interface I18nText {
  ru: string;
  en: string;
  id?: string;
}

/** Base definition shared by all card types */
interface CardBase {
  id: string;
  cost: number;
  colors: CardColor[];
  name: I18nText;
}

/** Regular district card (yellow, blue, green, red, multi-color) */
export interface DistrictDef extends CardBase {
  type: "district";
  count: number;
}

/** Purple basic card (in deck, no special ability) */
export interface PurpleBasicDef extends CardBase {
  type: "purple_basic";
  count: number;
}

/** Purple special card (drafted separately, has ability) */
export interface PurpleSpecialDef extends CardBase {
  type: "purple";
  ability: PurpleAbility;
  emoji: string;
  description: I18nText;
}

/** Spell card (one-shot, cast from hand) */
export interface SpellDef extends CardBase {
  type: "spell";
  ability: SpellAbility;
  count: number;
  description: I18nText;
}

/** Special generated card (flame, etc.) */
export interface SpecialDef extends CardBase {
  type: "special";
  description?: I18nText;
}

export type AnyCardDef = DistrictDef | PurpleBasicDef | PurpleSpecialDef | SpellDef | SpecialDef;
