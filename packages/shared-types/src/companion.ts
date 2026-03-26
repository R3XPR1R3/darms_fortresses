/** Companion identifiers */
export enum CompanionId {
  Farmer = "farmer",
  Treasurer = "treasurer",
  Hunter = "hunter",
  Mason = "mason",
  Saboteur = "saboteur",
  Official = "official",
  Blacksmith = "blacksmith",
  SunPriestess = "sun_priestess",
  Courier = "courier",
  RoyalGuard = "royal_guard",
  Swindler = "swindler",
  Artist = "artist",
  Druid = "druid",
  Marauder = "marauder",
  Bard = "bard",
  Alchemist = "alchemist",
}

export interface CompanionDefinition {
  id: CompanionId;
  name: string;
  description: string;
  emoji: string;
  /** If true, effect applies automatically — no use_companion action needed */
  passive: boolean;
  /** What kind of target is needed for active companions */
  targetType?: "player" | "own_card" | "any_card";
  /** Gold cost to activate (0 = free) */
  useCost?: number;
  /** Hero color restriction — companion only works if hero has this color */
  heroColor?: "yellow" | "blue" | "green" | "red";
  /** Indicator circle color (CSS color). If set, overrides default blue/red */
  indicatorColor?: string;
}

export const COMPANIONS: readonly CompanionDefinition[] = [
  {
    id: CompanionId.Farmer,
    name: "Фермер",
    description: "+1 золото",
    emoji: "🧑‍🌾",
    passive: false,
  },
  {
    id: CompanionId.Treasurer,
    name: "Казначей",
    description: "В конце дня богатейший даёт вам 1💰 и 1🃏",
    emoji: "💰",
    passive: true,
    indicatorColor: "#2ecc71",
  },
  {
    id: CompanionId.Hunter,
    name: "Охотник",
    description: "За 2💰: противник сбрасывает 2 случайные карты",
    emoji: "🏹",
    passive: false,
    targetType: "player",
    useCost: 2,
  },
  {
    id: CompanionId.Mason,
    name: "Каменщик",
    description: "За 1💰: разделяет дорогую карту из руки на две",
    emoji: "🧱",
    passive: false,
    useCost: 1,
  },
  {
    id: CompanionId.Saboteur,
    name: "Диверсант",
    description: "Компаньон выбранного игрока не работает сегодня",
    emoji: "💣",
    passive: false,
    targetType: "player",
  },
  {
    id: CompanionId.Official,
    name: "Чиновник",
    description: "Можно строить дубликаты кварталов (только 🔴)",
    emoji: "📜",
    passive: true,
    heroColor: "red",
  },
  {
    id: CompanionId.Blacksmith,
    name: "Кузнец",
    description: "Меняет квартал на другой за ту же цену, другого цвета",
    emoji: "⚒️",
    passive: false,
    targetType: "any_card",
  },
  {
    id: CompanionId.SunPriestess,
    name: "Жрица солнца",
    description: "Синие кварталы стоят на 1 меньше (только 🔵)",
    emoji: "☀️",
    passive: true,
    heroColor: "blue",
  },
  {
    id: CompanionId.Courier,
    name: "Курьер",
    description: "Скорость героя −2",
    emoji: "📨",
    passive: true,
  },
  {
    id: CompanionId.RoyalGuard,
    name: "Королевский страж",
    description: "+2💰 за жёлтый квартал. Следующий драфт: выбор из 8",
    emoji: "🛡️",
    passive: true,
    indicatorColor: "#f1c40f",
  },
  {
    id: CompanionId.Swindler,
    name: "Шулер",
    description: "Доход даёт оба варианта + ещё одно взятие",
    emoji: "🎰",
    passive: true,
  },
  {
    id: CompanionId.Artist,
    name: "Художник",
    description: "Все 4 цвета на столе → +4💰",
    emoji: "🎨",
    passive: true,
  },
  {
    id: CompanionId.Druid,
    name: "Друид",
    description: "Все взятые карты становятся двухцветными",
    emoji: "🌿",
    passive: true,
  },
  {
    id: CompanionId.Marauder,
    name: "Мародёр",
    description: "При убийстве героя — крадёте его карты",
    emoji: "⚔️",
    passive: true,
  },
  {
    id: CompanionId.Bard,
    name: "Бард",
    description: "Убирает компаньона выбранного игрока (цена растёт)",
    emoji: "🎵",
    passive: false,
    targetType: "player",
    useCost: 1,
  },
  {
    id: CompanionId.Alchemist,
    name: "Алхимик",
    description: "Превращает ваш квартал в случайный на 1 дороже (макс 5)",
    emoji: "⚗️",
    passive: false,
    targetType: "own_card",
  },
] as const;

/** Check if a companion is passive (auto-applied, no action needed) */
export function isPassiveCompanion(id: CompanionId): boolean {
  return COMPANIONS.find((c) => c.id === id)?.passive ?? false;
}
