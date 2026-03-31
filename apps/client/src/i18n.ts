// ---- Internationalization module ----

export type Lang = "en" | "ru" | "id";

const LANGS: Lang[] = ["en", "ru", "id"];
const savedLang = localStorage.getItem("darms_lang") as Lang | null;
let currentLang: Lang = savedLang && LANGS.includes(savedLang) ? savedLang : "en";

export function getLang(): Lang { return currentLang; }

export function setLang(lang: Lang) {
  currentLang = lang;
  localStorage.setItem("darms_lang", lang);
}

// ---- Keyword system (Hearthstone-style) ----

export interface KeywordDef {
  id: string;
  name: TranslationEntry;
  description: TranslationEntry;
  color: string; // CSS color for highlighting
}

export const KEYWORDS: KeywordDef[] = [
  { id: "kill", name: { en: "Kill", ru: "Убийство" }, description: { en: "Target hero skips their entire turn this day.", ru: "Целевой герой пропускает свой ход в этот день." }, color: "#c0392b" },
  { id: "rob", name: { en: "Rob", ru: "Грабёж" }, description: { en: "Steal all gold from the target hero at the start of their turn.", ru: "Забрать всё золото у цели в начале её хода." }, color: "#f39c12" },
  { id: "income", name: { en: "Income", ru: "Доход" }, description: { en: "+1 gold for each district of your hero's color.", ru: "+1 золото за каждый квартал цвета вашего героя." }, color: "#2ecc71" },
  { id: "crown", name: { en: "Crown", ru: "Корона" }, description: { en: "First pick in the next hero draft.", ru: "Первый выбор героя в следующем раунде." }, color: "#f1c40f" },
  { id: "protect", name: { en: "Protection", ru: "Защита" }, description: { en: "Your districts cannot be destroyed or damaged this turn.", ru: "Ваши кварталы нельзя разрушить или повредить в этот ход." }, color: "#3498db" },
  { id: "destroy", name: { en: "Destroy", ru: "Разрушение" }, description: { en: "Remove an opponent's district from the game by paying gold.", ru: "Уничтожить квартал противника, заплатив золотом." }, color: "#e74c3c" },
  { id: "debuff", name: { en: "Debuff", ru: "Дебафф" }, description: { en: "Negative effect — hurts you or all players. Use with caution!", ru: "Негативный эффект — вредит вам или всем. Используйте осторожно!" }, color: "#9b59b6" },
  { id: "leaves", name: { en: "Leaves pool", ru: "Уходит" }, description: { en: "This companion permanently leaves the pool after being used.", ru: "Этот компаньон навсегда покидает пул после использования." }, color: "#7f8c8d" },
  { id: "passive", name: { en: "Passive", ru: "Пассивно" }, description: { en: "Effect triggers automatically — no action needed.", ru: "Эффект срабатывает автоматически — действие не нужно." }, color: "#bdc3c7" },
  { id: "activate", name: { en: "Activate", ru: "Активация" }, description: { en: "Click on the building on your board to trigger its effect.", ru: "Кликните на постройку на вашем поле для активации эффекта." }, color: "#e67e22" },
  { id: "spell", name: { en: "Spell", ru: "Заклинание" }, description: { en: "One-time card played from hand. Does not stay on the board.", ru: "Одноразовая карта, разыгрывается из руки. Не остаётся на столе." }, color: "#8e44ad" },
  { id: "altar", name: { en: "Altar", ru: "Алтарь" }, description: { en: "Alternative win condition: build 3 different altars to win instantly.", ru: "Альтернативная победа: постройте 3 разных алтаря и победите." }, color: "#d4ac0d" },
];

/** Get keyword name in current language */
export function tKeyword(id: string): string {
  const kw = KEYWORDS.find((k) => k.id === id);
  if (!kw) return id;
  return kw.name[currentLang] ?? kw.name.en;
}

/** Get keyword description in current language */
export function tKeywordDesc(id: string): string {
  const kw = KEYWORDS.find((k) => k.id === id);
  if (!kw) return id;
  return kw.description[currentLang] ?? kw.description.en;
}

/** Wrap keyword text in a colored span for inline display */
export function kwHtml(id: string): string {
  const kw = KEYWORDS.find((k) => k.id === id);
  if (!kw) return id;
  const name = kw.name[currentLang] ?? kw.name.en;
  return `<span class="kw" style="color:${kw.color}" data-kw="${id}">${name}</span>`;
}

// ---- Translation dictionary ----
type TranslationEntry = { en: string; ru: string; id?: string };

