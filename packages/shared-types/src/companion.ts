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
  // --- Wave 2 ---
  Cannoneer = "cannoneer",
  Reconstructor = "reconstructor",
  DubiousDealer = "dubious_dealer",
  SorcererApprentice = "sorcerer_apprentice",
  StrangeMerchant = "strange_merchant",
  Gravedigger = "gravedigger",
  Jester = "jester",
  Pyromancer = "pyromancer",
  SunFanatic = "sun_fanatic",
  Sniper = "sniper",
  Knight = "knight",
  Fisherman = "fisherman",
  UnluckyMage = "unlucky_mage",
  Nobility = "nobility",
  // --- Wave 3 (purple-themed) ---
  TreasureTrader = "treasure_trader",
  Designer = "designer",
  Innkeeper = "innkeeper",
  Peacemaker = "peacemaker",
  Contractor = "contractor",
  NightShadow = "night_shadow",
}

export interface CompanionDefinition {
  id: CompanionId;
  name: string;
  description: string;
  emoji: string;
  /** If true, effect applies automatically — no use_companion action needed */
  passive: boolean;
  /** What kind of target is needed for active companions */
  targetType?: "player" | "own_card" | "any_card" | "own_hand_card" | "hero";
  /** Gold cost to activate (0 = free) */
  useCost?: number;
  /** Hero color restriction — companion only works if hero has this color */
  heroColor?: "yellow" | "blue" | "green" | "red";
  /** Indicator circle color (CSS color). If set, overrides default blue/red */
  indicatorColor?: string;
  /** If true, companion is permanently removed from pool after use */
  leavesPool?: boolean;
}

