// ============ Card Registry ============
// Single source of truth for all card data.
// Every card lives in its own folder; this file collects them.

export type { I18nText, DistrictDef, PurpleBasicDef, PurpleSpecialDef, SpellDef, SpecialDef, GreyDef, AnyCardDef } from "./types.js";

// ---- Districts (yellow / blue / green / red / multi) ----
export { watchtower } from "./districts/watchtower/index.js";
export { throneRoom } from "./districts/throne_room/index.js";
export { palace } from "./districts/palace/index.js";
export { guardBarracks } from "./districts/guard_barracks/index.js";
export { royalGarden } from "./districts/royal_garden/index.js";

export { temple } from "./districts/temple/index.js";
export { chapel } from "./districts/chapel/index.js";
export { monastery } from "./districts/monastery/index.js";
export { cathedral } from "./districts/cathedral/index.js";
export { sanctuary } from "./districts/sanctuary/index.js";

export { tavern } from "./districts/tavern/index.js";
export { market } from "./districts/market/index.js";
export { tradingPost } from "./districts/trading_post/index.js";
export { harbor } from "./districts/harbor/index.js";
export { townHall } from "./districts/town_hall/index.js";

export { outpost } from "./districts/outpost/index.js";
export { prison } from "./districts/prison/index.js";
export { fortress } from "./districts/fortress/index.js";
export { arsenal } from "./districts/arsenal/index.js";
export { citadel } from "./districts/citadel/index.js";

export { tradeChamber } from "./districts/trade_chamber/index.js";
export { warCouncil } from "./districts/war_council/index.js";

// ---- Purple special (drafted, with abilities) ----
export { cannon } from "./purple/cannon/index.js";
export { stronghold } from "./purple/stronghold/index.js";
export { monument } from "./purple/monument/index.js";
export { highway } from "./purple/highway/index.js";
export { cityGates } from "./purple/city_gates/index.js";
export { crypt } from "./purple/crypt/index.js";
export { tntStorage } from "./purple/tnt_storage/index.js";
export { mine } from "./purple/mine/index.js";
export { cult } from "./purple/cult/index.js";
export { altarDarkness } from "./purple/altar_darkness/index.js";
export { observatory } from "./purple/observatory/index.js";
export { salvageYard } from "./purple/salvage_yard/index.js";
export { hospital } from "./purple/hospital/index.js";
export { innerWall } from "./purple/inner_wall/index.js";
export { heavyArtillery } from "./purple/heavy_artillery/index.js";

// ---- Spells ----
export { ignite } from "./spells/ignite/index.js";
export { goldRain } from "./spells/gold_rain/index.js";
export { holyDay } from "./spells/holy_day/index.js";
export { flood } from "./spells/flood/index.js";
export { plague } from "./spells/plague/index.js";
export { flame } from "./spells/flame/index.js";
export { fireMagic } from "./spells/fire_magic/index.js";
export { bombardment } from "./spells/bombardment/index.js";
export { enhancement } from "./spells/enhancement/index.js";

// ---- Grey (in shared deck, played from hand) ----
export { newOpportunities } from "./grey/new_opportunities/index.js";
export { plan } from "./grey/plan/index.js";
export { burningDeadline } from "./grey/burning_deadline/index.js";

// ---- Aggregated collections ----
import { watchtower } from "./districts/watchtower/index.js";
import { throneRoom } from "./districts/throne_room/index.js";
import { palace } from "./districts/palace/index.js";
import { guardBarracks } from "./districts/guard_barracks/index.js";
import { royalGarden } from "./districts/royal_garden/index.js";
import { temple } from "./districts/temple/index.js";
import { chapel } from "./districts/chapel/index.js";
import { monastery } from "./districts/monastery/index.js";
import { cathedral } from "./districts/cathedral/index.js";
import { sanctuary } from "./districts/sanctuary/index.js";
import { tavern } from "./districts/tavern/index.js";
import { market } from "./districts/market/index.js";
import { tradingPost } from "./districts/trading_post/index.js";
import { harbor } from "./districts/harbor/index.js";
import { townHall } from "./districts/town_hall/index.js";
import { outpost } from "./districts/outpost/index.js";
import { prison } from "./districts/prison/index.js";
import { fortress } from "./districts/fortress/index.js";
import { arsenal } from "./districts/arsenal/index.js";
import { citadel } from "./districts/citadel/index.js";
import { tradeChamber } from "./districts/trade_chamber/index.js";
import { warCouncil } from "./districts/war_council/index.js";
import { templarOrder } from "./districts/templar_order/index.js";
// Twin districts — same stats as the originals, different names. One folder
// per card so designers can drop unique textures keyed by card id later.
import { watchHut } from "./districts/watch_hut/index.js";
import { garrison } from "./districts/garrison/index.js";
import { audienceHall } from "./districts/audience_hall/index.js";
import { winterGarden } from "./districts/winter_garden/index.js";
import { royalResidence } from "./districts/royal_residence/index.js";
import { oratory } from "./districts/oratory/index.js";
import { holySite } from "./districts/holy_site/index.js";
import { hermitage } from "./districts/hermitage/index.js";
import { reliquary } from "./districts/reliquary/index.js";
import { basilica } from "./districts/basilica/index.js";
import { innHouse } from "./districts/inn_house/index.js";
import { butcherShop } from "./districts/butcher_shop/index.js";
import { merchantYard } from "./districts/merchant_yard/index.js";
import { wharf } from "./districts/wharf/index.js";
import { exchange } from "./districts/exchange/index.js";
import { sentry } from "./districts/sentry/index.js";
import { dungeon } from "./districts/dungeon/index.js";
import { barbican } from "./districts/barbican/index.js";
import { armoury } from "./districts/armoury/index.js";
import { bastion } from "./districts/bastion/index.js";
import { merchantGuild } from "./districts/merchant_guild/index.js";
import { headquarters } from "./districts/headquarters/index.js";
import { hospitallers } from "./districts/hospitallers/index.js";
import { cannon } from "./purple/cannon/index.js";
import { stronghold } from "./purple/stronghold/index.js";
import { monument } from "./purple/monument/index.js";
import { highway } from "./purple/highway/index.js";
import { cityGates } from "./purple/city_gates/index.js";
import { crypt } from "./purple/crypt/index.js";
import { tntStorage } from "./purple/tnt_storage/index.js";
import { mine } from "./purple/mine/index.js";
import { cult } from "./purple/cult/index.js";
import { altarDarkness } from "./purple/altar_darkness/index.js";
import { observatory } from "./purple/observatory/index.js";
import { salvageYard } from "./purple/salvage_yard/index.js";
import { hospital } from "./purple/hospital/index.js";
import { innerWall } from "./purple/inner_wall/index.js";
import { heavyArtillery } from "./purple/heavy_artillery/index.js";
import { ignite } from "./spells/ignite/index.js";
import { goldRain } from "./spells/gold_rain/index.js";
import { holyDay } from "./spells/holy_day/index.js";
import { flood } from "./spells/flood/index.js";
import { plague } from "./spells/plague/index.js";
import { fireRitual } from "./spells/fire_ritual/index.js";
import { fireMagic } from "./spells/fire_magic/index.js";
import { bombardment } from "./spells/bombardment/index.js";
import { enhancement } from "./spells/enhancement/index.js";
import { flame } from "./spells/flame/index.js";
import { fire } from "./spells/fire/index.js";
import { newOpportunities } from "./grey/new_opportunities/index.js";
import { plan } from "./grey/plan/index.js";
import { burningDeadline } from "./grey/burning_deadline/index.js";