const dict: Record<string, TranslationEntry> = {
  // Menu
  "menu.subtitle": { en: "Card strategy", ru: "Карточная стратегия" },
  "menu.name_placeholder": { en: "Your name", ru: "Твоё имя" },
  "menu.default_name": { en: "Player", ru: "Игрок" },
  "menu.local": { en: "Local game (with bots)", ru: "Локальная игра (с ботами)" },
  "menu.online_divider": { en: "— online —", ru: "— онлайн —" },
  "menu.create_room": { en: "Create room", ru: "Создать комнату" },
  "menu.join_room": { en: "Join by code", ru: "Войти по коду" },
  "menu.card_pool": { en: "Card pool", ru: "Пул карт", id: "Pool kartu" },

  // Lobby
  "lobby.host": { en: "(host)", ru: "(хост)" },
  "lobby.room_code": { en: "Room code: ", ru: "Код комнаты: " },
  "lobby.share_code": { en: "Share code with friends to join", ru: "Отправь код друзьям для подключения" },
  "lobby.players_count": { en: "players", ru: "игрока" },
  "lobby.add_bot": { en: "Add bot", ru: "Добавить бота" },
  "lobby.start_game": { en: "Start game", ru: "Начать игру" },
  "lobby.waiting_host": { en: "Waiting for host to start...", ru: "Ожидаем запуска хостом..." },
  "lobby.back": { en: "Back", ru: "Назад" },
  "lobby.enter_code": { en: "Enter room code:", ru: "Введи код комнаты:" },
  "lobby.connecting": { en: "Connecting...", ru: "Подключение..." },
  "lobby.you": { en: "You", ru: "Ты" },

  // Draft
  "draft.title": { en: "Hero Draft", ru: "Драфт героев" },
  "draft.banned": { en: "Banned: ", ru: "Забанены: " },
  "draft.hidden": { en: "hidden", ru: "скрытых" },
  "draft.choose_hero": { en: "Choose your hero:", ru: "Выбери героя:" },
  "draft.others_choosing": { en: "Other players are choosing...", ru: "Другие игроки выбирают..." },
  "draft.speed": { en: "Speed", ru: "Скорость" },
  "draft.companion_title": { en: "Choose Companion", ru: "Выбери компаньона" },
  "draft.choose_companion": { en: "Pick a companion for this day:", ru: "Выбери компаньона на этот день:" },

  // Turn banner
  "banner.your_pick": { en: "Your hero pick!", ru: "Твой выбор героя!" },
  "banner.hero_pick": { en: "Hero pick...", ru: "Выбор героя..." },
  "banner.your_turn": { en: "Your turn", ru: "Твой ход" },
  "banner.turn_of": { en: "Turn: ", ru: "Ход: " },
  "banner.day": { en: "Day", ru: "День" },
  "banner.game_over": { en: "Game over", ru: "Игра окончена" },

  // Opponent board
  "opp.label": { en: "Opponent", ru: "Противник" },
  "opp.role_hidden": { en: "Role hidden", ru: "Роль скрыта" },
  "opp.no_districts": { en: "No districts built", ru: "Нет построек" },
  "opp.killed_today": { en: "Killed today", ru: "Убит в этот день" },

  // My board
  "my.label": { en: "You", ru: "Вы" },
  "my.hand": { en: "Hand", ru: "Рука" },
  "my.first": { en: "First!", ru: "Первый!" },
  "my.killed_skip": { en: "You are killed today. Your turn is skipped.", ru: "Вы убиты в этот день. Ваш ход пропущен." },
  "my.waiting": { en: "Waiting for other players...", ru: "Ждём ход других игроков..." },
  "my.passive": { en: "Passive", ru: "Пассивка" },
  "my.gold_income": { en: "+2 Gold", ru: "+2 Золото" },
  "my.draw_card": { en: "Draw 2 cards", ru: "Взять 2 карты" },
  "my.income_pick_hint": { en: "Pick 1 card, the other returns to deck:", ru: "Выбери 1 карту, вторая вернётся в колоду:" },
  "my.end_turn": { en: "End turn", ru: "Завершить ход" },
  "my.build": { en: "Build", ru: "Строить" },
  "my.ability": { en: "Ability", ru: "Способность" },

  // Hero classes
  "class.assassin": { en: "Assassin", ru: "Убийца" },
  "class.thief": { en: "Specialist", ru: "Специалист" },
  "class.sorcerer": { en: "Strategist", ru: "Стратег" },
  "class.king": { en: "Leader", ru: "Лидер" },
  "class.cleric": { en: "Cleric", ru: "Клерик" },
  "class.merchant": { en: "Treasurer", ru: "Казначей" },
  "class.architect": { en: "Architect", ru: "Архитектор" },
  "class.general": { en: "General", ru: "Генерал" },

  // Abilities (short) — now with keyword references
  "ability.assassin": { en: "Kill", ru: "Убийство" },
  "ability.thief": { en: "Rob", ru: "Грабёж" },
  "ability.sorcerer": { en: "Magic", ru: "Магия" },
  "ability.king": { en: "Crown + Income", ru: "Корона + Доход" },
  "ability.cleric": { en: "Protection + Income", ru: "Защита + Доход" },
  "ability.merchant": { en: "Bonus + Income", ru: "Бонус + Доход" },
  "ability.architect": { en: "3 builds per turn", ru: "3 постройки за ход" },
  "ability.general": { en: "Destroy + Income", ru: "Разрушение + Доход" },

  // Ability descriptions (detailed, for draft cards) — with keyword markup {kw:id}
  "ability_desc.assassin": {
    en: "Choose a hero — {kw:kill}: target skips their turn entirely.",
    ru: "Выбери героя — {kw:kill}: цель пропускает свой ход полностью.",
  },
  "ability_desc.thief": {
    en: "Choose a hero — {kw:rob}: steal all their gold when their turn starts.",
    ru: "Выбери героя — {kw:rob}: забираешь всё золото в начале его хода.",
  },
  "ability_desc.sorcerer": {
    en: "Discard 2 cards and draw 3, or swap your hand with another player.",
    ru: "Сбросить 2 карты и взять 3 из колоды, или обменяться рукой с любым игроком.",
  },
  "ability_desc.king": {
    en: "{kw:crown}: first pick next round. {kw:income}: +1💰 per 🟡 district.",
    ru: "{kw:crown}: первый выбор в следующем раунде. {kw:income}: +1💰 за каждый 🟡 квартал.",
  },
  "ability_desc.cleric": {
    en: "{kw:protect}: districts immune this turn. {kw:income}: +1💰 per 🔵 district.",
    ru: "{kw:protect}: кварталы неуязвимы в этот ход. {kw:income}: +1💰 за каждый 🔵 квартал.",
  },
  "ability_desc.merchant": {
    en: "+1💰 bonus automatically. {kw:income}: +1💰 per 🟢 district.",
    ru: "+1💰 бонус автоматически. {kw:income}: +1💰 за каждый 🟢 квартал.",
  },
  "ability_desc.architect": {
    en: "Draw 2 extra cards. Build up to 3 districts this turn instead of 1.",
    ru: "Возьми 2 дополнительные карты. Можешь построить до 3 кварталов за ход вместо 1.",
  },
  "ability_desc.general": {
    en: "{kw:destroy}: pay gold to destroy/damage a district. {kw:income}: +1💰 per 🔴 district.",
    ru: "{kw:destroy}: заплати золото, чтобы разрушить/повредить квартал. {kw:income}: +1💰 за каждый 🔴 квартал.",
  },

  // Ability modals
  "modal.assassin_title": { en: "Kill a character", ru: "Убить персонажа" },
  "modal.assassin_hint": {
    en: "You don't know who took which role. Choose a character — if someone has it, they skip their turn.",
    ru: "Ты не знаешь, кто взял какую роль. Выбери персонажа — если кто-то его взял, он пропустит ход.",
  },
  "modal.thief_title": { en: "Rob a character", ru: "Обокрасть персонажа" },
  "modal.thief_hint": {
    en: "Choose a role — when that character's turn starts, you steal all their gold.",
    ru: "Выбери роль — когда начнётся ход этого персонажа, ты заберёшь всё его золото.",
  },
  "modal.sorcerer_title": { en: "Sorcerer Ability", ru: "Способность Стратега" },
  "modal.sorcerer_hint": {
    en: "Discard 2 random cards and draw 3 from the deck, or swap hands with any player.",
    ru: "Сбросить 2 случайные карты и взять 3 из колоды, или обменяться рукой с любым игроком.",
  },
  "modal.sorcerer_draw": { en: "Discard 2, draw 3", ru: "Сбросить 2, взять 3" },
  "modal.sorcerer_cards": { en: "cards", ru: "карт" },
  "modal.general_title": { en: "Destroy a district", ru: "Разрушить квартал" },
  "modal.general_hint": {
    en: "Spend gold to destroy an opponent's district. Cleric has {kw:protect}.",
    ru: "Потрать золото чтобы разрушить квартал противника. У Клерика {kw:protect}.",
  },
  "modal.general_no_targets": { en: "No available targets", ru: "Нет доступных целей" },
  "modal.general_no_gold": { en: "Not enough gold", ru: "Не хватает золота" },
  "modal.general_at": { en: "from", ru: "у" },

  // Winner
  "winner.title": { en: "won!", ru: "Победил" },
  "winner.to_menu": { en: "To menu", ru: "В меню" },

  // Log
  "log.toggle": { en: "Journal", ru: "Журнал" },
  "log.day": { en: "Day", ru: "День" },

  // Ban list
  "ban.banned": { en: "Banned: ", ru: "Забанены: " },
  "ban.hidden": { en: "hidden", ru: "скрытых" },

  // Language
  "lang.toggle": { en: "RU", ru: "ID", id: "EN" },
  "purple.title": { en: "Purple draft", ru: "Фиолетовый драфт", id: "Draft ungu" },
  "purple.waiting": { en: "Waiting for other players...", ru: "Ожидание других игроков...", id: "Menunggu pemain lain..." },
  "purple.title_day": { en: "Purple draft — Day", ru: "Фиолетовый драфт — День", id: "Draft ungu — Hari" },
  "purple.choose_one": { en: "Choose one of three purple cards:", ru: "Выберите одну из трёх фиолетовых карт:", id: "Pilih satu dari tiga kartu ungu:" },
  "purple.skip": { en: "Skip", ru: "Пропустить", id: "Lewati" },
  "companion.passive": { en: "passive", ru: "авто", id: "pasif" },
  "companion.only_color": { en: "only", ru: "только", id: "hanya" },
  "companion_modal.no_valid_targets": { en: "No valid targets", ru: "Нет подходящих целей", id: "Tidak ada target yang cocok" },
  "companion_modal.no_cards": { en: "No cards", ru: "Нет карт", id: "Tidak ada kartu" },
  "companion_modal.no_upgrade": { en: "No districts to upgrade", ru: "Нет кварталов для улучшения", id: "Tidak ada distrik untuk ditingkatkan" },
  "companion_modal.no_districts": { en: "No districts", ru: "Нет кварталов", id: "Tidak ada distrik" },
  "pool.title": { en: "Card Pool & Guide", ru: "Пул карт и руководство", id: "Pool kartu & panduan" },
  "pool.heroes": { en: "Heroes", ru: "Герои", id: "Hero" },
  "pool.districts": { en: "Districts", ru: "Постройки", id: "Distrik" },
  "pool.companions": { en: "Companions", ru: "Компаньоны", id: "Companion" },
  "pool.special_companions": { en: "Special companions", ru: "Особые компаньоны", id: "Companion khusus" },
  "pool.purple": { en: "Purple cards", ru: "Фиолетовые карты", id: "Kartu ungu" },
  "pool.spells": { en: "Spells", ru: "Заклинания", id: "Mantra" },
  "pool.keywords": { en: "Keywords", ru: "Ключевые слова", id: "Kata kunci" },
  "pool.guide": { en: "How to play", ru: "Как играть", id: "Cara bermain" },
  "pool.close": { en: "Close", ru: "Закрыть", id: "Tutup" },
  "pool.tab.cards": { en: "Cards", ru: "Карты", id: "Kartu" },
  "pool.tab.keywords": { en: "Keywords", ru: "Механики", id: "Mekanik" },
  "pool.tab.guide": { en: "Guide", ru: "Руководство", id: "Panduan" },
};