export const COMPANIONS: readonly CompanionDefinition[] = [
  // --- Wave 1 ---
  { id: CompanionId.Farmer, name: "Фермер", description: "+1 золото", emoji: "🧑‍🌾", passive: false },
  { id: CompanionId.Treasurer, name: "Казначей", description: "В конце дня богатейший даёт вам 1💰 и 1🃏 (только 🟢)", emoji: "💰", passive: true, heroColor: "green", indicatorColor: "#2ecc71" },
  { id: CompanionId.Hunter, name: "Охотник", description: "За 2💰: противник сбрасывает 2 случайные карты", emoji: "🏹", passive: false, targetType: "player", useCost: 2 },
  { id: CompanionId.Mason, name: "Каменщик", description: "За 1💰: разделяет дорогую карту из руки на две", emoji: "🧱", passive: false, useCost: 1 },
  { id: CompanionId.Saboteur, name: "Диверсант", description: "Компаньон выбранного игрока не работает сегодня", emoji: "💣", passive: false, targetType: "player" },
  { id: CompanionId.Official, name: "Чиновник", description: "Можно строить дубликаты кварталов (только 🔴)", emoji: "📜", passive: true, heroColor: "red" },
  { id: CompanionId.Blacksmith, name: "Кузнец", description: "Меняет квартал на другой за ту же цену, другого цвета", emoji: "⚒️", passive: false, targetType: "any_card" },
  { id: CompanionId.SunPriestess, name: "Жрица солнца", description: "Синие кварталы стоят на 1 меньше (только 🔵)", emoji: "☀️", passive: true, heroColor: "blue" },
  { id: CompanionId.Courier, name: "Курьер", description: "Скорость героя −2", emoji: "📨", passive: true },
  { id: CompanionId.RoyalGuard, name: "Королевский страж", description: "+2💰 за жёлтый квартал. Следующий драфт: выбор из 8 (только 🟡)", emoji: "🛡️", passive: true, heroColor: "yellow", indicatorColor: "#f1c40f" },
  { id: CompanionId.Swindler, name: "Шулер", description: "Доход даёт оба варианта + ещё одно взятие", emoji: "🎰", passive: true },
  { id: CompanionId.Artist, name: "Художник", description: "Все 4 цвета на столе → +4💰", emoji: "🎨", passive: true },
  { id: CompanionId.Druid, name: "Друид", description: "Все взятые карты становятся двухцветными", emoji: "🌿", passive: true },
  { id: CompanionId.Marauder, name: "Мародёр", description: "При убийстве героя — крадёте его карты", emoji: "⚔️", passive: true },
  { id: CompanionId.Bard, name: "Бард", description: "Убирает компаньона выбранного игрока (цена растёт)", emoji: "🎵", passive: false, targetType: "player", useCost: 1 },
  { id: CompanionId.Alchemist, name: "Алхимик", description: "Превращает ваш квартал в случайный на 1 дороже (макс 5)", emoji: "⚗️", passive: false, targetType: "own_card" },
  // --- Wave 2 ---
  { id: CompanionId.Cannoneer, name: "Канонир", description: "Сжигает карту из руки, снижает HP квартала противника на 2 (только 🔴)", emoji: "💥", passive: false, targetType: "own_hand_card", heroColor: "red" },
  { id: CompanionId.Reconstructor, name: "Реконструктор", description: "За 2💰 строит разрушенный квартал. Уходит из пула", emoji: "🏗️", passive: false, useCost: 2, leavesPool: true },
  { id: CompanionId.DubiousDealer, name: "Сомнительный делец", description: "Перекрашивает все карты и кварталы в случайный цвет. Уходит", emoji: "🃏", passive: false, leavesPool: true },
  { id: CompanionId.SorcererApprentice, name: "Ученик чародея", description: "За 2💰 строит случайный сброшенный квартал", emoji: "🔮", passive: false, useCost: 2 },
  { id: CompanionId.StrangeMerchant, name: "Странный торговец", description: "Сбрасывает карту из руки и получает её стоимость (только 🟢). Уходит", emoji: "🧳", passive: false, targetType: "own_hand_card", heroColor: "green", leavesPool: true },
  { id: CompanionId.Gravedigger, name: "Могильщик", description: "При убийстве героя — получаете его способность", emoji: "⚰️", passive: true },
  { id: CompanionId.Jester, name: "Шут", description: "Перемешивает карты всех игроков (только 🟡). Дебафф!", emoji: "🤡", passive: true, heroColor: "yellow" },
  { id: CompanionId.Pyromancer, name: "Пиромант", description: "Карта из руки → 🔥Пламя. В конце хода пламя множится. Дебафф!", emoji: "🔥", passive: false, targetType: "own_hand_card" },
  { id: CompanionId.SunFanatic, name: "Фанатик солнца", description: "Только синие постройки, или 2💰 чтобы заменить компаньона следующего (только 🔵)", emoji: "🌅", passive: false, heroColor: "blue", useCost: 2 },
  { id: CompanionId.Sniper, name: "Снайпер", description: "Навсегда убирает компаньона противника из пула", emoji: "🎯", passive: false, targetType: "player" },
  { id: CompanionId.Knight, name: "Рыцарь", description: "Забирает 1💰 у богатейшего, отдаёт беднейшему", emoji: "⚜️", passive: true },
  { id: CompanionId.Fisherman, name: "Рыбак", description: "За 1💰 строит случайную постройку за 2 (дубликаты)", emoji: "🐟", passive: false, useCost: 1 },
  { id: CompanionId.UnluckyMage, name: "Неудачный маг", description: "Сбрасывает карту — все постройки превращаются в неё. Дебафф!", emoji: "💫", passive: false, targetType: "own_hand_card" },
  { id: CompanionId.Nobility, name: "Знать", description: "Самый богатый → +1🃏. Не самый богатый → −1🃏 и −1💰", emoji: "👑", passive: true },
  // --- Wave 3 (purple-themed) ---
  { id: CompanionId.TreasureTrader, name: "Торговец сокровищами", description: "Можно выбрать вторую фиолетовую карту. Уходит из пула", emoji: "💎", passive: true, leavesPool: true },
  { id: CompanionId.Designer, name: "Дизайнер", description: "Выбранный район превращается в случайную фиолетовую карту в следующем фиолетовом драфте", emoji: "📐", passive: false, targetType: "own_card" },
  { id: CompanionId.Innkeeper, name: "Трактирщик", description: "Покажет все фиолетовые карты противников в руке", emoji: "🍺", passive: false },
  { id: CompanionId.Peacemaker, name: "Миротворец", description: "Разрушает все пушки, склады тротила и секты (без эффектов). Уходит из пула", emoji: "🕊️", passive: false, leavesPool: true },
  { id: CompanionId.Contractor, name: "Заказчик", description: "При убийстве цели — крадёте все фиолетовые карты жертвы", emoji: "📋", passive: true },
  { id: CompanionId.NightShadow, name: "Ночная тень", description: "За 2💰: убейте неназванного персонажа", emoji: "🌑", passive: false, useCost: 2, targetType: "hero" },
] as const;

/** Name constant for flame cards (Pyromancer) */
export const FLAME_CARD_NAME = "🔥 Пламя";

/** Check if a companion is passive (auto-applied, no action needed) */
export function isPassiveCompanion(id: CompanionId): boolean {
  return COMPANIONS.find((c) => c.id === id)?.passive ?? false;
}
