// ---- Internationalization module ----

import { findCardByName, findPurpleByAbility, findSpellByAbility } from "@darms/shared-types";

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
  { id: "leaves", name: { en: "Leaves pool", ru: "Уходит" }, description: { en: "This companion permanently leaves the pool after being used.", ru: "Этот компаньон навсегда покидает пул после использования." }, color: "#7f8c8d" },
  { id: "passive", name: { en: "Passive", ru: "Пассивно" }, description: { en: "Effect triggers automatically — no action needed.", ru: "Эффект срабатывает автоматически — действие не нужно." }, color: "#bdc3c7" },
  { id: "activate", name: { en: "Activate", ru: "Активация" }, description: { en: "Click on the building on your board to trigger its effect.", ru: "Кликните на постройку на вашем поле для активации эффекта." }, color: "#e67e22" },
  { id: "spell", name: { en: "Spell", ru: "Заклинание" }, description: { en: "One-time card played from hand. Does not stay on the board.", ru: "Одноразовая карта, разыгрывается из руки. Не остаётся на столе." }, color: "#8e44ad" },
  { id: "altar", name: { en: "Altar", ru: "Алтарь" }, description: { en: "Alternative win condition: build 4 Altars of Darkness to win.", ru: "Альтернативная победа: постройте 4 алтаря тьмы и победите." }, color: "#d4ac0d" },
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
  "menu.guest_login": { en: "Continue as guest", ru: "Войти гостем" },
  "menu.guest_mode": { en: "Guest mode enabled", ru: "Режим гостя включён" },
  "menu.gold": { en: "Gold", ru: "Золото" },
  "menu.diamonds": { en: "Diamonds", ru: "Бриллианты" },
  "menu.store": { en: "Store", ru: "Магазин" },
  "menu.store_empty": { en: "Store is empty for now.", ru: "Магазин пока пуст." },
  "menu.campaign": { en: "Campaign", ru: "Компания" },
  "menu.coming_soon": { en: "Coming soon", ru: "Скоро" },
  "menu.treasury": { en: "Treasury", ru: "Казна" },
  "menu.treasury_resources": { en: "Resources", ru: "Ресурсы" },
  "menu.treasury_covers": { en: "Covers", ru: "Обложки" },
  "menu.treasury_cards": { en: "Cards", ru: "Карты" },
  "menu.empty": { en: "Empty for now.", ru: "Пока пусто." },
  "menu.deck_required": { en: "Build a deck to play", ru: "Соберите колоду, чтобы играть" },

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
  "lobby.deck_ready": { en: "deck ready", ru: "колода готова" },
  "lobby.deck_pending": { en: "deck pending", ru: "колода не собрана" },
  "lobby.build_deck": { en: "Build deck", ru: "Собрать колоду" },
  "lobby.edit_deck": { en: "Edit deck", ru: "Изменить колоду" },
  "lobby.need_four": { en: "Need 4 players", ru: "Нужно 4 игрока" },
  "lobby.wait_decks": { en: "Waiting for all decks", ru: "Ждём пока все соберут колоду" },

  // Deck builder
  "deck.title": { en: "Deck Builder", ru: "Деклбилдинг" },
  "deck.companions": { en: "Companions", ru: "Компаньоны" },
  "deck.companions_hint": { en: "3 unique", ru: "3 разных" },
  "deck.purple": { en: "Purple cards", ru: "Фиолетовые карты" },
  "deck.purple_hint": { en: "duplicates allowed", ru: "повторы разрешены" },
  "deck.save": { en: "Save", ru: "Сохранить" },
  "deck.clear": { en: "Clear", ru: "Очистить" },
  "deck.preset": { en: "Preset build", ru: "Готовый билд" },
  "deck.building": { en: "building", ru: "постройка", id: "bangunan" },
  "deck.placeholder": { en: "placeholder", ru: "заглушка", id: "placeholder" },

  // Info popover
  "info.plain_district": { en: "Plain district — no special effects.", ru: "Обычный квартал — без особых эффектов.", id: "Distrik biasa — tanpa efek khusus." },
  "purple.placeholder_desc": {
    en: "Play from hand: pick one purple card from your deck-build. The last one is granted automatically; if the pool is empty, the stub recycles and a random coloured card appears instead.",
    ru: "Разыграйте из руки: выберите фиолетовую карту из своего билда. Последняя выдаётся автоматически; если пул пуст, заглушка возвращается в колоду и вместо неё приходит случайная цветная карта.",
    id: "Mainkan dari tangan: pilih satu kartu ungu dari deck-build Anda. Yang terakhir langsung diberikan; jika pool kosong, stub daur ulang dan kartu warna acak muncul.",
  },

  // Hand
  "my.play_placeholder": { en: "Play", ru: "Разыграть", id: "Mainkan" },

  // Draft / companion skip
  "draft.skip_companion": { en: "Skip companion", ru: "Пропустить выбор" },

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
    en: "Discard 2 cards and draw 2, or swap your hand with another player.",
    ru: "Сбросить 2 карты и взять 2 из колоды, или обменяться рукой с любым игроком.",
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
    en: "Discard 2 random cards and draw 2 from the deck, or swap hands with any player.",
    ru: "Сбросить 2 случайные карты и взять 2 из колоды, или обменяться рукой с любым игроком.",
  },
  "modal.sorcerer_draw": { en: "Discard 2, draw 2", ru: "Сбросить 2, взять 2" },
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
  "companion.active": { en: "active", ru: "актив", id: "aktif" },
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
/**
 * Translate any card name (districts, purple, spells, placeholder) to the current language.
 * Canonical source: i18n dictionaries in this file; falls back to the card registry (ru/en only).
 */
