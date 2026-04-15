export type ThemeSlug =
  | "terre_doc"
  | "provence"
  | "atlantique"
  | "alpin"
  | "ble_dore"
  | "corse"
  | "champagne"
  | "ardoise";

export type ThemeConfig = {
  name: string;
  region: string;
  gradient: [string, string, string];
  primary: string;
  background: string;
  muted: string;
  pinBg: string;
};

export const THEMES: Record<ThemeSlug, ThemeConfig> = {
  terre_doc: {
    name: "Terre d'Oc",
    region: "Sud-Ouest",
    gradient: ["#BF3328", "#D35230", "#E49035"],
    primary: "#D35230",
    background: "#FBF7F1",
    muted: "#BBA98E",
    pinBg: "#FDF0EB",
  },
  provence: {
    name: "Provence",
    region: "Sud-Est",
    gradient: ["#6B3FA0", "#8B5DC8", "#A87DDC"],
    primary: "#6B3FA0",
    background: "#F8F4FB",
    muted: "#B0A3C4",
    pinBg: "#F0E8F8",
  },
  atlantique: {
    name: "Atlantique",
    region: "Bretagne / Ouest",
    gradient: ["#1A5276", "#217DAB", "#2E9BC6"],
    primary: "#1A5276",
    background: "#F2F7F9",
    muted: "#90AEBB",
    pinBg: "#E4F0F6",
  },
  alpin: {
    name: "Alpin",
    region: "Rhône-Alpes",
    gradient: ["#1B5E3B", "#28804E", "#3AA66A"],
    primary: "#1B5E3B",
    background: "#F2F7F3",
    muted: "#8EAE96",
    pinBg: "#E4F2E8",
  },
  ble_dore: {
    name: "Blé Doré",
    region: "Centre",
    gradient: ["#C8900A", "#E2A80E", "#F0C030"],
    primary: "#C8900A",
    background: "#FFFCF0",
    muted: "#B0A46A",
    pinBg: "#FFF6D6",
  },
  corse: {
    name: "Corse",
    region: "Île de Beauté",
    gradient: ["#A03018", "#C04428", "#DA6030"],
    primary: "#A03018",
    background: "#FDF5EF",
    muted: "#C08A74",
    pinBg: "#FDECE6",
  },
  champagne: {
    name: "Champagne",
    region: "Nord-Est",
    gradient: ["#B83070", "#D44888", "#E868A4"],
    primary: "#B83070",
    background: "#FEF5F7",
    muted: "#C890A8",
    pinBg: "#FDE8F2",
  },
  ardoise: {
    name: "Ardoise",
    region: "Normandie / Nord",
    gradient: ["#2C4A6E", "#3D6490", "#5080B0"],
    primary: "#2C4A6E",
    background: "#F0F4F8",
    muted: "#88A0B8",
    pinBg: "#E0EAF4",
  },
};

export const DEFAULT_THEME: ThemeSlug = "terre_doc";

export function getTheme(slug: string | null | undefined): ThemeConfig {
  if (slug && slug in THEMES) return THEMES[slug as ThemeSlug];
  return THEMES[DEFAULT_THEME];
}

import { deriveThemeFromColor, isValidHexColor } from "../utils/color";

/**
 * Resolve the final theme config, applying custom primary color if set.
 * This is the function all surfaces should call instead of getTheme().
 */
export function resolveTheme(
  themeSlug: string | null | undefined,
  customPrimaryColor: string | null | undefined
): ThemeConfig {
  const base = getTheme(themeSlug);
  if (!customPrimaryColor || !isValidHexColor(customPrimaryColor)) return base;

  const derived = deriveThemeFromColor(customPrimaryColor);
  return {
    ...base,
    ...derived,
  };
}
