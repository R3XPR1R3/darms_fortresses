import type { DistrictDef } from "../../types.js";

// Display rename: "Бастион" / "Bastion" was retired here so the purple
// Stronghold could take that name (avoids the old "two Strongholds in EN" bug
// where the Citadel district aliased to Stronghold via i18n). The folder /
// id / file name stay as `bastion` for backward compat.
export const bastion: DistrictDef = {
  id: "bastion",
  type: "district",
  cost: 5,
  colors: ["red"],
  count: 1,
  name: { ru: "Вал", en: "Rampart", id: "Benteng" },
};