export function tDistrict(name: string): string {
  // Placeholder stub — centralized here, not in the card registry.
  if (name === "Фиолетовая карта!" || name === "Purple Card!" || name === "Kartu ungu!") {
    return PLACEHOLDER_NAME[currentLang] ?? PLACEHOLDER_NAME.en;
  }
  // Try i18n-first lookup by matching ru name against PURPLE_NAMES / SPELL_NAMES.
  for (const [ability, entry] of Object.entries(PURPLE_NAMES)) {
    if (entry.ru === name || entry.en === name || entry.id === name) {
      return entry[currentLang] ?? entry.en;
    }
  }
  for (const [ability, entry] of Object.entries(SPELL_NAMES)) {
    if (entry.ru === name || entry.en === name || entry.id === name) {
      return entry[currentLang] ?? entry.en;
    }
  }
  // Plain districts still come from the card registry (ru/en only for now).
  if (currentLang === "ru") return name;
  const def = findCardByName(name);
  if (!def) return name;
  return def.name[currentLang as "en"] ?? def.name.en;
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

// ---- Canonical companion translations (single source of truth: name + description × 3 langs) ----
const COMPANION_NAMES: Record<string, TranslationEntry> = {
  farmer: { en: "Farmer", ru: "Фермер", id: "Petani" },
  treasurer: { en: "Trader", ru: "Торговец", id: "Pedagang" },
  hunter: { en: "Hunter", ru: "Охотник", id: "Pemburu" },
  mason: { en: "Mason", ru: "Каменщик", id: "Tukang batu" },
  saboteur: { en: "Saboteur", ru: "Диверсант", id: "Penyabotase" },
  official: { en: "Official", ru: "Чиновник", id: "Pejabat" },
  blacksmith: { en: "Blacksmith", ru: "Кузнец", id: "Pandai besi" },
  sun_priestess: { en: "Sun Priestess", ru: "Жрица солнца", id: "Pendeta matahari" },
  courier: { en: "Courier", ru: "Курьер", id: "Kurir" },
  royal_guard: { en: "Royal Guard", ru: "Королевский страж", id: "Pengawal kerajaan" },
  swindler: { en: "Swindler", ru: "Шулер", id: "Penipu" },
  artist: { en: "Artist", ru: "Художник", id: "Seniman" },
  druid: { en: "Druid", ru: "Друид", id: "Druid" },
  marauder: { en: "Marauder", ru: "Мародёр", id: "Perampok" },
  bard: { en: "Bard", ru: "Бард", id: "Pujangga" },
  alchemist: { en: "Alchemist", ru: "Алхимик", id: "Alkemis" },
  cannoneer: { en: "Cannoneer", ru: "Канонир", id: "Penembak meriam" },
  reconstructor: { en: "Reconstructor", ru: "Реконструктор", id: "Rekonstruktor" },
  dubious_dealer: { en: "Dubious Dealer", ru: "Сомнительный делец", id: "Pedagang mencurigakan" },
  sorcerer_apprentice: { en: "Apprentice", ru: "Ученик чародея", id: "Murid penyihir" },
  strange_merchant: { en: "Strange Merchant", ru: "Странный торговец", id: "Pedagang aneh" },
  gravedigger: { en: "Gravedigger", ru: "Могильщик", id: "Penggali kubur" },
  jester: { en: "Jester", ru: "Шут", id: "Badut" },
  pyromancer: { en: "Pyromancer", ru: "Пиромант", id: "Penyihir api" },
  sun_fanatic: { en: "Sun Fanatic", ru: "Фанатик солнца", id: "Fanatik matahari" },
  sniper: { en: "Sniper", ru: "Снайпер", id: "Penembak jitu" },
  knight: { en: "Knight", ru: "Рыцарь", id: "Ksatria" },
  fisherman: { en: "Fisherman", ru: "Рыбак", id: "Nelayan" },
  unlucky_mage: { en: "Unlucky Mage", ru: "Неудачный маг", id: "Penyihir sial" },
  nobility: { en: "Nobility", ru: "Знать", id: "Bangsawan" },
  treasure_trader: { en: "Treasure Trader", ru: "Торговец сокровищами", id: "Pedagang harta" },
  designer: { en: "Designer", ru: "Дизайнер", id: "Desainer" },
  innkeeper: { en: "Innkeeper", ru: "Трактирщик", id: "Penjaga penginapan" },
  peacemaker: { en: "Peacemaker", ru: "Миротворец", id: "Pembawa damai" },
  contractor: { en: "Contractor", ru: "Заказчик", id: "Kontraktor" },
  night_shadow: { en: "Night Shadow", ru: "Ночная тень", id: "Bayangan malam" },
};

const COMPANION_DESCRIPTIONS: Record<string, TranslationEntry> = {
  farmer: { en: "+1💰", ru: "+1💰", id: "+1💰" },
  treasurer: { en: "{kw:passive} End of day: richest gives you 1💰 and 1🃏. 🟢 only", ru: "{kw:passive} Конец дня: богатейший даёт 1💰 и 1🃏. Только 🟢", id: "{kw:passive} Akhir hari: pemain terkaya memberi 1💰 dan 1🃏. Hanya 🟢" },
  hunter: { en: "2💰: opponent discards 2 random cards", ru: "За 2💰: противник сбрасывает 2 случайные карты", id: "2💰: lawan membuang 2 kartu acak" },
  mason: { en: "1💰: split an expensive card into two cheaper ones", ru: "За 1💰: разделяет дорогую карту из руки на две", id: "1💰: pisahkan kartu mahal menjadi dua kartu murah" },
  saboteur: { en: "Disable a player's companion for this day", ru: "Отключает компаньона выбранного игрока на день", id: "Menonaktifkan companion pemain selama hari ini" },
  official: { en: "{kw:passive} Can build duplicate districts. 🔴 only", ru: "{kw:passive} Можно строить дубликаты кварталов. Только 🔴", id: "{kw:passive} Boleh membangun distrik kembar. Hanya 🔴" },
  blacksmith: { en: "Replace a district with same-cost, different color", ru: "Меняет квартал на другой той же цены, другого цвета", id: "Ganti distrik dengan yang berharga sama, warna berbeda" },
  sun_priestess: { en: "{kw:passive} Blue districts cost 1 less to build. 🔵 only", ru: "{kw:passive} Синие кварталы стоят на 1💰 меньше. Только 🔵", id: "{kw:passive} Distrik biru 1💰 lebih murah. Hanya 🔵" },
  courier: { en: "{kw:passive} Hero speed −2", ru: "{kw:passive} Скорость героя −2", id: "{kw:passive} Kecepatan hero −2" },
  royal_guard: { en: "{kw:passive} +2💰 per 🟡 district. Next draft: pick from all 8 heroes. 🟡 only", ru: "{kw:passive} +2💰 за 🟡 квартал. Следующий драфт: выбор из 8 героев. Только 🟡", id: "{kw:passive} +2💰 per distrik 🟡. Draft berikut: pilih dari 8 hero. Hanya 🟡" },
  swindler: { en: "{kw:passive} Income gives both options + extra draw", ru: "{kw:passive} Доход даёт оба варианта + ещё карту", id: "{kw:passive} Pendapatan memberi kedua opsi + 1 kartu ekstra" },
  artist: { en: "{kw:passive} All 4 colors on board → +4💰", ru: "{kw:passive} Все 4 цвета на столе → +4💰", id: "{kw:passive} Ke-4 warna di meja → +4💰" },
  druid: { en: "{kw:passive} All drawn cards gain a random second color", ru: "{kw:passive} Все взятые карты становятся двухцветными", id: "{kw:passive} Kartu yang diambil mendapat warna kedua acak" },
  marauder: { en: "{kw:passive} On {kw:kill}: steal victim's cards", ru: "{kw:passive} При {kw:kill}: крадёте карты жертвы", id: "{kw:passive} Saat {kw:kill}: curi kartu korban" },
  bard: { en: "Remove a player's companion permanently (cost grows)", ru: "Убирает компаньона игрока навсегда (цена растёт)", id: "Hapus companion pemain secara permanen (harga naik)" },
  alchemist: { en: "Upgrade your district: +1 cost, random new card (max 5)", ru: "Улучшает квартал: +1 к цене, случайная новая карта (макс 5)", id: "Tingkatkan distrik: +1 biaya, kartu acak baru (maks 5)" },
  cannoneer: { en: "Burn a hand card, deal 2 damage to random enemy district. 🔴 only", ru: "Сжигает карту из руки, −2 HP случайному кварталу врага. Только 🔴", id: "Bakar kartu dari tangan, −2 HP ke distrik musuh acak. Hanya 🔴" },
  reconstructor: { en: "2💰: rebuild a destroyed district. {kw:leaves}", ru: "За 2💰: восстановить разрушенный квартал. {kw:leaves}", id: "2💰: bangun kembali distrik yang hancur. {kw:leaves}" },
  dubious_dealer: { en: "Recolor all cards and districts randomly. {kw:leaves}", ru: "Перекрашивает все карты и кварталы случайно. {kw:leaves}", id: "Mengecat ulang semua kartu dan distrik secara acak. {kw:leaves}" },
  sorcerer_apprentice: { en: "2💰: build a random discarded district", ru: "За 2💰: строит случайный сброшенный квартал", id: "2💰: bangun distrik acak dari tumpukan buangan" },
  strange_merchant: { en: "Discard a card → gain gold = its cost. 🟢 only. {kw:leaves}", ru: "Сбросить карту → получить золото = её цена. Только 🟢. {kw:leaves}", id: "Buang kartu → dapat emas = harganya. Hanya 🟢. {kw:leaves}" },
  gravedigger: { en: "{kw:passive} On {kw:kill}: gain the victim's hero ability", ru: "{kw:passive} При {kw:kill}: получаете способность убитого героя", id: "{kw:passive} Saat {kw:kill}: dapatkan kemampuan hero korban" },
  jester: { en: "{kw:passive} Shuffle all players' hands. 🟡 only.", ru: "{kw:passive} Перемешивает руки всех игроков. Только 🟡.", id: "{kw:passive} Acak kartu tangan semua pemain. Hanya 🟡." },
  pyromancer: { en: "Plant 🔥 Flame in any player's hand (random card). Flames multiply each turn!", ru: "Подбрасывает 🔥 Пламя в руку любого игрока (случайной картой). Пламя множится каждый ход!", id: "Tanam 🔥 Api di tangan pemain mana pun (kartu acak). Api berkembang tiap giliran!" },
  sun_fanatic: { en: "Only blue buildings, or 2💰 to replace next player's companion. 🔵 only", ru: "Только синие постройки, или 2💰 заменить компаньона следующего. Только 🔵", id: "Hanya bangunan biru, atau 2💰 untuk ganti companion pemain berikut. Hanya 🔵" },
  sniper: { en: "Permanently remove opponent's companion from pool. {kw:leaves}", ru: "Навсегда убирает компаньона противника из пула. {kw:leaves}", id: "Hapus permanen companion lawan dari pool. {kw:leaves}" },
  knight: { en: "{kw:passive} Richest loses 1💰 → poorest gains 1💰", ru: "{kw:passive} Богатейший теряет 1💰 → беднейший получает 1💰", id: "{kw:passive} Pemain terkaya kehilangan 1💰 → termiskin dapat 1💰" },
  fisherman: { en: "1💰: build a random cost-2 district (allows duplicates)", ru: "За 1💰: строит случайный квартал за 2 (дубликаты OK)", id: "1💰: bangun distrik acak berharga 2 (duplikat boleh)" },
  unlucky_mage: { en: "3💰: discard a RANDOM hand card — your districts take its identity (name, colors, ability) but keep their own value. {kw:leaves}", ru: "За 3💰: сбрасывает СЛУЧАЙНУЮ карту из руки — ваши постройки получают её имя/цвета/способность, но сохраняют свою цену. {kw:leaves}", id: "3💰: buang kartu ACAK dari tangan — distrik Anda ambil identitasnya (nama/warna/kemampuan) tapi tetap nilai sendiri. {kw:leaves}" },
  nobility: { en: "{kw:passive} Richest → +1🃏. Not richest → −1🃏 −1💰", ru: "{kw:passive} Богатейший → +1🃏. Не богатейший → −1🃏 −1💰", id: "{kw:passive} Terkaya → +1🃏. Bukan terkaya → −1🃏 −1💰" },
  treasure_trader: { en: "Gain a random purple building in hand. {kw:leaves}", ru: "Даёт случайную фиолетовую постройку в руку. {kw:leaves}", id: "Dapatkan bangunan ungu acak di tangan. {kw:leaves}" },
  designer: { en: "Turn one of your districts into a random purple building", ru: "Превращает выбранный ваш район в случайную фиолетовую постройку", id: "Ubah distrik Anda jadi bangunan ungu acak" },
  innkeeper: { en: "Reveal all opponents' purple cards in hand", ru: "Показывает все фиолетовые карты противников в руке", id: "Tampilkan semua kartu ungu di tangan lawan" },
  peacemaker: { en: "{kw:destroy} all Cannons, TNT Storages and Cults (no effects). {kw:leaves}", ru: "{kw:destroy} все Пушки, Склады тротила и Секты (без эффектов). {kw:leaves}", id: "{kw:destroy} semua Meriam, Gudang TNT dan Kultus (tanpa efek). {kw:leaves}" },
  contractor: { en: "Name a hero (not from open ban). If Assassin {kw:kill}s them → steal their purple cards", ru: "Назовите героя (не из открытого бана). Если Убийца совершит {kw:kill} → крадёте его фиолетовые карты", id: "Sebutkan hero (bukan dari ban terbuka). Jika Assassin {kw:kill} → curi kartu ungunya" },
  night_shadow: { en: "2💰: {kw:kill} an unrevealed hero", ru: "За 2💰: {kw:kill} нераскрытого героя", id: "2💰: {kw:kill} hero yang belum terbuka" },
};

export function tCompanionName(id: string, fallback?: string): string {
  const entry = COMPANION_NAMES[id];
  return entry ? (entry[currentLang] ?? entry.en) : (fallback ?? id);
}

export function tCompanionDescription(id: string, fallback?: string): string {
  const entry = COMPANION_DESCRIPTIONS[id];
  return entry ? (entry[currentLang] ?? entry.en) : (fallback ?? "");
}

// ---- Canonical purple building translations ----
const PURPLE_NAMES: Record<string, TranslationEntry> = {
  cannon: { en: "Cannon", ru: "Пушка", id: "Meriam" },
  fort: { en: "Fort", ru: "Форт", id: "Benteng" },
  stronghold: { en: "Stronghold", ru: "Цитадель", id: "Kubu" },
  monument: { en: "Monument", ru: "Монумент", id: "Monumen" },
  highway: { en: "Highway", ru: "Шоссе", id: "Jalan raya" },
  city_gates: { en: "City Gates", ru: "Врата в город", id: "Gerbang kota" },
  crypt: { en: "Crypt", ru: "Склеп", id: "Makam" },
  tnt_storage: { en: "TNT Storage", ru: "Склад тротила", id: "Gudang TNT" },
  mine: { en: "Mine", ru: "Шахта", id: "Tambang" },
  cult: { en: "Cult", ru: "Секта", id: "Kultus" },
  altar_darkness: { en: "Altar of Darkness", ru: "Алтарь тьмы", id: "Altar kegelapan" },
};

const PURPLE_DESCRIPTIONS: Record<string, TranslationEntry> = {
  cannon: { en: "{kw:activate} 1💰: deal 1 damage to a random enemy district (unlimited per day)", ru: "{kw:activate} За 1💰: −1 HP случайному кварталу врага (без лимита)", id: "{kw:activate} 1💰: 1 damage ke distrik musuh acak (tanpa batas)" },
  fort: { en: "{kw:passive} Other buildings −1 HP on table. Destroyed → refund its cost in gold", ru: "{kw:passive} Другие постройки −1 HP на столе. При разрушении — возврат золотом", id: "{kw:passive} Bangunan lain −1 HP di meja. Jika hancur — kembalikan emas" },
  stronghold: { en: "{kw:passive} Immune to destruction and damage", ru: "{kw:passive} Неуязвима к разрушению и урону", id: "{kw:passive} Kebal dari penghancuran & damage" },
  monument: { en: "In hand: costs 3. On table: 5/5 HP", ru: "В руке: цена 3. На столе: 5/5 HP", id: "Di tangan: harga 3. Di meja: 5/5 HP" },
  highway: { en: "{kw:passive} Hero speed −1", ru: "{kw:passive} Скорость героя −1", id: "{kw:passive} Kecepatan hero −1" },
  city_gates: { en: "In hand: cost −2 each day. Leader auto-builds it for free", ru: "В руке: цена −2 каждый день. Лидер строит автоматически и бесплатно", id: "Di tangan: harga −2 tiap hari. Leader membangunnya gratis otomatis" },
  crypt: { en: "{kw:activate} 2💰: self-destroy, gain 2 random purple buildings in hand", ru: "{kw:activate} За 2💰: самоуничтожение, +2 случайные фиолетовые постройки в руку", id: "{kw:activate} 2💰: hancurkan diri, dapat 2 bangunan ungu acak" },
  tnt_storage: { en: "{kw:activate} 2💰: self-destroy, 8 damage spread across every player's districts (Stronghold immune)", ru: "{kw:activate} За 2💰: самоуничтожение, 8 урона распределяется случайно между постройками всех игроков (Цитадель неуязвима)", id: "{kw:activate} 2💰: hancurkan diri, 8 damage tersebar pada distrik tiap pemain (Kubu kebal)" },
  mine: { en: "{kw:passive} +1💰 at end of day (Merchant: end of each turn)", ru: "{kw:passive} +1💰 в конце дня (Казначей: в конце каждого хода)", id: "{kw:passive} +1💰 di akhir hari (Pedagang: tiap giliran)" },
  cult: { en: "{kw:activate} Blue hero only: replace a random opponent's district with a copy of Cult", ru: "{kw:activate} Только синий герой: заменяет случайный квартал оппа на Секту", id: "{kw:activate} Hanya hero biru: ganti distrik lawan acak dengan salinan Kultus" },
  altar_darkness: { en: "{kw:altar} Build 4 Altars → alternate win condition", ru: "{kw:altar} Постройте 4 алтаря → альтернативная победа", id: "{kw:altar} Bangun 4 Altar → kondisi menang alternatif" },
};

// ---- Canonical spell translations ----
const SPELL_NAMES: Record<string, TranslationEntry> = {
  ignite: { en: "Ignite", ru: "Поджигание", id: "Pembakaran" },
  gold_rain: { en: "Gold Rain", ru: "Золотой дождь", id: "Hujan emas" },
  holy_day: { en: "Holy Day", ru: "Священный день", id: "Hari suci" },
  flood: { en: "Flood", ru: "Потоп", id: "Banjir" },
  plague: { en: "Plague", ru: "Чума", id: "Wabah" },
  fire_ritual: { en: "Fire Ritual", ru: "Ритуал огня", id: "Ritual api" },
};

const SPELL_DESCRIPTIONS: Record<string, TranslationEntry> = {
  ignite: { en: "{kw:spell} Replace a random card in opponent's hand with 🔥 Flame", ru: "{kw:spell} Заменяет случайную карту в руке противника на 🔥 Пламя", id: "{kw:spell} Ganti kartu acak di tangan lawan dengan 🔥 Api" },
  gold_rain: { en: "{kw:spell} Everyone gets +1💰", ru: "{kw:spell} Все получают +1💰", id: "{kw:spell} Semua pemain dapat +1💰" },
  holy_day: { en: "{kw:spell} Until end of day: all districts become blue", ru: "{kw:spell} До конца дня: все кварталы синие", id: "{kw:spell} Hingga akhir hari: semua distrik jadi biru" },
  flood: { en: "{kw:spell} Up to 4 random districts from each player return to hand", ru: "{kw:spell} До 4 случайных кварталов у каждого возвращаются в руку", id: "{kw:spell} Sampai 4 distrik acak tiap pemain kembali ke tangan" },
  plague: { en: "{kw:spell} 3-day effect: each day a random player loses gold, a random district takes damage", ru: "{kw:spell} Эффект 3 дня: каждый день случайный игрок теряет золото, случайный квартал получает урон", id: "{kw:spell} Efek 3 hari: tiap hari pemain acak kehilangan emas, distrik acak kena damage" },
  fire_ritual: { en: "{kw:spell} Burn one of your built districts. For every gold of its cost, plant a 🔥 Flame in a random opponent's hand", ru: "{kw:spell} Сожгите вашу постройку. За каждое золото её цены подбрасывает 🔥 Пламя в руку случайного противника", id: "{kw:spell} Bakar bangunan Anda. Untuk tiap emas dari biayanya, tanam 🔥 Api di tangan lawan acak" },
};

// ---- Placeholder stub name ----
const PLACEHOLDER_NAME: TranslationEntry = {
  en: "Purple Card!", ru: "Фиолетовая карта!", id: "Kartu ungu!",
};

// ---- Log message translation ----
// Log messages come from game-core in Russian. We translate them on display.
const LOG_PATTERNS: Array<{ pattern: RegExp; en: (...m: string[]) => string; id?: (...m: string[]) => string }> = [
  { pattern: /💀 (.+?) \((.+?)\) был убит! Ход пропущен\./, en: (_, name, pname) => `💀 ${name} (${pname}) was killed! Turn skipped.`, id: (_, name, pname) => `💀 ${name} (${pname}) terbunuh! Giliran dilewati.` },
  { pattern: /(.+?) украл (\d+) золота у убитого (.+)/, en: (_, a, g, b) => `${a} stole ${g} gold from killed ${b}`, id: (_, a, g, b) => `${a} mencuri ${g} emas dari ${b} yang terbunuh` },
  { pattern: /(.+?) украл (\d+) золота у (.+)/, en: (_, a, g, b) => `${a} stole ${g} gold from ${b}`, id: (_, a, g, b) => `${a} mencuri ${g} emas dari ${b}` },
  { pattern: /(.+?) \(Король\) \+(\d+) золота за жёлтые кварталы/, en: (_, n, g) => `${n} (King) +${g} gold for yellow districts`, id: (_, n, g) => `${n} (Raja) +${g} emas untuk distrik kuning` },
  { pattern: /(.+?) \(Клерик\) \+(\d+) золота за синие кварталы/, en: (_, n, g) => `${n} (Cleric) +${g} gold for blue districts`, id: (_, n, g) => `${n} (Klerik) +${g} emas untuk distrik biru` },
  { pattern: /(.+?) \(Казначей\) \+(\d+) золота \((\d+) зелёных \+1 бонус\)/, en: (_, n, g, c) => `${n} (Treasurer) +${g} gold (${c} green +1 bonus)`, id: (_, n, g, c) => `${n} (Bendahara) +${g} emas (${c} hijau +1 bonus)` },
  { pattern: /(.+?) \(Архитектор\) берёт (\d+) карты, может строить до 3/, en: (_, n, c) => `${n} (Architect) draws ${c} cards, can build up to 3`, id: (_, n, c) => `${n} (Arsitek) ambil ${c} kartu, boleh bangun hingga 3` },
  { pattern: /(.+?) \(Генерал\) \+(\d+) золота за красные кварталы/, en: (_, n, g) => `${n} (General) +${g} gold for red districts`, id: (_, n, g) => `${n} (Jenderal) +${g} emas untuk distrik merah` },
  { pattern: /(.+?) \(Лидер\) автоматически выставил Врата в город/, en: (_, n) => `${n} (Leader) auto-built City Gates`, id: (_, n) => `${n} (Pemimpin) otomatis membangun Gerbang Kota` },
  { pattern: /(.+?) совершил убийство\.\.\./, en: (_, n) => `${n} committed murder...`, id: (_, n) => `${n} melakukan pembunuhan...` },
  { pattern: /🗡️ Убийца выбрал (.+)/, en: (_, h) => `🗡️ Assassin targeted ${h}`, id: (_, h) => `🗡️ Pembunuh menargetkan ${h}` },
  { pattern: /🪙 Вор выбрал (.+)/, en: (_, h) => `🪙 Thief targeted ${h}`, id: (_, h) => `🪙 Pencuri menargetkan ${h}` },
  { pattern: /🟣 (.+?) разыграл заглушку — выбирает (\d+) из (\d+)/, en: (_, n, k, m) => `🟣 ${n} plays the placeholder — picks ${k} of ${m}`, id: (_, n, k, m) => `🟣 ${n} memainkan placeholder — pilih ${k} dari ${m}` },
  { pattern: /🟣 (.+?) разыграл заглушку — последняя карта из пула/, en: (_, n) => `🟣 ${n} plays the placeholder — last card from the pool`, id: (_, n) => `🟣 ${n} memainkan placeholder — kartu terakhir dari pool` },
  { pattern: /🟣 (.+?) разыграл заглушку — пул пуст, заглушка возвращается в колоду/, en: (_, n) => `🟣 ${n} plays the placeholder — pool empty, stub returns to deck`, id: (_, n) => `🟣 ${n} memainkan placeholder — pool kosong, stub kembali ke dek` },
  { pattern: /🟣 (.+?) выбрал карту/, en: (_, n) => `🟣 ${n} picked a card`, id: (_, n) => `🟣 ${n} memilih kartu` },
  { pattern: /(.+?) \(Чародей\) сбросил (\d+) карт, взял (\d+)/, en: (_, n, d, w) => `${n} (Sorcerer) discarded ${d} cards, drew ${w}`, id: (_, n, d, w) => `${n} (Penyihir) buang ${d} kartu, ambil ${w}` },
  { pattern: /(.+?) \(Чародей\) обменялся рукой с (.+)/, en: (_, n, t) => `${n} (Sorcerer) swapped hands with ${t}`, id: (_, n, t) => `${n} (Penyihir) tukar tangan dengan ${t}` },
  { pattern: /(.+?) \(Генерал\) разрушил (.+?) у (.+?) за (\d+) золота/, en: (_, n, d, t, g) => `${n} (General) destroyed ${tDistrict(d)} from ${t} for ${g} gold`, id: (_, n, d, t, g) => `${n} (Jenderal) menghancurkan ${tDistrict(d)} milik ${t} seharga ${g} emas` },
  { pattern: /(.+?) \(Генерал\) повредил (.+?) у (.+?) \((\d+)→(\d+)\) за (\d+) золота/, en: (_, n, d, t, c1, c2, g) => `${n} (General) damaged ${tDistrict(d)} of ${t} (${c1}→${c2}) for ${g} gold`, id: (_, n, d, t, c1, c2, g) => `${n} (Jenderal) merusak ${tDistrict(d)} milik ${t} (${c1}→${c2}) seharga ${g} emas` },
  { pattern: /(.+?) построил (\d+) кварталов! Последний день\./, en: (_, n, c) => `${n} built ${c} districts! Final day.`, id: (_, n, c) => `${n} membangun ${c} distrik! Hari terakhir.` },
  { pattern: /(.+?) построил 4 алтаря тьмы! Последний день\./, en: (_, n) => `${n} built 4 Altars of Darkness! Final day.`, id: (_, n) => `${n} membangun 4 Altar Kegelapan! Hari terakhir.` },
  { pattern: /(.+?): (\d+) очков/, en: (_, n, s) => `${n}: ${s} points`, id: (_, n, s) => `${n}: ${s} poin` },

  // Income / hand events
  { pattern: /💰 (.+?) берёт \+2 золота/, en: (_, n) => `💰 ${n} takes +2 gold`, id: (_, n) => `💰 ${n} ambil +2 emas` },
  { pattern: /🃏 (.+?) берёт 2 карты \(выбирает 1\)/, en: (_, n) => `🃏 ${n} draws 2 cards (picks 1)`, id: (_, n) => `🃏 ${n} ambil 2 kartu (pilih 1)` },
  { pattern: /🃏 (.+?) выбрал карту/, en: (_, n) => `🃏 ${n} picked a card`, id: (_, n) => `🃏 ${n} memilih kartu` },
  { pattern: /(.+?) — шулер: \+2💰 и выбор из 2 карт/, en: (_, n) => `${n} — Swindler: +2💰 and choice of 2 cards`, id: (_, n) => `${n} — Penipu: +2💰 dan pilih 2 kartu` },
  { pattern: /💥 (.+?): (\d+) карт\(ы\) рассыпались \(лимит руки 10\)/, en: (_, n, c) => `💥 ${n}: ${c} card(s) overflowed (hand limit 10)`, id: (_, n, c) => `💥 ${n}: ${c} kartu meluap (batas tangan 10)` },
  { pattern: /💥 (.+?): 1 карт\(ы\) рассыпались \(лимит руки 10\)/, en: (_, n) => `💥 ${n}: 1 card overflowed (hand limit 10)`, id: (_, n) => `💥 ${n}: 1 kartu meluap (batas tangan 10)` },
  { pattern: /🏗️ (.+?) построил (.+)/, en: (_, n, d) => `🏗️ ${n} built ${tDistrict(d)}`, id: (_, n, d) => `🏗️ ${n} membangun ${tDistrict(d)}` },

  // Spells
  { pattern: /🔥 (.+?) применил Поджигание к (.+)/, en: (_, n, t) => `🔥 ${n} cast Ignite on ${t}`, id: (_, n, t) => `🔥 ${n} memantra Pembakaran pada ${t}` },
  { pattern: /🌧️ (.+?) применил Золотой дождь: все получили \+1💰/, en: (_, n) => `🌧️ ${n} cast Gold Rain: everyone got +1💰`, id: (_, n) => `🌧️ ${n} memantra Hujan Emas: semua dapat +1💰` },
  { pattern: /✨ (.+?) применил Священный день: до конца дня все кварталы синие/, en: (_, n) => `✨ ${n} cast Holy Day: all districts turn blue until end of day`, id: (_, n) => `✨ ${n} memantra Hari Suci: semua distrik jadi biru sampai akhir hari` },
  { pattern: /🌊 (.+?) применил Потоп: до 4 случайных кварталов у каждого вернулись в руку/, en: (_, n) => `🌊 ${n} cast Flood: up to 4 random districts per player returned to hand`, id: (_, n) => `🌊 ${n} memantra Banjir: sampai 4 distrik acak tiap pemain kembali ke tangan` },
  { pattern: /☣️ (.+?) применил Чуму: эффект активен 3 дня/, en: (_, n) => `☣️ ${n} cast Plague: 3-day effect active`, id: (_, n) => `☣️ ${n} memantra Wabah: efek 3 hari aktif` },
  { pattern: /🔥 (.+?) применил Ритуал огня: сжёг (.+?), разослал (\d+) 🔥 случайным противникам/, en: (_, n, d, c) => `🔥 ${n} cast Fire Ritual: burned ${tDistrict(d)}, planted ${c} 🔥 in random opponents`, id: (_, n, d, c) => `🔥 ${n} memantra Ritual Api: bakar ${tDistrict(d)}, tanam ${c} 🔥 ke lawan acak` },

  // Plague effects
  { pattern: /☣️ Чума: (.+?) потерял 1💰/, en: (_, n) => `☣️ Plague: ${n} lost 1💰`, id: (_, n) => `☣️ Wabah: ${n} kehilangan 1💰` },
  { pattern: /☣️ Чума: у (.+?) разрушен (.+)/, en: (_, n, d) => `☣️ Plague: ${tDistrict(d)} of ${n} destroyed`, id: (_, n, d) => `☣️ Wabah: ${tDistrict(d)} milik ${n} hancur` },
  { pattern: /☣️ Чума: у (.+?) повреждён (.+?) \((\d+)→(\d+)\)/, en: (_, n, d, c1, c2) => `☣️ Plague: ${tDistrict(d)} of ${n} damaged (${c1}→${c2})`, id: (_, n, d, c1, c2) => `☣️ Wabah: ${tDistrict(d)} milik ${n} rusak (${c1}→${c2})` },

  // Mine / city gates
  { pattern: /⛏️ (.+?) — шахта: \+(\d+)💰/, en: (_, n, g) => `⛏️ ${n} — Mine: +${g}💰`, id: (_, n, g) => `⛏️ ${n} — Tambang: +${g}💰` },
  { pattern: /⛏️ (.+?) — шахта \(торговец\): \+(\d+)💰/, en: (_, n, g) => `⛏️ ${n} — Mine (Merchant): +${g}💰`, id: (_, n, g) => `⛏️ ${n} — Tambang (Pedagang): +${g}💰` },
  { pattern: /🚪 Врата в город у (.+?) в руке: стоимость → (\d+)/, en: (_, n, c) => `🚪 City Gates in ${n}'s hand: cost → ${c}`, id: (_, n, c) => `🚪 Gerbang Kota di tangan ${n}: harga → ${c}` },

  // Pyromancer flames at end of turn
  { pattern: /🔥 Пламя у (.+?): сгорело карт (\d+), новых огней (\d+)/, en: (_, n, b, s) => `🔥 Flames in ${n}'s hand: ${b} cards burned, ${s} new flames`, id: (_, n, b, s) => `🔥 Api di tangan ${n}: ${b} kartu terbakar, ${s} api baru` },
  { pattern: /🧨 (.+?) потерял: (.+)/, en: (_, n, list) => `🧨 ${n} lost: ${list}`, id: (_, n, list) => `🧨 ${n} kehilangan: ${list}` },
  { pattern: /🧨 (.+?) взорвал Склад тротила: (\d+) урона распределено между постройками/, en: (_, n, d) => `🧨 ${n} blew up TNT Storage: ${d} damage spread across districts`, id: (_, n, d) => `🧨 ${n} meledakkan Gudang TNT: ${d} damage tersebar di distrik` },

  // Treasurer companion eod
  { pattern: /(.+?) — торговец: (.+?) отдал (\d+)💰/, en: (_, n, src, g) => `${n} — Trader: ${src} gave ${g}💰`, id: (_, n, src, g) => `${n} — Pedagang: ${src} memberi ${g}💰` },
  { pattern: /(.+?) — торговец: (.+?) отдал (\d+)💰 и карту/, en: (_, n, src, g) => `${n} — Trader: ${src} gave ${g}💰 and a card`, id: (_, n, src, g) => `${n} — Pedagang: ${src} memberi ${g}💰 dan satu kartu` },
  { pattern: /(.+?) — шут: все карты перемешаны!/, en: (_, n) => `${n} — Jester: all hands shuffled!`, id: (_, n) => `${n} — Badut: semua tangan diacak!` },

  // Companion uses
  { pattern: /(.+?) — фермер приносит \+1 золото/, en: (_, n) => `${n} — Farmer brings +1 gold`, id: (_, n) => `${n} — Petani membawa +1 emas` },
  { pattern: /(.+?) — охотник: (.+?) сбросил (\d+) карт/, en: (_, n, t, c) => `${n} — Hunter: ${t} discarded ${c} cards`, id: (_, n, t, c) => `${n} — Pemburu: ${t} membuang ${c} kartu` },
  { pattern: /(.+?) — каменщик: (.+)/, en: (_, n, rest) => `${n} — Mason: ${rest}`, id: (_, n, rest) => `${n} — Tukang batu: ${rest}` },
  { pattern: /(.+?) — диверсант: компаньон (.+?) отключён на сегодня/, en: (_, n, t) => `${n} — Saboteur: ${t}'s companion disabled for today`, id: (_, n, t) => `${n} — Penyabotase: companion ${t} dinonaktifkan hari ini` },
  { pattern: /(.+?) — кузнец: (.+?) → (.+?) у (.+)/, en: (_, n, before, after, owner) => `${n} — Blacksmith: ${tDistrict(before)} → ${tDistrict(after)} on ${owner}`, id: (_, n, before, after, owner) => `${n} — Pandai besi: ${tDistrict(before)} → ${tDistrict(after)} di ${owner}` },
  { pattern: /(.+?) — алхимик: (.+?) → (.+)/, en: (_, n, before, after) => `${n} — Alchemist: ${tDistrict(before)} → ${tDistrict(after)}`, id: (_, n, before, after) => `${n} — Alkemis: ${tDistrict(before)} → ${tDistrict(after)}` },
  { pattern: /(.+?) — бард: убрал компаньона (.+)/, en: (_, n, t) => `${n} — Bard: removed ${t}'s companion`, id: (_, n, t) => `${n} — Pujangga: hapus companion ${t}` },
  { pattern: /(.+?) — канонир: сжёг (.+?), разрушил (.+?) у (.+?)!/, en: (_, n, hand, d, owner) => `${n} — Cannoneer: burned ${tDistrict(hand)}, destroyed ${tDistrict(d)} on ${owner}!`, id: (_, n, hand, d, owner) => `${n} — Penembak meriam: bakar ${tDistrict(hand)}, hancurkan ${tDistrict(d)} milik ${owner}!` },
  { pattern: /(.+?) — канонир: сжёг (.+?), повредил (.+?) у (.+?) \((\d+)→(\d+)\)/, en: (_, n, hand, d, owner, c1, c2) => `${n} — Cannoneer: burned ${tDistrict(hand)}, damaged ${tDistrict(d)} on ${owner} (${c1}→${c2})`, id: (_, n, hand, d, owner, c1, c2) => `${n} — Penembak meriam: bakar ${tDistrict(hand)}, rusak ${tDistrict(d)} milik ${owner} (${c1}→${c2})` },
  { pattern: /(.+?) — реконструктор: восстановил (.+?)!/, en: (_, n, d) => `${n} — Reconstructor: rebuilt ${tDistrict(d)}!`, id: (_, n, d) => `${n} — Rekonstruktor: bangun ulang ${tDistrict(d)}!` },
  { pattern: /(.+?) — сомнительный делец: всё стало (.+?)!/, en: (_, n, color) => `${n} — Dubious Dealer: everything turned ${color}!`, id: (_, n, color) => `${n} — Pedagang mencurigakan: semua jadi ${color}!` },
  { pattern: /(.+?) — ученик чародея: построил (.+?) из сброса/, en: (_, n, d) => `${n} — Apprentice: built ${tDistrict(d)} from discard`, id: (_, n, d) => `${n} — Murid penyihir: bangun ${tDistrict(d)} dari buangan` },
  { pattern: /(.+?) — странный торговец: продал (.+?) за (\d+)💰/, en: (_, n, d, g) => `${n} — Strange Merchant: sold ${tDistrict(d)} for ${g}💰`, id: (_, n, d, g) => `${n} — Pedagang aneh: jual ${tDistrict(d)} seharga ${g}💰` },
  { pattern: /(.+?) — пиромант: подбросил 🔥 Пламя в руку (.+)/, en: (_, n, t) => `${n} — Pyromancer: planted 🔥 Flame in ${t}'s hand`, id: (_, n, t) => `${n} — Penyihir api: tanam 🔥 Api di tangan ${t}` },
  { pattern: /(.+?) — пиромант: (.+?) → 🔥 Пламя/, en: (_, n, d) => `${n} — Pyromancer: ${tDistrict(d)} → 🔥 Flame`, id: (_, n, d) => `${n} — Penyihir api: ${tDistrict(d)} → 🔥 Api` },
  { pattern: /(.+?) — снайпер: навсегда убрал (.+?) у (.+?)!/, en: (_, n, comp, t) => `${n} — Sniper: permanently removed ${comp} from ${t}!`, id: (_, n, comp, t) => `${n} — Penembak jitu: hapus permanen ${comp} dari ${t}!` },
  { pattern: /(.+?) — фанатик солнца: заменил компаньона (.+?) на (.+)/, en: (_, n, t, c) => `${n} — Sun Fanatic: replaced ${t}'s companion with ${c}`, id: (_, n, t, c) => `${n} — Fanatik matahari: ganti companion ${t} dengan ${c}` },
  { pattern: /(.+?) — рыбак: построил (.+?) \(2💰\)/, en: (_, n, d) => `${n} — Fisherman: built ${tDistrict(d)} (2💰)`, id: (_, n, d) => `${n} — Nelayan: bangun ${tDistrict(d)} (2💰)` },
  { pattern: /(.+?) — неудачный маг: случайно сброшена (.+?), все постройки стали ей!/, en: (_, n, d) => `${n} — Unlucky Mage: randomly discarded ${tDistrict(d)}, all districts became it!`, id: (_, n, d) => `${n} — Penyihir sial: buang acak ${tDistrict(d)}, semua distrik jadi itu!` },
  { pattern: /(.+?) — дизайнер: (.+?) → (.+)/, en: (_, n, before, after) => `${n} — Designer: ${tDistrict(before)} → ${tDistrict(after)}`, id: (_, n, before, after) => `${n} — Desainer: ${tDistrict(before)} → ${tDistrict(after)}` },
  { pattern: /(.+?) — трактирщик: (.+)/, en: (_, n, rest) => `${n} — Innkeeper: ${rest}`, id: (_, n, rest) => `${n} — Penjaga penginapan: ${rest}` },
  { pattern: /(.+?) — миротворец: (.+)/, en: (_, n, rest) => `${n} — Peacemaker: ${rest}`, id: (_, n, rest) => `${n} — Pembawa damai: ${rest}` },
  { pattern: /(.+?) — заказчик: цель назначена/, en: (_, n) => `${n} — Contractor: target assigned`, id: (_, n) => `${n} — Kontraktor: target ditetapkan` },
  { pattern: /(.+?) — ночная тень: убийство за 2💰\.\.\./, en: (_, n) => `${n} — Night Shadow: assassination for 2💰...`, id: (_, n) => `${n} — Bayangan malam: pembunuhan seharga 2💰...` },
  { pattern: /(.+?) — торговец сокровищами: получена (.+)/, en: (_, n, d) => `${n} — Treasure Trader: received ${tDistrict(d)}`, id: (_, n, d) => `${n} — Pedagang harta: terima ${tDistrict(d)}` },

  // Activated buildings
  { pattern: /(.+?) — пушка: разрушил (.+?) у (.+?)!/, en: (_, n, d, t) => `${n} — Cannon: destroyed ${tDistrict(d)} on ${t}!`, id: (_, n, d, t) => `${n} — Meriam: hancurkan ${tDistrict(d)} milik ${t}!` },
  { pattern: /(.+?) — пушка: (.+?) у (.+?) (\d+)→(\d+)/, en: (_, n, d, t, c1, c2) => `${n} — Cannon: ${tDistrict(d)} on ${t} ${c1}→${c2}`, id: (_, n, d, t, c1, c2) => `${n} — Meriam: ${tDistrict(d)} milik ${t} ${c1}→${c2}` },
  { pattern: /🕯️ (.+?) активировал Секту: (.+?) у (.+?) превращён в Секту/, en: (_, n, d, t) => `🕯️ ${n} activated Cult: ${tDistrict(d)} on ${t} turned into Cult`, id: (_, n, d, t) => `🕯️ ${n} mengaktifkan Kultus: ${tDistrict(d)} milik ${t} jadi Kultus` },
  { pattern: /(.+?) — склеп: уничтожен, получено 2 фиолетовые постройки/, en: (_, n) => `${n} — Crypt: destroyed, gained 2 random purple buildings`, id: (_, n) => `${n} — Makam: hancur, dapat 2 bangunan ungu acak` },
  { pattern: /⚰️ Склеп (.+?) разрушен — получено 2 фиолетовые карты/, en: (_, n) => `⚰️ ${n}'s Crypt destroyed — gained 2 purple cards`, id: (_, n) => `⚰️ Makam ${n} hancur — dapat 2 kartu ungu` },
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

// ---- Spell translations (canonical: this file) ----
export function tSpellName(nameOrAbility: string): string {
  // Name passed → translate via tDistrict which covers all purple/spell names.
  if (SPELL_NAMES[nameOrAbility]) {
    const entry = SPELL_NAMES[nameOrAbility];
    return entry[currentLang] ?? entry.en;
  }
  return tDistrict(nameOrAbility);
}

export function tSpellDesc(ability: string): string {
  const entry = SPELL_DESCRIPTIONS[ability];
  if (entry) return entry[currentLang] ?? entry.en;
  // Last-resort fallback (e.g., ids not yet added).
  const def = findSpellByAbility(ability);
  if (!def) return ability;
  return def.description[currentLang as "en" | "ru"] ?? def.description.en;
}

// ---- Purple card translations (canonical: this file) ----
export function tPurpleName(nameOrAbility: string): string {
  if (PURPLE_NAMES[nameOrAbility]) {
    const entry = PURPLE_NAMES[nameOrAbility];
    return entry[currentLang] ?? entry.en;
  }
  return tDistrict(nameOrAbility);
}

export function tPurpleDesc(ability: string): string {
  const entry = PURPLE_DESCRIPTIONS[ability];
  if (entry) return entry[currentLang] ?? entry.en;
  const def = findPurpleByAbility(ability);
  if (!def) return ability;
  return def.description[currentLang as "en" | "ru"] ?? def.description.en;
}

// ---- Game Guide content ----
export function getGuideHtml(): string {
  if (currentLang === "ru") return GUIDE_RU;
  return GUIDE_EN;
}

const GUIDE_RU = `
<div class="guide-section">
  <h4>Цель игры</h4>
  <p>Постройте <b>8 кварталов</b> раньше всех (или <b>4 алтаря тьмы</b>). Игра длится до 12 дней. Побеждает игрок с наибольшим количеством очков.</p>
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
  <p>Build <b>8 districts</b> before anyone else (or <b>4 Altars of Darkness</b>). The game lasts up to 12 days. The player with the most points wins.</p>
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
