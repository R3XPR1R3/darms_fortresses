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
  /** Hero class / archetype key for i18n */
  heroClass: string;
}

export type CardColor = "yellow" | "blue" | "green" | "red" | "purple";

export const HEROES: readonly HeroDefinition[] = [
  { id: HeroId.Assassin, name: "Убийца", speed: 1, color: null, heroClass: "assassin" },
  { id: HeroId.Thief, name: "Специалист", speed: 2, color: null, heroClass: "thief" },
  { id: HeroId.Sorcerer, name: "Стратег", speed: 3, color: null, heroClass: "sorcerer" },
  { id: HeroId.King, name: "Лидер", speed: 4, color: "yellow", heroClass: "king" },
  { id: HeroId.Cleric, name: "Клерик", speed: 5, color: "blue", heroClass: "cleric" },
  { id: HeroId.Merchant, name: "Казначей", speed: 6, color: "green", heroClass: "merchant" },
  { id: HeroId.Architect, name: "Архитектор", speed: 7, color: null, heroClass: "architect" },
  { id: HeroId.General, name: "Генерал", speed: 8, color: "red", heroClass: "general" },
] as const;
