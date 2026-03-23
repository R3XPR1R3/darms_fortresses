/** Hero identifiers — the 8 base roles */
export enum HeroId {
  Assassin = "assassin",
  Thief = "thief",
  Sorcerer = "sorcerer",
  King = "king",
  Cleric = "cleric",
  Merchant = "merchant",
  Architect = "architect",
  General = "general",
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  speed: number;
  color: CardColor | null; // assassin/thief/sorcerer are colorless
}

export type CardColor = "yellow" | "blue" | "green" | "red" | "purple";

export const HEROES: readonly HeroDefinition[] = [
  { id: HeroId.Assassin, name: "Фахира Мирай", speed: 1, color: null },
  { id: HeroId.Thief, name: "Митчелл Сайлас", speed: 2, color: null },
  { id: HeroId.Sorcerer, name: "Мастер Зедруд", speed: 3, color: null },
  { id: HeroId.King, name: "Король Ирисий Фаорис", speed: 4, color: "yellow" },
  { id: HeroId.Cleric, name: "Эшли Фирия", speed: 5, color: "blue" },
  { id: HeroId.Merchant, name: "Мархат Фахари", speed: 6, color: "green" },
  { id: HeroId.Architect, name: "Себастиан Мэйвис", speed: 7, color: null },
  { id: HeroId.General, name: "Греш Мавров", speed: 8, color: "red" },
] as const;
