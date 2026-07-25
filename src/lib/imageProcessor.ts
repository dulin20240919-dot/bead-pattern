import {
  betterColorDistance,
  findClosestColor,
  getColorByKey,
  hexToRgb,
} from "./color";
import type {
  BeadColor,
  BeadCount,
  GridCell,
  ProcessOptions,
  ProcessResult,
  Rgb,
} from "./types";

type CrispCandidate = {
  color: BeadColor;
  weight: number;
  centerWeight: number;
  pixelCount: number;
};

/**
 * Aligned with 豆格 pattern-generator + common OSS algorithms
 * (perler-bead-algorithm / Zippland perler-beads):
 * 1) Preserve aspect — long side = gridSize
 * 2) Mean (or crisp vote) sample per cell
 * 3) Nearest brand colour via Douge betterColorDistance
 * 4) Optional BFS merge where threshold === 颜色量化 (0–100)
 * 5) Optional border flood-fill background removal
 */
export class ImageProcessor {
  private width: number;
  private height: number;
  private gridSize: number;
  private palette: BeadColor[];
  private mergeThreshold: number;
  private enableCrispMode: boolean;
  private paletteMatchCache = new Map<string, BeadColor>();

  constructor(opts: {
    width: number;
    height: number;
    gridSize: number;
    palette: BeadColor[];
    mergeThreshold: number;
    enableCrispMode: boolean;
  }) {
    this.width = opts.width;
    this.height = opts.height;
    this.gridSize = opts.gridSize;
    this.palette = opts.palette;
    this.mergeThreshold = opts.mergeThreshold;
    this.enableCrispMode = opts.enableCrispMode;
  }

  process(imageData: Uint8ClampedArray, options: ProcessOptions): ProcessResult {
    this.paletteMatchCache.clear();
    const { grid, gridRows, gridCols } = this.pixelate(imageData);

    // 豆格: mergeThreshold 滑条原值直接参与比较
    if (this.mergeThreshold > 0) {
      this.mergeColors(grid, gridRows, gridCols);
    }
    if (options.removeBackground) {
      this.removeBackgroundColors(grid, gridRows, gridCols);
    }
    // 描边放在去背景之后：外轮廓 + 色块交界描一圈黑色
    if (options.enableOutline) {
      this.applyBlackOutline(grid, gridRows, gridCols);
    }

    return {
      grid,
      gridRows,
      gridCols,
      beadCounts: this.calculateBeadCounts(grid),
      paletteUsed: this.palette,
      paletteLabel: options.paletteLabel,
    };
  }

  private pixelate(data: Uint8ClampedArray): {
    grid: GridCell[][];
    gridRows: number;
    gridCols: number;
  } {
    const aspect = this.width / Math.max(1, this.height);
    // Long side = gridSize, keep aspect — do NOT force square letterbox (avoids “扭曲”感)
    let gridCols: number;
    let gridRows: number;
    if (aspect >= 1) {
      gridCols = this.gridSize;
      gridRows = Math.max(1, Math.round(this.gridSize / aspect));
    } else {
      gridRows = this.gridSize;
      gridCols = Math.max(1, Math.round(this.gridSize * aspect));
    }

    const grid: GridCell[][] = [];
    for (let row = 0; row < gridRows; row++) {
      grid[row] = [];
      for (let col = 0; col < gridCols; col++) {
        const x0 = Math.floor((col * this.width) / gridCols);
        const y0 = Math.floor((row * this.height) / gridRows);
        const x1 = Math.min(this.width, Math.ceil(((col + 1) * this.width) / gridCols));
        const y1 = Math.min(this.height, Math.ceil(((row + 1) * this.height) / gridRows));

        const matched = this.enableCrispMode
          ? this.getCrispBeadColor(data, x0, y0, x1, y1)
          : this.getAverageBeadColor(data, x0, y0, x1, y1);

        grid[row][col] = matched
          ? { key: matched.key, color: matched.hex, isExternal: false }
          : { key: "", color: "#FFFFFF", isExternal: true };
      }
    }
    return { grid, gridRows, gridCols };
  }

  /** Douge getDominantColor — actually channel mean of opaque pixels. */
  private getMeanColor(
    data: Uint8ClampedArray,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): Rgb | null {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = 4 * (y * this.width + x);
        if (i + 3 >= data.length) continue;
        if (data[i + 3] < 128) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
    if (!n) return null;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  }

