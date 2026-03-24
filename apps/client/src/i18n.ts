// ---- Internationalization module ----

export type Lang = "en" | "ru";

let currentLang: Lang = (localStorage.getItem("darms_lang") as Lang) || "en";

export function getLang(): Lang { return currentLang; }

export function setLang(lang: Lang) {
  currentLang = lang;
  localStorage.setItem("darms_lang", lang);
}

// ---- Translation dictionary ----
const dict: Record<string, { en: string; ru: string }> = {
  // Menu
  "menu.subtitle": { en: "Card strategy", ru: "Карточная стратегия" },
  "menu.name_placeholder": { en: "Your name", ru: "Твоё имя" },
  "menu.default_name": { en: "Player", ru: "Игрок" },
  "menu.local": { en: "Local game (with bots)", ru: "Локальная игра (с ботами)" },
  "menu.online_divider": { en: "— online —", ru: "— онлайн —" },
  "menu.create_room": { en: "Create room", ru: "Создать комнату" },
  "menu.join_room": { en: "Join by code", ru: "Войти по коду" },

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

  // Turn banner
  "banner.your_pick": { en: "Your hero pick!", ru: "Твой выбор героя!" },
  "banner.hero_pick": { en: "Hero pick...", ru: "Выбор героя..." },
  "banner.your_turn": { en: "Your turn", ru: "Твой ход" },
  "banner.turn_of": { en: "Turn: ", ru: "Ход: " },
  "banner.day": { en: "Day", ru: "День" },
  "banner.game_over": { en: "Game over", ru: "Игра окончена" },

  // Opponent board
  "opp.role_hidden": { en: "Role hidden", ru: "Роль скрыта" },
  "opp.no_districts": { en: "No districts built", ru: "Нет построек" },
  "opp.killed_today": { en: "Killed today", ru: "Убит в этот день" },

  // My board
  "my.hand": { en: "Hand", ru: "Рука" },
  "my.first": { en: "First!", ru: "Первый!" },
  "my.killed_skip": { en: "You are killed today. Your turn is skipped.", ru: "Вы убиты в этот день. Ваш ход пропущен." },
  "my.waiting": { en: "Waiting for other players...", ru: "Ждём ход других игроков..." },
  "my.passive": { en: "Passive", ru: "Пассивка" },
  "my.gold_income": { en: "+1 Gold", ru: "+1 Золото" },
  "my.draw_card": { en: "Draw card", ru: "Взять карту" },
  "my.end_turn": { en: "End turn", ru: "Завершить ход" },
  "my.build": { en: "Build", ru: "Строить" },
  "my.ability": { en: "Ability", ru: "Способность" },

  // Hero classes
  "class.assassin": { en: "Assassin", ru: "Убийца" },
  "class.thief": { en: "Thief", ru: "Вор" },
  "class.sorcerer": { en: "Sorcerer", ru: "Чародей" },
  "class.king": { en: "King", ru: "Король" },
  "class.cleric": { en: "Cleric", ru: "Клерик" },
  "class.merchant": { en: "Merchant", ru: "Торговец" },
  "class.architect": { en: "Architect", ru: "Архитектор" },
  "class.general": { en: "General", ru: "Генерал" },

  // Abilities (short)
  "ability.assassin": { en: "Assassination", ru: "Убийство" },
  "ability.thief": { en: "Robbery", ru: "Грабёж" },
  "ability.sorcerer": { en: "Magic", ru: "Магия" },
  "ability.king": { en: "Crown + yellow income", ru: "Корона + жёлтый доход" },
  "ability.cleric": { en: "Protection + blue income", ru: "Защита + синий доход" },
  "ability.merchant": { en: "Bonus + green income", ru: "Бонус + зелёный доход" },
  "ability.architect": { en: "3 builds per turn", ru: "3 постройки за ход" },
  "ability.general": { en: "Destroy + red income", ru: "Разрушение + красный доход" },

  // Ability descriptions (detailed, for draft cards)
  "ability_desc.assassin": {
    en: "Choose a hero — if a player has that role, they skip their turn entirely.",
    ru: "Выбери героя — если игрок взял эту роль, он пропустит свой ход полностью.",
  },
  "ability_desc.thief": {
    en: "Choose a hero — when that hero's turn begins, you steal all their gold.",
    ru: "Выбери героя — когда начнётся его ход, ты заберёшь всё его золото.",
  },
  "ability_desc.sorcerer": {
    en: "Discard 2 cards and draw 3 from the deck, or swap your entire hand with another player.",
    ru: "Сбросить 2 карты и взять 3 из колоды, или обменяться рукой с любым игроком.",
  },
  "ability_desc.king": {
    en: "Take the Crown (first pick next round). Gain 1 gold per yellow district you own.",
    ru: "Забери Корону (первый выбор в следующем раунде). +1 золото за каждый жёлтый квартал.",
  },
  "ability_desc.cleric": {
    en: "Your districts cannot be destroyed this turn. Gain 1 gold per blue district you own.",
    ru: "Ваши кварталы нельзя разрушить в этот ход. +1 золото за каждый синий квартал.",
  },
  "ability_desc.merchant": {
    en: "Gain +1 bonus gold automatically. Also gain 1 gold per green district you own.",
    ru: "+1 бонусное золото автоматически. Также +1 золото за каждый зелёный квартал.",
  },
  "ability_desc.architect": {
    en: "Draw 2 extra cards. You may build up to 3 districts this turn instead of 1.",
    ru: "Возьми 2 дополнительные карты. Можешь построить до 3 кварталов за ход вместо 1.",
  },
  "ability_desc.general": {
    en: "Spend gold to destroy or damage an opponent's district. Gain 1 gold per red district.",
    ru: "Потрать золото чтобы разрушить квартал противника. +1 золото за каждый красный квартал.",
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
  "modal.sorcerer_title": { en: "Sorcerer Ability", ru: "Способность Чародея" },
  "modal.sorcerer_hint": {
    en: "Discard 2 random cards and draw 3 from the deck, or swap hands with any player.",
    ru: "Сбросить 2 случайные карты и взять 3 из колоды, или обменяться рукой с любым игроком.",
  },
  "modal.sorcerer_draw": { en: "Discard 2, draw 3", ru: "Сбросить 2, взять 3" },
  "modal.sorcerer_cards": { en: "cards", ru: "карт" },
  "modal.general_title": { en: "Destroy a district", ru: "Разрушить квартал" },
  "modal.general_hint": {
    en: "Spend gold to destroy an opponent's district. Cleric is protected.",
    ru: "Потрать золото чтобы разрушить квартал противника. Клерик защищён.",
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
  "lang.toggle": { en: "RU", ru: "EN" },
};

/** Get translated string */
export function t(key: string): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[currentLang];
}

// ---- Hero name translations ----
const HERO_NAMES: Record<string, { en: string; ru: string }> = {
  assassin:  { en: "Fahira Mirai",       ru: "Фахира Мирай" },
  thief:     { en: "Mitchell Silas",     ru: "Митчелл Сайлас" },
  sorcerer:  { en: "Master Zedrud",      ru: "Мастер Зедруд" },
  king:      { en: "King Irisiy Faoris", ru: "Король Ирисий Фаорис" },
  cleric:    { en: "Ashley Firia",       ru: "Эшли Фирия" },
  merchant:  { en: "Marhat Fahari",      ru: "Мархат Фахари" },
  architect: { en: "Sebastian Maevis",   ru: "Себастиан Мэйвис" },
  general:   { en: "Gresh Mavrov",       ru: "Греш Мавров" },
};

export function tHero(heroId: string): string {
  const entry = HERO_NAMES[heroId];
  if (!entry) return heroId;
  return entry[currentLang];
}

// ---- District name translations ----
const DISTRICT_NAMES: Record<string, { en: string; ru: string }> = {
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
  // Purple
  "Обсерватория": { en: "Observatory", ru: "Обсерватория" },
  "Лаборатория":  { en: "Laboratory", ru: "Лаборатория" },
  "Кузница":      { en: "Smithy", ru: "Кузница" },
  "Библиотека":   { en: "Library", ru: "Библиотека" },
  "Королевская библиотека": { en: "Royal Library", ru: "Королевская библиотека" },
  "Священная роща":         { en: "Sacred Grove", ru: "Священная роща" },
};

export function tDistrict(name: string): string {
  const entry = DISTRICT_NAMES[name];
  if (!entry) return name;
  return entry[currentLang];
}

// ---- Bot name translations ----
const BOT_NAMES: Record<string, string> = {
  "Бот Алиса": "Bot Alice",
  "Бот Борис": "Bot Boris",
  "Бот Вика":  "Bot Vika",
  "Бот Григорий": "Bot Gregory",
  "Бот Дарья": "Bot Daria",
};

export function tName(name: string): string {
  if (currentLang === "en" && BOT_NAMES[name]) return BOT_NAMES[name];
  if (currentLang === "ru") {
    // Reverse lookup
    for (const [ru, en] of Object.entries(BOT_NAMES)) {
      if (name === en) return ru;
    }
  }
  return name;
}

// ---- Log message translation ----
// Log messages come from game-core in Russian. We translate them on display.
const LOG_PATTERNS: Array<{ pattern: RegExp; en: (...m: string[]) => string }> = [
  { pattern: /💀 (.+?) \((.+?)\) был убит! Ход пропущен\./, en: (_, name, pname) => `💀 ${name} (${pname}) was killed! Turn skipped.` },
  { pattern: /(.+?) украл (\d+) золота у убитого (.+)/, en: (_, a, g, b) => `${a} stole ${g} gold from killed ${b}` },
  { pattern: /(.+?) украл (\d+) золота у (.+)/, en: (_, a, g, b) => `${a} stole ${g} gold from ${b}` },
  { pattern: /(.+?) \(Король\) \+(\d+) золота за жёлтые кварталы/, en: (_, n, g) => `${n} (King) +${g} gold for yellow districts` },
  { pattern: /(.+?) \(Клерик\) \+(\d+) золота за синие кварталы/, en: (_, n, g) => `${n} (Cleric) +${g} gold for blue districts` },
  { pattern: /(.+?) \(Торговец\) \+(\d+) золота \((\d+) зелёных \+1 бонус\)/, en: (_, n, g, c) => `${n} (Merchant) +${g} gold (${c} green +1 bonus)` },
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
  for (const { pattern, en } of LOG_PATTERNS) {
    const m = message.match(pattern);
    if (m) return en(...m);
  }
  return message;
}
