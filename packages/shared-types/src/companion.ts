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
  Interceptor = "interceptor",
  Agent = "agent",
  // --- Wave 4 (balance / card-draw incentives patch) ---
  MasterOfSiege = "master_of_siege",
  RoyalHealer = "royal_healer",
  Engineer = "engineer",
  Sektant = "sektant",
  Tyrant = "tyrant",
  WaterMage = "water_mage",
  Innovator = "innovator",
  Paladin = "paladin",
  Burglar = "burglar",
  Bandit = "bandit",
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
  { id: CompanionId.Farmer, name: "Фермер", description: "Если у вас нет построек дороже 2💰 — +2💰 в начале хода (пассив)", emoji: "🧑‍🌾", passive: true },
  { id: CompanionId.Treasurer, name: "Торговец", description: "В конце дня богатейший даёт вам 1💰 и 1🃏 (только 🟢)", emoji: "💰", passive: true, heroColor: "green", indicatorColor: "#2ecc71" },
  { id: CompanionId.Hunter, name: "Охотник", description: "За 2💰: противник сбрасывает 2 случайные карты", emoji: "🏹", passive: false, targetType: "player", useCost: 2 },
  { id: CompanionId.Mason, name: "Каменщик", description: "За 1💰: разделяет дорогую карту из руки на две", emoji: "🧱", passive: false, useCost: 1 },
  { id: CompanionId.Saboteur, name: "Диверсант", description: "Компаньон выбранного игрока не работает сегодня", emoji: "💣", passive: false, targetType: "player" },
  { id: CompanionId.Official, name: "Чиновник", description: "Можно строить дубликаты кварталов (только 🔴)", emoji: "📜", passive: true, heroColor: "red" },
  { id: CompanionId.Blacksmith, name: "Кузнец", description: "Меняет квартал на другой за ту же цену, другого цвета", emoji: "⚒️", passive: false, targetType: "any_card" },
  { id: CompanionId.SunPriestess, name: "Жрица солнца", description: "Синие кварталы стоят на 1 меньше (только 🔵)", emoji: "☀️", passive: true, heroColor: "blue" },
  { id: CompanionId.Courier, name: "Курьер", description: "Скорость героя −2", emoji: "📨", passive: true },
  { id: CompanionId.RoyalGuard, name: "Королевский страж", description: "+2💰 за жёлтый квартал. Следующий драфт: выбор из 8 (только 🟡)", emoji: "🛡️", passive: true, heroColor: "yellow", indicatorColor: "#f1c40f" },
  { id: CompanionId.Swindler, name: "Шулер", description: "Доход даёт оба варианта + ещё одно взятие", emoji: "🎰", passive: true },
  { id: CompanionId.Artist, name: "Художник", description: "Все 4 цвета на столе → +6💰", emoji: "🎨", passive: true },
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
  { id: CompanionId.Pyromancer, name: "Пиромант", description: "Подбросьте 🔥 Пламя в руку выбранного игрока И себе. Пламя сжигает 1 карту в конце дня. 3 Пламени сливаются в 🔥 Пожар (1 карта/ход, исчезает в конце дня). Дебафф себе и сопернику!", emoji: "🔥", passive: false, targetType: "player" },
  { id: CompanionId.SunFanatic, name: "Фанатик солнца", description: "Только синие постройки, или 2💰 чтобы заменить компаньона следующего (только 🔵)", emoji: "🌅", passive: false, heroColor: "blue", useCost: 2 },
  { id: CompanionId.Sniper, name: "Снайпер", description: "Навсегда убирает компаньона противника из пула", emoji: "🎯", passive: false, targetType: "player" },
  { id: CompanionId.Knight, name: "Рыцарь", description: "Забирает до 3💰 у богатейшего и отдаёт беднейшему (всё что есть, если меньше 3)", emoji: "⚜️", passive: true },
  { id: CompanionId.Fisherman, name: "Рыбак", description: "За 1💰 строит случайную постройку за 2 (дубликаты)", emoji: "🐟", passive: false, useCost: 1 },
  { id: CompanionId.UnluckyMage, name: "Неудачный маг", description: "За 3💰: сбрасывает случайную карту из руки — все ваши постройки становятся её точной копией. Уходит из пула после использования.", emoji: "💫", passive: false, useCost: 3, leavesPool: true },
  { id: CompanionId.Nobility, name: "Знать", description: "Самый богатый → +4🃏. Не самый богатый → −1🃏 и −2💰", emoji: "👑", passive: true },
  // --- Wave 3 (purple-themed) ---
  { id: CompanionId.TreasureTrader, name: "Торговец сокровищами", description: "Даёт случайную фиолетовую постройку в руку. Уходит из пула", emoji: "💎", passive: false, useCost: 0, leavesPool: true },
  { id: CompanionId.Designer, name: "Дизайнер", description: "Выбранный ваш район превращается в случайную фиолетовую постройку", emoji: "📐", passive: false, targetType: "own_card" },
  { id: CompanionId.Innkeeper, name: "Трактирщик", description: "Покажет все фиолетовые карты противников в руке", emoji: "🍺", passive: false },
  { id: CompanionId.Peacemaker, name: "Миротворец", description: "Разрушает все пушки, склады тротила и секты (без эффектов). Уходит из пула", emoji: "🕊️", passive: false, leavesPool: true },
  { id: CompanionId.Contractor, name: "Заказчик", description: "Назначьте цель-героя. Если Ассасин убивает её в этот день — крадёте фиолетовые карты жертвы", emoji: "📋", passive: false, targetType: "hero" },
  { id: CompanionId.NightShadow, name: "Ночная тень", description: "За 2💰: убейте неназванного персонажа", emoji: "🌑", passive: false, useCost: 2, targetType: "hero" },
  { id: CompanionId.Interceptor, name: "Перехватчик", description: "Если ходите первым — берёте +2 карты, скорость следующего игрока +1", emoji: "🏇", passive: true },
  { id: CompanionId.Agent, name: "Агент", description: "За 1💰: становится копией компаньона выбранного игрока, который ещё не ходил. Работает только если компаньон бесцветный и не Агент — иначе разведка не удалась. Уходит из пула.", emoji: "🕵️", passive: false, targetType: "player", useCost: 1, leavesPool: true },
  // --- Wave 4 (balance / card-draw incentives patch) ---
  { id: CompanionId.MasterOfSiege, name: "Мастер осады", description: "Когда вы стреляете из пушки — все ваши пушки на столе тоже стреляют (1 цель за 1💰, эхо-выстрелы бесплатны)", emoji: "🎯", passive: true, heroColor: "red" },
  { id: CompanionId.RoyalHealer, name: "Королевский лекарь", description: "Если вашего героя убили — вы берёте 2🃏 и 2💰 прежде чем ход уйдёт другому", emoji: "⚕️", passive: true, indicatorColor: "#3498db" },
  { id: CompanionId.Engineer, name: "Инженер", description: "За 1💰: +1 к стоимости вашего квартала (до 3 раз за ход). Только бесцветные герои.", emoji: "🔧", passive: false, useCost: 1, targetType: "own_card" },
  { id: CompanionId.Sektant, name: "Сектант", description: "Торговец: +1💰 за каждую Секту в игре (в конце дня). Клерик: ваши Секты можно активировать дважды за ход.", emoji: "🕯️", passive: true, indicatorColor: "#27ae60" },
  { id: CompanionId.Tyrant, name: "Тиран", description: "Один раз в начале хода: за каждый ваш жёлтый квартал — выстрел (1 урон) по случайной постройке случайного игрока", emoji: "👑", passive: true, indicatorColor: "#e74c3c" },
  { id: CompanionId.WaterMage, name: "Маг воды", description: "За 0💰: тушит всё 🔥 Пламя и 🔥 Пожар во всех руках. +1💰 за каждое потушенное Пламя, +3💰 за каждый Пожар", emoji: "🌊", passive: false, useCost: 0 },
  { id: CompanionId.Innovator, name: "Инноватор", description: "За 2💰: добираете карты пока в руке не станет 5", emoji: "💡", passive: false, useCost: 2 },
  { id: CompanionId.Paladin, name: "Паладин", description: "Генерал может активировать постройки клерика (Секту); Клерик может активировать постройки генерала (Пушку, ТНТ).", emoji: "✝️", passive: true, indicatorColor: "#9b59b6" },
  { id: CompanionId.Burglar, name: "Домушник", description: "Когда Вор обкрадывает героя — вы крадёте также 1 случайную карту из руки жертвы", emoji: "🦝", passive: true },
  { id: CompanionId.Bandit, name: "Разбойник", description: "Превращает кражу Вора в рейд: −1 HP/стоимости 4 случайным кварталам жертвы и +1💰 Вору за каждый удар. Stronghold невосприимчив к урону и не даёт золота.", emoji: "🗡️", passive: true },
] as const;

/** Name constant for flame cards (Pyromancer / Ignite / Fire Ritual). */
export const FLAME_CARD_NAME = "🔥 Пламя";
/** Name constant for fire cards — formed by 3 flames combining. */
export const FIRE_CARD_NAME = "🔥 Пожар";

/** Check if a companion is passive (auto-applied, no action needed) */
export function isPassiveCompanion(id: CompanionId): boolean {
  return COMPANIONS.find((c) => c.id === id)?.passive ?? false;
}
