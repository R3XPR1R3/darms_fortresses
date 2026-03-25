/** Companion identifiers */
export enum CompanionId {
  Farmer = "farmer",
}

export interface CompanionDefinition {
  id: CompanionId;
  name: string;
  description: string;
}

export const COMPANIONS: readonly CompanionDefinition[] = [
  { id: CompanionId.Farmer, name: "Никчемный фермер", description: "Позволяет взять ещё 1 золото" },
] as const;
