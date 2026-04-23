import { CompanionId } from "./companion.js";
import { HeroId } from "./hero.js";
import type { MatchDeckBuild } from "./game-state.js";

/** A named bot archetype: deck-build plus hero preferences for draft. */
export interface BotBuild {
  id: string;
  name: string;
  build: MatchDeckBuild;
  /** Heroes the bot should weight higher during hero draft (top → bottom). */
  preferredHeroes: HeroId[];
}

/**
 * 12 preset bot archetypes. Each is a coherent strategy that leads to one of the
 * win conditions (8 districts or 4 altars), with spells included as situational
 * utility. No mono-stacks — variety is intentional for strategic depth.
 */
export const BOT_BUILDS: readonly BotBuild[] = [
  {
    id: "king_path",
    name: "Путь Короля",
    build: {
      purple: ["city_gates", "city_gates", "mine", "fort", "cult", "gold_rain"],
      companions: [CompanionId.RoyalGuard, CompanionId.Treasurer, CompanionId.Nobility],
    },
    preferredHeroes: [HeroId.King, HeroId.Merchant],
  },
  {
    id: "altar_rush",
    name: "Алтарь тьмы",
    build: {
      purple: ["altar_darkness", "altar_darkness", "altar_darkness", "altar_darkness", "crypt", "ignite"],
      companions: [CompanionId.Official, CompanionId.Marauder, CompanionId.Gravedigger],
    },
    preferredHeroes: [HeroId.General, HeroId.Architect],
  },
  {
    id: "cannon_siege",
    name: "Канонная осада",
    build: {
      purple: ["cannon", "cannon", "cannon", "fort", "tnt_storage", "ignite"],
      companions: [CompanionId.Cannoneer, CompanionId.Hunter, CompanionId.Sniper],
    },
    preferredHeroes: [HeroId.General, HeroId.Assassin],
  },
  {
    id: "tnt_saboteur",
    name: "Диверсант ТНТ",
    build: {
      purple: ["tnt_storage", "tnt_storage", "cannon", "fort", "plague", "flood"],
      companions: [CompanionId.Saboteur, CompanionId.Peacemaker, CompanionId.Blacksmith],
    },
    preferredHeroes: [HeroId.General, HeroId.Thief],
  },
  {
    id: "golden_miners",
    name: "Золотые шахты",
    build: {
      purple: ["mine", "mine", "mine", "stronghold", "monument", "gold_rain"],
      companions: [CompanionId.Farmer, CompanionId.Treasurer, CompanionId.StrangeMerchant],
    },
    preferredHeroes: [HeroId.Merchant, HeroId.Architect],
  },
  {
    id: "fortress_wall",
    name: "Крепостная стена",
    build: {
      purple: ["fort", "fort", "stronghold", "stronghold", "monument", "holy_day"],
      companions: [CompanionId.Druid, CompanionId.Artist, CompanionId.Peacemaker],
    },
    preferredHeroes: [HeroId.Architect, HeroId.King],
  },
  {
    id: "blue_cult",
    name: "Синяя секта",
    build: {
      purple: ["cult", "cult", "cult", "stronghold", "plague", "holy_day"],
      companions: [CompanionId.SunPriestess, CompanionId.Druid, CompanionId.SunFanatic],
    },
    preferredHeroes: [HeroId.Cleric, HeroId.Sorcerer],
  },
  {
    id: "speed_sprint",
    name: "Скоростной спринт",
    build: {
      purple: ["highway", "highway", "highway", "monument", "mine", "gold_rain"],
      companions: [CompanionId.Artist, CompanionId.Courier, CompanionId.Bard],
    },
    preferredHeroes: [HeroId.Thief, HeroId.Assassin],
  },
  {
    id: "necropolis",
    name: "Некрополь",
    build: {
      purple: ["crypt", "crypt", "crypt", "fort", "stronghold", "plague"],
      companions: [CompanionId.Gravedigger, CompanionId.Reconstructor, CompanionId.Marauder],
    },
    preferredHeroes: [HeroId.Assassin, HeroId.Thief],
  },
  {
    id: "universal",
    name: "Универсал",
    build: {
      purple: ["cannon", "tnt_storage", "fort", "mine", "cult", "altar_darkness"],
      companions: [CompanionId.Designer, CompanionId.Alchemist, CompanionId.Innkeeper],
    },
    preferredHeroes: [HeroId.Architect, HeroId.Sorcerer],
  },
  {
    id: "lazy_tycoon",
    name: "Ленивый богач",
    build: {
      purple: ["highway", "highway", "mine", "mine", "stronghold", "gold_rain"],
      companions: [CompanionId.Farmer, CompanionId.Courier, CompanionId.RoyalGuard],
    },
    preferredHeroes: [HeroId.Merchant, HeroId.Assassin],
  },
  {
    id: "night_assassins",
    name: "Ночь убийц",
    build: {
      purple: ["fort", "fort", "crypt", "crypt", "cannon", "ignite"],
      companions: [CompanionId.NightShadow, CompanionId.Contractor, CompanionId.Marauder],
    },
    preferredHeroes: [HeroId.Assassin, HeroId.Thief],
  },
] as const;

export function pickRandomBotBuild(rng: () => number): BotBuild {
  const idx = Math.floor(rng() * BOT_BUILDS.length);
  return BOT_BUILDS[Math.max(0, Math.min(BOT_BUILDS.length - 1, idx))];
}