import type { DistrictDef, PurpleBasicDef, PurpleSpecialDef, SpellDef, SpecialDef, GreyDef } from "./types.js";

export const ALL_DISTRICTS: readonly DistrictDef[] = [
  // Originals (yellow / blue / green / red / multi)
  watchtower, throneRoom, palace, guardBarracks, royalGarden,
  temple, chapel, monastery, cathedral, sanctuary,
  tavern, market, tradingPost, harbor, townHall,
  outpost, prison, fortress, arsenal, citadel,
  tradeChamber, warCouncil, templarOrder,
  // Twins — same stats, different names — doubles the deck pool
  watchHut, garrison, audienceHall, winterGarden, royalResidence,
  oratory, holySite, hermitage, reliquary, basilica,
  innHouse, butcherShop, merchantYard, wharf, exchange,
  sentry, dungeon, barbican, armoury, bastion,
  merchantGuild, headquarters, hospitallers,
];

/** Purple-basic was retired — its slots were replaced with new ability-bearing
 *  purple-special cards (observatory, salvage_yard, hospital, inner_wall,
 *  heavy_artillery). Kept as an empty array so older readers don't crash. */
export const ALL_PURPLE_BASIC: readonly PurpleBasicDef[] = [];

export const ALL_PURPLE_SPECIAL: readonly PurpleSpecialDef[] = [
  cannon, stronghold, monument, highway, cityGates,
  crypt, tntStorage, mine, cult, altarDarkness,
  observatory, salvageYard, hospital, innerWall, heavyArtillery,
];

export const ALL_SPELLS: readonly SpellDef[] = [
  ignite, goldRain, holyDay, flood, plague, fireRitual,
  fireMagic, bombardment, enhancement,
];

export const ALL_GREY: readonly GreyDef[] = [
  newOpportunities, plan, burningDeadline,
];

export const ALL_SPECIALS: readonly SpecialDef[] = [flame, fire];

/** Lookup: Russian card name → card definition (for translating runtime DistrictCard.name) */
const _nameIndex = new Map<string, DistrictDef | PurpleBasicDef | PurpleSpecialDef | SpellDef | SpecialDef | GreyDef>();
for (const c of [...ALL_DISTRICTS, ...ALL_PURPLE_BASIC, ...ALL_PURPLE_SPECIAL, ...ALL_SPELLS, ...ALL_GREY, ...ALL_SPECIALS]) {
  _nameIndex.set(c.name.ru, c);
}

export function findCardByName(ruName: string) {
  return _nameIndex.get(ruName) ?? null;
}

/** Lookup: ability id → purple special card definition */
const _abilityIndex = new Map<string, PurpleSpecialDef>();
for (const c of ALL_PURPLE_SPECIAL) {
  _abilityIndex.set(c.ability, c);
}

export function findPurpleByAbility(ability: string) {
  return _abilityIndex.get(ability) ?? null;
}

/** Lookup: spell ability id → spell card definition */
const _spellIndex = new Map<string, SpellDef>();
for (const c of ALL_SPELLS) {
  _spellIndex.set(c.ability, c);
}

export function findSpellByAbility(ability: string) {
  return _spellIndex.get(ability) ?? null;
}

/** Lookup: grey ability id → grey card definition */
const _greyIndex = new Map<string, GreyDef>();
for (const c of ALL_GREY) {
  _greyIndex.set(c.ability, c);
}

export function findGreyByAbility(ability: string) {
  return _greyIndex.get(ability) ?? null;
}
