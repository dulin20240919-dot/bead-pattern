import type { BeadColor, Rgb } from "./types";

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rr:
      h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
      break;
    case gg:
      h = ((bb - rr) / d + 2) / 6;
      break;
    default:
      h = ((rr - gg) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

/** Douge: √(2ΔR² + 4ΔG² + 3ΔB²) */
export function colorDistance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

/**
 * Douge betterColorDistance: 0.7 * weightedRGB + 0.3 * HSL distance.
 * 颜色量化滑条 0–100 直接作为 mergeThreshold 与此距离比较。
 */
export function betterColorDistance(a: Rgb, b: Rgb): number {
  const rgbDist = colorDistance(a, b);
  const ha = rgbToHsl(a);
  const hb = rgbToHsl(b);
  let dh = Math.abs(ha.h - hb.h);
  if (dh > 180) dh = 360 - dh;
  const ds = Math.abs(ha.s - hb.s);
  const dl = Math.abs(ha.l - hb.l);
  const hslDist = Math.sqrt(dh * dh + ds * ds + dl * dl);
  return 0.7 * rgbDist + 0.3 * hslDist;
}

export function findClosestColor(palette: BeadColor[], rgb: Rgb): BeadColor {
  if (!palette.length) {
    return { key: "UNKNOWN", hex: "#FFFFFF", rgb: { r: 255, g: 255, b: 255 } };
  }
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const d = betterColorDistance(rgb, c.rgb);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export function getColorByKey(palette: BeadColor[], key: string): BeadColor | null {
  return palette.find((c) => c.key === key) ?? null;
}

export function makePalette(entries: { key: string; hex: string; name?: string }[]): BeadColor[] {
  return entries.map((e) => ({
    key: e.key,
    hex: e.hex.toUpperCase(),
    name: e.name,
    rgb: hexToRgb(e.hex),
  }));
}
