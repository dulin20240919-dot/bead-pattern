import { makePalette } from "./color";
import brandsJson from "../data/brands.json";
import type { BeadColor } from "./types";

export type BrandPreset = {
  id: string;
  name: string;
  colors: BeadColor[];
};

export const BRAND_PRESETS: BrandPreset[] = (brandsJson as {
  id: string;
  name: string;
  colors: { key: string; hex: string }[];
}[]).map((b) => ({
  id: b.id,
  name: b.name,
  colors: makePalette(b.colors),
}));

export function getBrandById(id: string): BrandPreset {
  return BRAND_PRESETS.find((b) => b.id === id) ?? BRAND_PRESETS[0];
}

/** @deprecated use BRAND_PRESETS */
export const PALETTE_PRESETS = BRAND_PRESETS;