/** Get translated string */
export function t(key: string): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[currentLang] ?? entry.en;
}

// ---- Hero name translations ----
const HERO_NAMES: Record<string, TranslationEntry> = {
  assassin:  { en: "Assassin",   ru: "Убийца" },
  thief:     { en: "Specialist", ru: "Специалист" },
  sorcerer:  { en: "Strategist", ru: "Стратег" },
  king:      { en: "Leader",     ru: "Лидер" },
  cleric:    { en: "Cleric",     ru: "Клерик" },
  merchant:  { en: "Treasurer",  ru: "Казначей" },
  architect: { en: "Architect",  ru: "Архитектор" },
  general:   { en: "General",    ru: "Генерал" },
};

export function tHero(heroId: string): string {
  const entry = HERO_NAMES[heroId];
  if (!entry) return heroId;
  return entry[currentLang] ?? entry.en;
}

// ---- District name translations ----
const DISTRICT_NAMES: Record<string, TranslationEntry> = {
  // Yellow
  "Сторожевая башня": { en: "Watchtower", ru: "Сторожевая башня" },
  "Тронный зал":      { en: "Throne Room", ru: "Тронный зал" },
  "Дворец":           { en: "Palace", ru: "Дворец" },
  "Казармы стражи":   { en: "Guard Barracks", ru: "Казармы стражи" },
  "Королевский сад":  { en: "Royal Garden", ru: "Королевский сад" },
  // Blue
  "Храм":       { en: "Temple", ru: "Храм" },
  "Часовня":    { en: "Chapel", ru: "Часовня" },
  "Монастырь":  { en: "Monastery", ru: "Монастырь" },
  "Собор":      { en: "Cathedral", ru: "Собор" },
  "Святилище":  { en: "Sanctuary", ru: "Святилище" },
  // Green
  "Таверна":       { en: "Tavern", ru: "Таверна" },
  "Рынок":         { en: "Market", ru: "Рынок" },
  "Торговый пост": { en: "Trading Post", ru: "Торговый пост" },
  "Порт":          { en: "Harbor", ru: "Порт" },
  "Ратуша":        { en: "Town Hall", ru: "Ратуша" },
  // Red
  "Застава":  { en: "Outpost", ru: "Застава" },
  "Тюрьма":   { en: "Prison", ru: "Тюрьма" },
  "Крепость": { en: "Fortress", ru: "Крепость" },
  "Арсенал":  { en: "Arsenal", ru: "Арсенал" },
  "Цитадель": { en: "Citadel", ru: "Цитадель" },
  // Multi-color
  "Торговая палата": { en: "Trade Chamber", ru: "Торговая палата" },
  "Военный совет":   { en: "War Council", ru: "Военный совет" },
  // Purple (basic)
  "Обсерватория": { en: "Observatory", ru: "Обсерватория" },
  "Лаборатория":  { en: "Laboratory", ru: "Лаборатория" },
  "Кузница":      { en: "Smithy", ru: "Кузница" },
  "Библиотека":   { en: "Library", ru: "Библиотека" },
  "Королевская библиотека": { en: "Royal Library", ru: "Королевская библиотека" },
  "Священная роща":         { en: "Sacred Grove", ru: "Священная роща" },
  // Purple (special)
  "Пушка":                { en: "Cannon", ru: "Пушка" },
  "Оборонительный форт":  { en: "Defensive Fort", ru: "Оборонительный форт" },
  "Укрепрайон":           { en: "Stronghold", ru: "Укрепрайон" },
  "Памятник":             { en: "Monument", ru: "Памятник" },
  "Магистраль":           { en: "Highway", ru: "Магистраль" },
  "Врата в город":        { en: "City Gates", ru: "Врата в город" },
  "Склеп":                { en: "Crypt", ru: "Склеп" },
  "Склад тротила":        { en: "TNT Storage", ru: "Склад тротила" },
  "Шахта":                { en: "Mine", ru: "Шахта" },
  "Секта":                { en: "Cult", ru: "Секта" },
  "Алтарь силы":          { en: "Altar of Power", ru: "Алтарь силы" },
  "Алтарь здоровья":      { en: "Altar of Health", ru: "Алтарь здоровья" },
  "Алтарь интеллекта":    { en: "Altar of Intellect", ru: "Алтарь интеллекта" },
  "Алтарь выносливости":  { en: "Altar of Stamina", ru: "Алтарь выносливости" },
  // Spells
  "Поджигание":     { en: "Ignite", ru: "Поджигание" },
  "Золотой дождь":  { en: "Gold Rain", ru: "Золотой дождь" },
  "Священный день":  { en: "Holy Day", ru: "Священный день" },
  "Потоп":          { en: "Flood", ru: "Потоп" },
  "Чума":           { en: "Plague", ru: "Чума" },
  "🔥 Пламя":       { en: "🔥 Flame", ru: "🔥 Пламя" },
};

