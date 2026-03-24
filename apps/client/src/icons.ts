/** Inline SVG icons for heroes and district colors */

const SZ = 32;

function svg(inner: string, viewBox = `0 0 ${SZ} ${SZ}`): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SZ}" height="${SZ}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export const HERO_ICONS: Record<string, string> = {
  // Assassin — dagger
  assassin: svg(`
    <line x1="8" y1="24" x2="24" y2="8" stroke="#e94560"/>
    <polygon points="24,8 20,6 22,4" fill="#e94560" stroke="#e94560"/>
    <line x1="8" y1="24" x2="6" y2="22" stroke="#888"/>
    <line x1="6" y1="22" x2="10" y2="20" stroke="#888"/>
    <circle cx="16" cy="16" r="1.5" fill="#e94560"/>
  `),

  // Thief — mask
  thief: svg(`
    <path d="M6 14 Q16 8 26 14 Q26 20 22 22 L20 20 Q16 22 12 20 L10 22 Q6 20 6 14Z" fill="#333" stroke="#c0a040"/>
    <circle cx="12" cy="16" r="2.5" fill="none" stroke="#c0a040"/>
    <circle cx="20" cy="16" r="2.5" fill="none" stroke="#c0a040"/>
  `),

  // Sorcerer — magic star
  sorcerer: svg(`
    <polygon points="16,4 18.5,12 27,12 20,17.5 22.5,26 16,21 9.5,26 12,17.5 5,12 13.5,12" fill="#7c3aed" stroke="#a78bfa"/>
    <circle cx="16" cy="15" r="2" fill="#a78bfa"/>
  `),

  // King — crown
  king: svg(`
    <polygon points="4,24 6,12 10,18 16,8 22,18 26,12 28,24" fill="#f0c040" stroke="#d4a020"/>
    <rect x="4" y="24" width="24" height="3" rx="1" fill="#f0c040" stroke="#d4a020"/>
    <circle cx="16" cy="12" r="1.5" fill="#d4a020"/>
    <circle cx="10" cy="18" r="1" fill="#d4a020"/>
    <circle cx="22" cy="18" r="1" fill="#d4a020"/>
  `),

  // Cleric — cross with halo
  cleric: svg(`
    <circle cx="16" cy="10" r="6" fill="none" stroke="#4090f0" stroke-dasharray="2 2"/>
    <rect x="14" y="8" width="4" height="18" rx="1" fill="#4090f0" stroke="#2070d0"/>
    <rect x="9" y="14" width="14" height="4" rx="1" fill="#4090f0" stroke="#2070d0"/>
  `),

  // Merchant — coin stack
  merchant: svg(`
    <ellipse cx="16" cy="22" rx="8" ry="4" fill="#40c060" stroke="#20a040"/>
    <ellipse cx="16" cy="18" rx="8" ry="4" fill="#50d070" stroke="#20a040"/>
    <ellipse cx="16" cy="14" rx="8" ry="4" fill="#60e080" stroke="#20a040"/>
    <text x="16" y="17.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#0a5020" stroke="none">$</text>
  `),

  // Architect — compass/protractor
  architect: svg(`
    <polygon points="16,4 6,28 26,28" fill="none" stroke="#f090a0" stroke-width="2"/>
    <line x1="16" y1="4" x2="16" y2="28" stroke="#f090a0" stroke-width="1"/>
    <line x1="11" y1="16" x2="21" y2="16" stroke="#f090a0" stroke-width="1"/>
    <circle cx="16" cy="18" r="2" fill="#f090a0"/>
  `),

  // General — sword + shield
  general: svg(`
    <path d="M8 8 L8 22 Q8 26 16 28 Q24 26 24 22 L24 8 Z" fill="#e04050" stroke="#c02030" fill-opacity="0.3"/>
    <line x1="16" y1="6" x2="16" y2="22" stroke="#c02030" stroke-width="2"/>
    <line x1="10" y1="12" x2="22" y2="12" stroke="#c02030" stroke-width="2"/>
  `),
};

/** Small colored circle for district card colors */
export function districtColorDot(color: string): string {
  const colors: Record<string, string> = {
    yellow: "#f0c040",
    blue: "#4090f0",
    green: "#40c060",
    red: "#e04050",
    purple: "#9060e0",
  };
  const c = colors[color] ?? "#888";
  return `<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="${c}" stroke="${c}" stroke-width="1"/></svg>`;
}

/** Hero icon sized for buttons (larger) */
export function heroIconLarge(heroId: string): string {
  const icon = HERO_ICONS[heroId];
  if (!icon) return "";
  return icon.replace(`width="${SZ}"`, 'width="40"').replace(`height="${SZ}"`, 'height="40"');
}

/** Color associated with each hero class */
const HERO_COLORS: Record<string, string> = {
  assassin: "#e94560",
  thief: "#c0a040",
  sorcerer: "#7c3aed",
  king: "#f0c040",
  cleric: "#4090f0",
  merchant: "#40c060",
  architect: "#f090a0",
  general: "#e04050",
};

export function heroColor(heroId: string): string {
  return HERO_COLORS[heroId] ?? "#e94560";
}

/** Active skin per hero (default = "default"). Can be a static .png or animated .gif */
const activeSkins: Record<string, string> = {};

export function setHeroSkin(heroId: string, skinName: string) {
  activeSkins[heroId] = skinName;
}

/** Hero portrait image URL — supports skins and GIF animations */
export function heroPortraitUrl(heroId: string): string {
  const skin = activeSkins[heroId] || "default";
  return `/heroes/${heroId}/skins/${skin}/portrait.png`;
}

/** Hero portrait <img> tag at given size */
export function heroPortrait(heroId: string, size: number = 48): string {
  return `<img src="${heroPortraitUrl(heroId)}" alt="${heroId}" class="hero-portrait" width="${size}" height="${size}" style="width:${size}px;height:${size}px;" />`;
}

/** Hero portrait for large displays (draft buttons, player panels) */
export function heroPortraitLarge(heroId: string): string {
  return heroPortrait(heroId, 56);
}

/** Hero portrait for small inline use (tabs, banners) */
export function heroPortraitSmall(heroId: string): string {
  return heroPortrait(heroId, 20);
}