  private getAverageBeadColor(
    data: Uint8ClampedArray,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): BeadColor | null {
    const avg = this.getMeanColor(data, x0, y0, x1, y1);
    return avg ? this.getCachedClosestColor(avg) : null;
  }

  private getCachedClosestColor(rgb: Rgb): BeadColor {
    const key = `${rgb.r},${rgb.g},${rgb.b}`;
    const cached = this.paletteMatchCache.get(key);
    if (cached) return cached;
    const color = findClosestColor(this.palette, rgb);
    this.paletteMatchCache.set(key, color);
    return color;
  }

  /** Douge crisp mode — per-pixel palette vote with center / saturation weights. */
  private getCrispBeadColor(
    data: Uint8ClampedArray,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): BeadColor | null {
    const votes = new Map<string, CrispCandidate>();
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;
    const cx = (x0 + x1 - 1) / 2;
    const cy = (y0 + y1 - 1) / 2;
    const w = Math.max(1, x1 - x0);
    const h = Math.max(1, y1 - y0);

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = 4 * (y * this.width + x);
        if (i + 3 >= data.length) continue;
        const a = data[i + 3];
        if (a < 128) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        sumR += r;
        sumG += g;
        sumB += b;
        count++;

        const matched = this.getCachedClosestColor({ r, g, b });
        const dx = Math.abs(x + 0.5 - cx) / w;
        const dy = Math.abs(y + 0.5 - cy) / h;
        const radial = Math.min(1, 1.35 * Math.sqrt(dx * dx + dy * dy));
        const centerW = 1.22 - 0.34 * radial;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        const satW = 0.94 + (sat / 255) * 0.24;
        const weight = centerW * satW * (a / 255);

        const prev = votes.get(matched.key) ?? {
          color: matched,
          weight: 0,
          centerWeight: 0,
          pixelCount: 0,
        };
        prev.weight += weight;
        prev.centerWeight += centerW;
        prev.pixelCount += 1;
        votes.set(matched.key, prev);
      }
    }
    if (!count) return null;

    const avg: Rgb = {
      r: Math.round(sumR / count),
      g: Math.round(sumG / count),
      b: Math.round(sumB / count),
    };

    let best: { score: number; color: BeadColor } | null = null;
    for (const vote of votes.values()) {
      const dist = betterColorDistance(avg, vote.color.rgb);
      const score =
        vote.weight + 0.08 * vote.centerWeight + 0.015 * vote.pixelCount - 0.0025 * dist;
      if (!best || score > best.score) best = { score, color: vote.color };
    }
    return best?.color ?? null;
  }

  private mergeColors(grid: GridCell[][], rows: number, cols: number): void {
    if (this.mergeThreshold === 0) return;

    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const rgbByKey = new Map<string, Rgb>();
    for (const row of grid) {
      for (const cell of row) {
        if (cell.key && !rgbByKey.has(cell.key)) {
          rgbByKey.set(cell.key, hexToRgb(cell.color));
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (visited[r][c] || grid[r][c].isExternal || !grid[r][c].key) continue;

        const seedKey = grid[r][c].key;
        const seedRgb = rgbByKey.get(seedKey);
        if (!seedRgb) continue;

        const region: { r: number; c: number; key: string }[] = [];
        const queue = [{ r, c }];
        visited[r][c] = true;

        while (queue.length && region.length < 20000) {
          const cur = queue.shift()!;
          region.push({ r: cur.r, c: cur.c, key: grid[cur.r][cur.c].key });
          for (const [nr, nc] of [
            [cur.r + 1, cur.c],
            [cur.r - 1, cur.c],
            [cur.r, cur.c + 1],
            [cur.r, cur.c - 1],
          ] as const) {
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || visited[nr][nc]) continue;
            if (grid[nr][nc].isExternal || !grid[nr][nc].key) continue;
            const other = rgbByKey.get(grid[nr][nc].key);
            if (!other) continue;
            if (betterColorDistance(seedRgb, other) < this.mergeThreshold) {
              visited[nr][nc] = true;
              queue.push({ r: nr, c: nc });
            }
          }
        }

        const tally = new Map<string, number>();
        let winner = seedKey;
        let max = 0;
        for (const cell of region) {
          const n = (tally.get(cell.key) ?? 0) + 1;
          tally.set(cell.key, n);
          if (n > max) {
            max = n;
            winner = cell.key;
          }
        }

        const color = getColorByKey(this.palette, winner);
        const hex = color?.hex ?? grid[r][c].color;
        for (const cell of region) {
          grid[cell.r][cell.c] = {
            key: winner,
            color: hex,
            isExternal: grid[cell.r][cell.c].isExternal,
          };
        }
      }
    }
  }

  /**
   * 在主体外轮廓、以及色差较大的色块交界处铺一圈黑色。
   * 相近肤色渐变不描边，避免整张图被黑线割碎。
   */
  private applyBlackOutline(grid: GridCell[][], rows: number, cols: number): void {
    const black = this.getCachedClosestColor({ r: 0, g: 0, b: 0 });
    const mark = Array.from({ length: rows }, () => Array(cols).fill(false));
    const EDGE_DIST = 28; // Douge betterColorDistance 量级

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell.isExternal || !cell.key) continue;
        // 已是黑色就不必再标
        if (cell.key === black.key) continue;

        const cellRgb = hexToRgb(cell.color);
        let isEdge = false;
        for (const [nr, nc] of [
          [r + 1, c],
          [r - 1, c],
          [r, c + 1],
          [r, c - 1],
        ] as const) {
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
            isEdge = true;
            break;
          }
          const n = grid[nr][nc];
          if (n.isExternal || !n.key) {
            isEdge = true;
            break;
          }
          if (n.key === cell.key || n.key === black.key) continue;
          if (betterColorDistance(cellRgb, hexToRgb(n.color)) >= EDGE_DIST) {
            isEdge = true;
            break;
          }
        }
        if (isEdge) mark[r][c] = true;
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!mark[r][c]) continue;
        grid[r][c] = {
          key: black.key,
          color: black.hex,
          isExternal: false,
        };
      }
    }
  }

  private removeBackgroundColors(grid: GridCell[][], rows: number, cols: number): void {
    const borderTally = new Map<string, number>();
    const bump = (key: string) => {
      if (!key) return;
      borderTally.set(key, (borderTally.get(key) ?? 0) + 1);
    };

    for (let c = 0; c < cols; c++) {
      bump(grid[0][c].key);
      bump(grid[rows - 1][c].key);
    }
    for (let r = 0; r < rows; r++) {
      bump(grid[r][0].key);
      bump(grid[r][cols - 1].key);
    }

    let bgKey: string | null = null;
    let max = 0;
    for (const [key, n] of borderTally) {
      if (n > max) {
        max = n;
        bgKey = key;
      }
    }
    if (!bgKey) return;

    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const queue: { r: number; c: number }[] = [];
    const enqueue = (r: number, c: number) => {
      if (r < 0 || r >= rows || c < 0 || c >= cols || visited[r][c]) return;
      if (grid[r][c].key !== bgKey) return;
      visited[r][c] = true;
      queue.push({ r, c });
    };

    for (let c = 0; c < cols; c++) {
      enqueue(0, c);
      enqueue(rows - 1, c);
    }
    for (let r = 0; r < rows; r++) {
      enqueue(r, 0);
      enqueue(r, cols - 1);
    }

    while (queue.length) {
      const { r, c } = queue.shift()!;
      grid[r][c].isExternal = true;
      enqueue(r + 1, c);
      enqueue(r - 1, c);
      enqueue(r, c + 1);
      enqueue(r, c - 1);
    }
  }

  private calculateBeadCounts(grid: GridCell[][]): BeadCount[] {
    const tally = new Map<string, { color: string; count: number }>();
    for (const row of grid) {
      for (const cell of row) {
        if (cell.isExternal || !cell.key) continue;
        const prev = tally.get(cell.key);
        if (prev) prev.count += 1;
        else tally.set(cell.key, { color: cell.color, count: 1 });
      }
    }
    return [...tally.entries()]
      .map(([key, v]) => ({ key, color: v.color, count: v.count }))
      .sort((a, b) => b.count - a.count);
  }
}

export function processImageFile(
  imageData: ImageData,
  options: ProcessOptions,
): ProcessResult {
  // 豆格：颜色量化滑条值 === mergeThreshold，不做二次映射
  const processor = new ImageProcessor({
    width: imageData.width,
    height: imageData.height,
    gridSize: options.gridSize,
    palette: options.palette,
    mergeThreshold: options.colorQuantize,
    enableCrispMode: options.enableCrispMode,
  });
  return processor.process(imageData.data, options);
}

export async function loadImageData(file: File, maxSide = 800): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  // Douge loadImageToCanvas uses maxSize≈300; we keep a bit more detail for quality
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("无法创建 Canvas 上下文");
  // Linear-ish resize: browser default smoothing when downscaling
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return ctx.getImageData(0, 0, w, h);
}