export function tDistrict(name: string): string {
  const entry = DISTRICT_NAMES[name];
  if (!entry) return name;
  return entry[currentLang] ?? entry.en;
}

// ---- Bot name translations ----
const BOT_NAMES: Record<string, { en: string; id: string }> = {
  "Бот Алиса": { en: "Bot Alice", id: "Bot Alisa" },
  "Бот Борис": { en: "Bot Boris", id: "Bot Boris" },
  "Бот Вика":  { en: "Bot Vika", id: "Bot Vika" },
  "Бот Григорий": { en: "Bot Gregory", id: "Bot Grigori" },
  "Бот Дарья": { en: "Bot Daria", id: "Bot Daria" },
};

export function tName(name: string): string {
  if ((currentLang === "en" || currentLang === "id") && BOT_NAMES[name]) return BOT_NAMES[name][currentLang];
  if (currentLang === "ru") {
    // Reverse lookup
    for (const [ru, translated] of Object.entries(BOT_NAMES)) {
      if (name === translated.en || name === translated.id) return ru;
    }
  }
  return name;
}

const COMPANION_NAMES: Record<string, TranslationEntry> = {
  farmer: { en: "Farmer", ru: "Фермер", id: "Petani" },
  hunter: { en: "Hunter", ru: "Охотник", id: "Pemburu" },
  saboteur: { en: "Saboteur", ru: "Диверсант", id: "Saboteur" },
  bard: { en: "Bard", ru: "Бард", id: "Bard" },
  blacksmith: { en: "Blacksmith", ru: "Кузнец", id: "Pandai besi" },
  alchemist: { en: "Alchemist", ru: "Алхимик", id: "Alkemis" },
  cannoneer: { en: "Cannoneer", ru: "Канонир", id: "Kanonir" },
  treasurer: { en: "Trader", ru: "Торговец", id: "Pedagang" },
  mason: { en: "Mason", ru: "Каменщик", id: "Tukang batu" },
  official: { en: "Official", ru: "Чиновник", id: "Pejabat" },
  sun_priestess: { en: "Sun Priestess", ru: "Жрица солнца", id: "Pendeta matahari" },
  courier: { en: "Courier", ru: "Курьер", id: "Kurir" },
  royal_guard: { en: "Royal Guard", ru: "Королевский страж", id: "Pengawal kerajaan" },
  swindler: { en: "Swindler", ru: "Шулер", id: "Penipu" },
  artist: { en: "Artist", ru: "Художник", id: "Seniman" },
  druid: { en: "Druid", ru: "Друид", id: "Druid" },
  marauder: { en: "Marauder", ru: "Мародёр", id: "Perampok" },
  strange_merchant: { en: "Strange Merchant", ru: "Странный торговец", id: "Pedagang aneh" },
  pyromancer: { en: "Pyromancer", ru: "Пиромант", id: "Piromancer" },
  unlucky_mage: { en: "Unlucky Mage", ru: "Неудачный маг", id: "Penyihir sial" },
  sniper: { en: "Sniper", ru: "Снайпер", id: "Sniper" },
  designer: { en: "Designer", ru: "Дизайнер", id: "Desainer" },
  contractor: { en: "Contractor", ru: "Заказчик", id: "Kontraktor" },
  night_shadow: { en: "Night Shadow", ru: "Ночная тень", id: "Bayangan malam" },
  investor: { en: "Investor", ru: "Инвестор", id: "Investor" },
  trainer: { en: "Trainer", ru: "Тренер", id: "Pelatih" },
  reconstructor: { en: "Reconstructor", ru: "Реконструктор", id: "Rekonstruktor" },
  dubious_dealer: { en: "Dubious Dealer", ru: "Сомнительный делец", id: "Pedagang mencurigakan" },
  sorcerer_apprentice: { en: "Apprentice", ru: "Ученик чародея", id: "Murid penyihir" },
  gravedigger: { en: "Gravedigger", ru: "Могильщик", id: "Penggali kubur" },
  jester: { en: "Jester", ru: "Шут", id: "Badut" },
  sun_fanatic: { en: "Sun Fanatic", ru: "Фанатик солнца", id: "Fanatik matahari" },
  knight: { en: "Knight", ru: "Рыцарь", id: "Ksatria" },
  fisherman: { en: "Fisherman", ru: "Рыбак", id: "Nelayan" },
  nobility: { en: "Nobility", ru: "Знать", id: "Bangsawan" },
  treasure_trader: { en: "Treasure Trader", ru: "Торговец сокровищами", id: "Pedagang harta" },
  innkeeper: { en: "Innkeeper", ru: "Трактирщик", id: "Penjaga penginapan" },
  peacemaker: { en: "Peacemaker", ru: "Миротворец", id: "Pembawa damai" },
};

const COMPANION_DESCRIPTIONS: Record<string, TranslationEntry> = {
  farmer: { en: "+1💰", ru: "+1💰" },
  hunter: { en: "2💰: opponent discards 2 random cards", ru: "За 2💰: противник сбрасывает 2 случайные карты" },
  saboteur: { en: "Disable a player's companion for this day", ru: "Отключает компаньона выбранного игрока на день" },
  bard: { en: "Remove a player's companion permanently (cost grows)", ru: "Убирает компаньона игрока навсегда (цена растёт)" },
  blacksmith: { en: "Replace a district with same-cost, different color", ru: "Меняет квартал на другой той же цены, другого цвета" },
  alchemist: { en: "Upgrade your district: +1 cost, random new card (max 5)", ru: "Улучшает квартал: +1 к цене, случайная новая карта (макс 5)" },
  cannoneer: { en: "Burn a hand card, deal 2 damage to random enemy district. 🔴 only", ru: "Сжигает карту из руки, −2 HP случайному кварталу врага. Только 🔴" },
  treasurer: { en: "{kw:passive} End of day: richest gives you 1💰 and 1🃏. 🟢 only", ru: "{kw:passive} Конец дня: богатейший даёт 1💰 и 1🃏. Только 🟢" },
  mason: { en: "1💰: split an expensive card into two cheaper ones", ru: "За 1💰: разделяет дорогую карту из руки на две" },
  official: { en: "{kw:passive} Can build duplicate districts. 🔴 only", ru: "{kw:passive} Можно строить дубликаты кварталов. Только 🔴" },
  sun_priestess: { en: "{kw:passive} Blue districts cost 1 less to build. 🔵 only", ru: "{kw:passive} Синие кварталы стоят на 1💰 меньше. Только 🔵" },
  courier: { en: "{kw:passive} Hero speed −2", ru: "{kw:passive} Скорость героя −2" },
  royal_guard: { en: "{kw:passive} +2💰 per 🟡 district. Next draft: pick from all 8 heroes. 🟡 only", ru: "{kw:passive} +2💰 за 🟡 квартал. Следующий драфт: выбор из 8 героев. Только 🟡" },
  swindler: { en: "{kw:passive} Income gives both options + extra draw", ru: "{kw:passive} Доход даёт оба варианта + ещё карту" },
  artist: { en: "{kw:passive} All 4 colors on board → +4💰", ru: "{kw:passive} Все 4 цвета на столе → +4💰" },
  druid: { en: "{kw:passive} All drawn cards gain a random second color", ru: "{kw:passive} Все взятые карты становятся двухцветными" },
  marauder: { en: "{kw:passive} On {kw:kill}: steal victim's cards", ru: "{kw:passive} При {kw:kill}: крадёте карты жертвы" },
  strange_merchant: { en: "Discard a card → gain gold = its cost. 🟢 only. {kw:leaves}", ru: "Сбросить карту → получить золото = её цена. Только 🟢. {kw:leaves}" },
  pyromancer: { en: "Card → 🔥 Flame. Flames multiply each turn! {kw:debuff}", ru: "Карта → 🔥 Пламя. Пламя множится каждый ход! {kw:debuff}" },
  unlucky_mage: { en: "All your districts turn into the chosen card! {kw:debuff}", ru: "Все ваши постройки превращаются в эту карту! {kw:debuff}" },
  sniper: { en: "Permanently remove opponent's companion from pool. {kw:leaves}", ru: "Навсегда убирает компаньона противника из пула. {kw:leaves}" },
  designer: { en: "Mark a district — it becomes a purple card next purple draft", ru: "Пометить квартал — станет фиолетовой картой в след. фиолетовом драфте" },
  contractor: { en: "Name a hero. If Assassin {kw:kill}s them today → steal ALL their cards", ru: "Назовите героя. Если Убийца совершит {kw:kill} → крадёте ВСЕ карты жертвы" },
  night_shadow: { en: "2💰: {kw:kill} an unrevealed hero", ru: "За 2💰: {kw:kill} нераскрытого героя" },
  investor: { en: "+2💰", ru: "+2💰" },
  trainer: { en: "Random colorless ability (Assassin/Thief/Sorcerer/Architect)", ru: "Случайная бесцветная способность (Убийца/Вор/Стратег/Архитектор)" },
  reconstructor: { en: "2💰: rebuild a destroyed district. {kw:leaves}", ru: "За 2💰: восстановить разрушенный квартал. {kw:leaves}" },
  dubious_dealer: { en: "Recolor all your cards and districts randomly. {kw:leaves}", ru: "Перекрашивает все ваши карты и кварталы случайно. {kw:leaves}" },
  sorcerer_apprentice: { en: "2💰: build a random discarded district", ru: "За 2💰: строит случайный сброшенный квартал" },
  gravedigger: { en: "{kw:passive} On {kw:kill}: gain the victim's hero ability", ru: "{kw:passive} При {kw:kill}: получаете способность убитого героя" },
  jester: { en: "{kw:passive} Shuffle all players' hands. 🟡 only. {kw:debuff}", ru: "{kw:passive} Перемешивает руки всех игроков. Только 🟡. {kw:debuff}" },
  sun_fanatic: { en: "Only blue buildings, or 2💰 to replace next player's companion. 🔵 only", ru: "Только синие постройки, или 2💰 заменить компаньона следующего. Только 🔵" },
  knight: { en: "{kw:passive} Richest loses 1💰 → poorest gains 1💰", ru: "{kw:passive} Богатейший теряет 1💰 → беднейший получает 1💰" },
  fisherman: { en: "1💰: build a random cost-2 district (allows duplicates)", ru: "За 1💰: строит случайный квартал за 2 (дубликаты OK)" },
  nobility: { en: "{kw:passive} Richest → +1🃏. Not richest → −1🃏 −1💰", ru: "{kw:passive} Богатейший → +1🃏. Не богатейший → −1🃏 −1💰" },
  treasure_trader: { en: "{kw:passive} Pick 2 cards in purple draft instead of 1. {kw:leaves}", ru: "{kw:passive} Берёте 2 карты в фиолетовом драфте вместо 1. {kw:leaves}" },
  innkeeper: { en: "Reveal all opponents' purple cards in hand", ru: "Показывает все фиолетовые карты противников в руке" },
  peacemaker: { en: "{kw:destroy} all Cannons, TNT Storages and Cults (no effects). {kw:leaves}", ru: "{kw:destroy} все Пушки, Склады тротила и Секты (без эффектов). {kw:leaves}" },
};

export function tCompanionName(id: string, fallback: string): string {
  const entry = COMPANION_NAMES[id];
  return entry ? (entry[currentLang] ?? entry.en) : fallback;
}

export function tCompanionDescription(id: string, fallback: string): string {
  const entry = COMPANION_DESCRIPTIONS[id];
  return entry ? (entry[currentLang] ?? entry.en) : fallback;
}

// ---- Log message translation ----
// Log messages come from game-core in Russian. We translate them on display.
const LOG_PATTERNS: Array<{ pattern: RegExp; en: (...m: string[]) => string; id?: (...m: string[]) => string }> = [
  { pattern: /💀 (.+?) \((.+?)\) был убит! Ход пропущен\./, en: (_, name, pname) => `💀 ${name} (${pname}) was killed! Turn skipped.`, id: (_, name, pname) => `💀 ${name} (${pname}) terbunuh! Giliran dilewati.` },
  { pattern: /(.+?) украл (\d+) золота у убитого (.+)/, en: (_, a, g, b) => `${a} stole ${g} gold from killed ${b}`, id: (_, a, g, b) => `${a} mencuri ${g} emas dari ${b} yang terbunuh` },
  { pattern: /(.+?) украл (\d+) золота у (.+)/, en: (_, a, g, b) => `${a} stole ${g} gold from ${b}`, id: (_, a, g, b) => `${a} mencuri ${g} emas dari ${b}` },
  { pattern: /(.+?) \(Король\) \+(\d+) золота за жёлтые кварталы/, en: (_, n, g) => `${n} (King) +${g} gold for yellow districts` },
  { pattern: /(.+?) \(Клерик\) \+(\d+) золота за синие кварталы/, en: (_, n, g) => `${n} (Cleric) +${g} gold for blue districts` },
  { pattern: /(.+?) \(Казначей\) \+(\d+) золота \((\d+) зелёных \+1 бонус\)/, en: (_, n, g, c) => `${n} (Treasurer) +${g} gold (${c} green +1 bonus)` },
  { pattern: /(.+?) \(Архитектор\) берёт (\d+) карты, может строить до 3/, en: (_, n, c) => `${n} (Architect) draws ${c} cards, can build up to 3` },
  { pattern: /(.+?) \(Генерал\) \+(\d+) золота за красные кварталы/, en: (_, n, g) => `${n} (General) +${g} gold for red districts` },
  { pattern: /(.+?) совершил убийство\.\.\./, en: (_, n) => `${n} committed murder...` },
  { pattern: /(.+?) готовит ограбление\.\.\./, en: (_, n) => `${n} prepares a robbery...` },
  { pattern: /(.+?) \(Чародей\) сбросил (\d+) карт, взял (\d+)/, en: (_, n, d, w) => `${n} (Sorcerer) discarded ${d} cards, drew ${w}` },
  { pattern: /(.+?) \(Чародей\) обменялся рукой с (.+)/, en: (_, n, t) => `${n} (Sorcerer) swapped hands with ${t}` },
  { pattern: /(.+?) \(Генерал\) разрушил (.+?) у (.+?) за (\d+) золота/, en: (_, n, d, t, g) => `${n} (General) destroyed ${tDistrict(d)} from ${t} for ${g} gold` },
  { pattern: /(.+?) \(Генерал\) повредил (.+?) у (.+?) \((\d+)→(\d+) HP\) за (\d+) золота/, en: (_, n, d, t, hp1, hp2, g) => `${n} (General) damaged ${tDistrict(d)} of ${t} (${hp1}→${hp2} HP) for ${g} gold` },
  { pattern: /(.+?) построил (\d+) кварталов! Последний день\./, en: (_, n, c) => `${n} built ${c} districts! Final day.` },
  { pattern: /(.+?): (\d+) очков/, en: (_, n, s) => `${n}: ${s} points` },
];

export function tLog(message: string): string {
  if (currentLang === "ru") return message;
  for (const { pattern, en, id } of LOG_PATTERNS) {
    const m = message.match(pattern);
    if (!m) continue;
    if (currentLang === "id" && id) return id(...m);
    return en(...m);
  }
  return message;
}

/**
 * Expand {kw:id} tokens in a string into colored keyword spans.
 * Safe for use in innerHTML.
 */
export function expandKw(text: string): string {
  return text.replace(/\{kw:(\w+)\}/g, (_, id) => kwHtml(id));
}

// ---- Spell translations ----
const SPELL_NAMES: Record<string, TranslationEntry> = {
  "Поджигание": { en: "Ignite", ru: "Поджигание" },
  "Золотой дождь": { en: "Gold Rain", ru: "Золотой дождь" },
  "Священный день": { en: "Holy Day", ru: "Священный день" },
  "Потоп": { en: "Flood", ru: "Потоп" },
  "Чума": { en: "Plague", ru: "Чума" },
};

const SPELL_DESCRIPTIONS: Record<string, TranslationEntry> = {
  ignite: { en: "{kw:spell} Replace a random card in opponent's hand with 🔥 Flame", ru: "{kw:spell} Заменяет случайную карту в руке противника на 🔥 Пламя" },
  gold_rain: { en: "{kw:spell} All players gain +1💰", ru: "{kw:spell} Все игроки получают +1💰" },
  holy_day: { en: "{kw:spell} All districts temporarily become 🔵 blue until end of day", ru: "{kw:spell} Все кварталы временно становятся 🔵 синими до конца дня" },
  flood: { en: "{kw:spell} Up to 4 random districts per player return to hand", ru: "{kw:spell} До 4 случайных кварталов у каждого возвращаются в руку" },
  plague: { en: "{kw:spell} 3-day effect: each day a random player loses gold, a random district takes damage", ru: "{kw:spell} Эффект 3 дня: каждый день случайный игрок теряет золото, случайный квартал получает урон" },
};

export function tSpellName(name: string): string {
  const entry = SPELL_NAMES[name];
  if (!entry) return tDistrict(name);
  return entry[currentLang] ?? entry.en;
}

export function tSpellDesc(ability: string): string {
  const entry = SPELL_DESCRIPTIONS[ability];
  if (!entry) return ability;
  return entry[currentLang] ?? entry.en;
}

// ---- Purple card translations ----
const PURPLE_NAMES: Record<string, TranslationEntry> = {
  "Пушка": { en: "Cannon", ru: "Пушка" },
  "Оборонительный форт": { en: "Defensive Fort", ru: "Оборонительный форт" },
  "Укрепрайон": { en: "Stronghold", ru: "Укрепрайон" },
  "Памятник": { en: "Monument", ru: "Памятник" },
  "Магистраль": { en: "Highway", ru: "Магистраль" },
  "Врата в город": { en: "City Gates", ru: "Врата в город" },
  "Склеп": { en: "Crypt", ru: "Склеп" },
  "Склад тротила": { en: "TNT Storage", ru: "Склад тротила" },
  "Шахта": { en: "Mine", ru: "Шахта" },
  "Секта": { en: "Cult", ru: "Секта" },
  "Алтарь силы": { en: "Altar of Power", ru: "Алтарь силы" },
  "Алтарь здоровья": { en: "Altar of Health", ru: "Алтарь здоровья" },
  "Алтарь интеллекта": { en: "Altar of Intellect", ru: "Алтарь интеллекта" },
  "Алтарь выносливости": { en: "Altar of Stamina", ru: "Алтарь выносливости" },
};

const PURPLE_DESCRIPTIONS: Record<string, TranslationEntry> = {
  cannon: { en: "{kw:activate} 1💰: deal 1 damage to random enemy district (unlimited uses)", ru: "{kw:activate} За 1💰: −1 HP случайному кварталу противника (без ограничений)" },
  fort: { en: "Other districts get −1 HP. Refund gold when destroyed", ru: "Другие постройки −1 HP. При разрушении получаете золото" },
  stronghold: { en: "{kw:protect}: cannot be destroyed or damaged", ru: "{kw:protect}: нельзя разрушить или повредить" },
  monument: { en: "In hand: costs 3💰 to build. On board: always 5💰/5 HP", ru: "В руке: стоит 3💰. На столе: всегда 5💰/5 HP" },
  highway: { en: "Your hero's speed −1 (act earlier)", ru: "Скорость вашего героя −1 (ходите раньше)" },
  city_gates: { en: "In hand: cost −2 each turn. Leader auto-builds it free", ru: "В руке: цена −2 каждый ход. Лидер строит автоматически и бесплатно" },
  crypt: { en: "{kw:activate} Self-destroy for 2💰. On any destroy: +2 random purple cards", ru: "{kw:activate} Самоуничтожение за 2💰. При любом разрушении: +2 случайные фиолетовые карты" },
  tnt_storage: { en: "{kw:activate} Self-destroy for 2💰: {kw:destroy} 2 random districts per player", ru: "{kw:activate} Самоуничтожение за 2💰: {kw:destroy} 2 случайных квартала у каждого" },
  mine: { en: "+1💰 at end of day for everyone. Treasurer also gets +1💰 at end of each turn", ru: "+1💰 в конце дня для всех. Казначей также получает +1💰 в конце каждого хода" },
  cult: { en: "Cleric only: {kw:activate} replace random district of random player", ru: "Только Клерик: {kw:activate} заменяет случайный квартал случайного игрока" },
  altar_power: { en: "{kw:altar}: build 3 different altars to win", ru: "{kw:altar}: постройте 3 разных алтаря для победы" },
  altar_health: { en: "{kw:altar}: build 3 different altars to win", ru: "{kw:altar}: постройте 3 разных алтаря для победы" },
  altar_intellect: { en: "{kw:altar}: build 3 different altars to win", ru: "{kw:altar}: постройте 3 разных алтаря для победы" },
  altar_stamina: { en: "{kw:altar}: build 3 different altars to win", ru: "{kw:altar}: постройте 3 разных алтаря для победы" },
};

export function tPurpleName(name: string): string {
  const entry = PURPLE_NAMES[name];
  if (!entry) return tDistrict(name);
  return entry[currentLang] ?? entry.en;
}

export function tPurpleDesc(ability: string): string {
  const entry = PURPLE_DESCRIPTIONS[ability];
  if (!entry) return ability;
  return entry[currentLang] ?? entry.en;
}

// ---- Game Guide content ----
export function getGuideHtml(): string {
  if (currentLang === "ru") return GUIDE_RU;
  return GUIDE_EN;
}

const GUIDE_RU = `
<div class="guide-section">
  <h4>Цель игры</h4>
  <p>Постройте <b>8 кварталов</b> раньше всех (или <b>3 разных алтаря</b>). Игра длится до 12 дней. Побеждает игрок с наибольшим количеством очков.</p>
</div>
<div class="guide-section">
  <h4>Структура дня</h4>
  <ol>
    <li><b>Драфт героев</b> — каждый день выбираете нового героя из доступных. 2 героя банятся (1 открыто, 1 скрыто).</li>
    <li><b>Драфт компаньонов</b> (с 4-го дня) — выберите помощника с уникальной способностью.</li>
    <li><b>Фиолетовый драфт</b> (дни 3, 6, 9, 12) — выберите 1 из 3 особых фиолетовых карт.</li>
    <li><b>Ходы</b> — герои ходят по порядку скорости (⚡ меньше = раньше).</li>
  </ol>
</div>
<div class="guide-section">
  <h4>Ваш ход</h4>
  <ol>
    <li><b>Доход</b> — выберите: +1💰 или взять карту из колоды.</li>
    <li><b>Способность героя</b> — используйте уникальную способность (необязательно).</li>
    <li><b>Строительство</b> — постройте 1 квартал из руки, заплатив его стоимость.</li>
    <li><b>Компаньон</b> — активируйте компаньона (если не пассивный).</li>
  </ol>
</div>
<div class="guide-section">
  <h4>Цвета кварталов</h4>
  <p>🟡 <b>Жёлтые</b> — знать (Лидер получает доход)<br>
     🔵 <b>Синие</b> — духовенство (Клерик получает доход)<br>
     🟢 <b>Зелёные</b> — торговля (Казначей получает доход)<br>
     🔴 <b>Красные</b> — военные (Генерал получает доход)<br>
     🟣 <b>Фиолетовые</b> — особые постройки с уникальными эффектами</p>
</div>
<div class="guide-section">
  <h4>Подсчёт очков</h4>
  <p>Сумма HP всех построек + бонусы:<br>
     <b>+4</b> — первый, кто построил 8 кварталов<br>
     <b>+3</b> — все 4 базовых цвета на столе</p>
</div>
<div class="guide-section">
  <h4>Советы</h4>
  <ul>
    <li>Скрытность важна — враги не знают, какого героя вы выбрали</li>
    <li>Убийца (⚡1) ходит первым — если вас убили, ход пропущен</li>
    <li>Клерик защищает от Генерала — стройте синие, если боитесь разрушений</li>
    <li>Фиолетовые карты могут изменить ход игры — не пропускайте фиолетовый драфт</li>
  </ul>
</div>
`;

const GUIDE_EN = `
<div class="guide-section">
  <h4>Goal</h4>
  <p>Build <b>8 districts</b> before anyone else (or <b>3 different altars</b>). The game lasts up to 12 days. The player with the most points wins.</p>
</div>
<div class="guide-section">
  <h4>Day Structure</h4>
  <ol>
    <li><b>Hero draft</b> — pick a new hero each day. 2 heroes are banned (1 face-up, 1 hidden).</li>
    <li><b>Companion draft</b> (from day 4) — pick a helper with a unique ability.</li>
    <li><b>Purple draft</b> (days 3, 6, 9, 12) — choose 1 of 3 special purple cards.</li>
    <li><b>Turns</b> — heroes act in speed order (lower ⚡ = earlier).</li>
  </ol>
</div>
<div class="guide-section">
  <h4>Your Turn</h4>
  <ol>
    <li><b>Income</b> — choose: +1💰 or draw a card from the deck.</li>
    <li><b>Hero ability</b> — use your hero's unique ability (optional).</li>
    <li><b>Build</b> — build 1 district from hand by paying its cost.</li>
    <li><b>Companion</b> — activate your companion (if not passive).</li>
  </ol>
</div>
<div class="guide-section">
  <h4>District Colors</h4>
  <p>🟡 <b>Yellow</b> — nobility (Leader gets income)<br>
     🔵 <b>Blue</b> — clergy (Cleric gets income)<br>
     🟢 <b>Green</b> — trade (Treasurer gets income)<br>
     🔴 <b>Red</b> — military (General gets income)<br>
     🟣 <b>Purple</b> — special buildings with unique effects</p>
</div>
<div class="guide-section">
  <h4>Scoring</h4>
  <p>Sum of all districts' HP + bonuses:<br>
     <b>+4</b> — first to build 8 districts<br>
     <b>+3</b> — all 4 base colors on board</p>
</div>
<div class="guide-section">
  <h4>Tips</h4>
  <ul>
    <li>Secrecy matters — enemies don't know which hero you picked</li>
    <li>Assassin (⚡1) goes first — if you're killed, your turn is skipped</li>
    <li>Cleric protects from General — build blue if you fear destruction</li>
    <li>Purple cards are game-changers — don't skip the purple draft</li>
  </ul>
</div>
`;
