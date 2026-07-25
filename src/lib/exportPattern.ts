import type { BeadCount, ProcessResult } from "./types";

export type SheetOptions = {
  /** Pixel size of each bead cell in the export sheet */
  cellSize?: number;
  /** Show color codes inside each grid cell */
  showCellKeys?: boolean;
  /** Brand / palette label under the grid, e.g. `#Artkal-S64色` */
  paletteLabel?: string;
  /** App title in yellow header */
  title?: string;
  /** JPEG quality 0–1 */
  jpegQuality?: number;
  /** User-selected grid size (long side); drives red guide interval */
  gridSize?: number;
};

type Layout = {
  width: number;
  height: number;
  cellSize: number;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  rows: number;
  cols: number;
  headerH: number;
  axisPad: number;
  majorStep: number;
  coordFont: number;
  labelY: number;
  totalCenterX: number;
  totalCenterY: number;
  totalPillW: number;
  totalPillH: number;
  legend: {
    x: number;
    y: number;
    swatch: number;
    itemW: number;
    itemH: number;
    perRow: number;
    textGap: number;
  };
  footerY: number;
  title: string;
  paletteLabel: string;
  showCellKeys: boolean;
  totalBeads: number;
  beadCounts: BeadCount[];
};

const YELLOW = "#FDD835";
const INK = "#000000";
const MUTED = "#333333";
const PAGE_BG = "#FFFFFF";
const RED_GUIDE = "#E53935";

/** Grid size ≤ this → red line every 5 cells; larger → every 10 */
const MAJOR_STEP_THRESHOLD = 80;

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function contrastInk(hex: string): string {
  return luminance(hex) > 160 ? "#000000" : "#FFFFFF";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveMajorStep(gridSize: number): number {
  return gridSize <= MAJOR_STEP_THRESHOLD ? 5 : 10;
}

export function buildSheetLayout(result: ProcessResult, options: SheetOptions = {}): Layout {
  const cellSize = options.cellSize ?? 28;
  const rows = result.gridRows;
  const cols = result.gridCols;
  const showCellKeys = options.showCellKeys ?? true;
  const title = options.title ?? "拼豆图纸";
  const paletteLabel = options.paletteLabel ?? "#Artkal-S64色";
  const beadCounts = result.beadCounts;
  const totalBeads = beadCounts.reduce((s, c) => s + c.count, 0);
  const gridSize = options.gridSize ?? Math.max(rows, cols);
  const majorStep = resolveMajorStep(gridSize);

  const headerH = Math.max(36, Math.round(cellSize * 2.4));
  const axisPad = Math.max(16, Math.round(cellSize * 0.95));
  const sideMargin = Math.max(24, Math.round(cellSize * 1.4));
  const topGap = Math.max(12, Math.round(cellSize * 0.55));

  const gridW = cols * cellSize;
  const gridH = rows * cellSize;
  const width = gridW + axisPad * 2 + sideMargin * 2;

  const gridX = sideMargin + axisPad;
  const gridY = headerH + topGap + axisPad;

  // Pattern block (axes + grid) should be ~80%; bottom (legend) ≤ 20%
  const patternBlockH = axisPad + gridH + axisPad;
  const maxBottomH = Math.max(Math.round(patternBlockH * 0.25), Math.round(cellSize * 6));

  const labelGap = Math.round(cellSize * 0.55);
  const labelY = gridY + gridH + axisPad + labelGap;
  const totalPillH = Math.max(22, Math.round(cellSize * 1.35));
  const totalText = `总计: ${totalBeads} 颗`;
  const totalPillW = Math.max(
    Math.round(cellSize * 8),
    Math.round(totalText.length * cellSize * 0.55),
  );
  const totalCenterX = width / 2;
  const totalCenterY = labelY + Math.round(cellSize * 1.1);

  const afterTotal = totalCenterY + totalPillH / 2 + Math.round(cellSize * 0.45);
  const footerReserve = Math.round(cellSize * 1.6);
  const legendBudget = Math.max(
    Math.round(cellSize * 3),
    maxBottomH - (afterTotal - (gridY + gridH + axisPad)) - footerReserve,
  );

  // Compact legend: swatch + "A4 (59)" — scale to fit ≤20% budget
  let swatch = Math.max(14, Math.round(cellSize * 1.15));
  let itemH = swatch + 4;
  let textGap = 6;
  let itemW = swatch + textGap + Math.round(cellSize * 4.2);
  const legendSide = sideMargin;
  const usable = width - legendSide * 2;
  let perRow = Math.max(1, Math.floor(usable / itemW));
  let legendRows = Math.max(1, Math.ceil(Math.max(beadCounts.length, 1) / perRow));
  let legendBlockH = legendRows * itemH;

  // Shrink until legend fits budget (or hit floor)
  while (legendBlockH > legendBudget && swatch > 10) {
    swatch -= 1;
    itemH = swatch + 4;
    itemW = swatch + textGap + Math.round(cellSize * 4.2);
    perRow = Math.max(1, Math.floor(usable / itemW));
    legendRows = Math.max(1, Math.ceil(Math.max(beadCounts.length, 1) / perRow));
    legendBlockH = legendRows * itemH;
  }

  // If still oversized, pack more columns by shortening text slot
  while (legendBlockH > legendBudget && itemW > swatch + 40) {
    itemW -= 4;
    perRow = Math.max(1, Math.floor(usable / itemW));
    legendRows = Math.max(1, Math.ceil(Math.max(beadCounts.length, 1) / perRow));
    legendBlockH = legendRows * itemH;
  }

  const legendY = afterTotal;
  const footerY = legendY + legendBlockH + Math.round(cellSize * 0.9);
  const height = footerY + Math.round(cellSize * 1.2);

  const coordFont = Math.max(8, Math.min(Math.round(cellSize * 0.42), 14));

  return {
    width,
    height,
    cellSize,
    gridX,
    gridY,
    gridW,
    gridH,
    rows,
    cols,
    headerH,
    axisPad,
    majorStep,
    coordFont,
    labelY,
    totalCenterX,
    totalCenterY,
    totalPillW,
    totalPillH,
    legend: {
      x: legendSide,
      y: legendY,
      swatch,
      itemW,
      itemH,
      perRow,
      textGap,
    },
    footerY,
    title,
    paletteLabel,
    showCellKeys,
    totalBeads,
    beadCounts,
  };
}

function drawCoordinates(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
): void {
  const { gridX, gridY, cellSize, rows, cols, coordFont, majorStep } = layout;
  ctx.fillStyle = INK;
  ctx.font = `${coordFont}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textBaseline = "middle";

  const labelEvery =
    cellSize >= 12 ? 1 : majorStep; /* tiny cells: only at major ticks */

  for (let c = 0; c < cols; c++) {
    const n = c + 1;
    if (labelEvery > 1 && n % labelEvery !== 0 && n !== 1 && n !== cols) continue;
    const cx = gridX + c * cellSize + cellSize / 2;
    ctx.textAlign = "center";
    ctx.fillText(String(n), cx, gridY - layout.axisPad / 2);
    ctx.fillText(String(n), cx, gridY + layout.gridH + layout.axisPad / 2);
  }

  for (let r = 0; r < rows; r++) {
    const n = r + 1;
    if (labelEvery > 1 && n % labelEvery !== 0 && n !== 1 && n !== rows) continue;
    const cy = gridY + r * cellSize + cellSize / 2;
    ctx.textAlign = "right";
    ctx.fillText(String(n), gridX - 4, cy);
    ctx.textAlign = "left";
    ctx.fillText(String(n), gridX + layout.gridW + 4, cy);
  }
}

function drawMajorGuides(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
): void {
  const { gridX, gridY, gridW, gridH, cellSize, rows, cols, majorStep } = layout;
  ctx.strokeStyle = RED_GUIDE;
  ctx.lineWidth = Math.max(1.5, cellSize * 0.08);
  ctx.beginPath();
  for (let c = majorStep; c < cols; c += majorStep) {
    const x = gridX + c * cellSize;
    ctx.moveTo(x, gridY);
    ctx.lineTo(x, gridY + gridH);
  }
  for (let r = majorStep; r < rows; r += majorStep) {
    const y = gridY + r * cellSize;
    ctx.moveTo(gridX, y);
    ctx.lineTo(gridX + gridW, y);
  }
  ctx.stroke();

  // outer border
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, cellSize * 0.06);
  ctx.strokeRect(gridX + 0.5, gridY + 0.5, gridW - 1, gridH - 1);
}

export function renderSheetToCanvas(
  ctx: CanvasRenderingContext2D,
  result: ProcessResult,
  layout: Layout,
): void {
  const { width, height, cellSize, gridX, gridY, rows, cols, headerH } = layout;

  ctx.save();
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(0, 0, width, height);

  // header
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = INK;
  ctx.font = `bold ${Math.round(headerH * 0.42)}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(layout.title, Math.round(cellSize * 1.2), headerH / 2);

  // flush cells — no inter-cell gap / stroke
  const keyFont = Math.max(5, cellSize * 0.26);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = result.grid[r][c];
      const x = gridX + c * cellSize;
      const y = gridY + r * cellSize;
      const fill =
        cell.isExternal || !cell.key ? PAGE_BG : cell.color || PAGE_BG;
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, cellSize, cellSize);

      if (layout.showCellKeys && !cell.isExternal && cell.key) {
        ctx.fillStyle = contrastInk(fill);
        ctx.font = `${keyFont}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(cell.key, x + cellSize / 2, y + cellSize / 2 + 0.5);
      }
    }
  }

  drawMajorGuides(ctx, layout);
  drawCoordinates(ctx, layout);

  // palette label
  ctx.fillStyle = MUTED;
  ctx.font = `bold ${Math.max(11, Math.round(cellSize * 0.55))}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(layout.paletteLabel, width / 2, layout.labelY);

  // total pill
  const pillX = layout.totalCenterX - layout.totalPillW / 2;
  const pillY = layout.totalCenterY - layout.totalPillH / 2;
  roundRect(ctx, pillX, pillY, layout.totalPillW, layout.totalPillH, layout.totalPillH / 2);
  ctx.fillStyle = YELLOW;
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `bold ${Math.round(layout.totalPillH * 0.48)}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`总计: ${layout.totalBeads} 颗`, layout.totalCenterX, layout.totalCenterY);

  // compact legend: swatch + "A4 (59)"
  const { swatch, itemW, itemH, perRow, textGap, x: legendX, y: legendY } =
    layout.legend;
  const codeFont = Math.max(9, Math.round(swatch * 0.55));
  layout.beadCounts.forEach((item, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = legendX + col * itemW;
    const y = legendY + row * itemH;

    roundRect(ctx, x, y, swatch, swatch, Math.max(2, swatch * 0.12));
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#BDBDBD";
    ctx.stroke();

    ctx.fillStyle = MUTED;
    ctx.font = `${codeFont}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${item.key} (${item.count})`,
      x + swatch + textGap,
      y + swatch / 2,
    );
  });

  ctx.fillStyle = MUTED;
  ctx.font = `${Math.max(10, Math.round(cellSize * 0.45))}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("本地导出 · 图纸含色号与用量", width / 2, layout.footerY);

  ctx.restore();
}

function coordsSvg(layout: Layout): string[] {
  const parts: string[] = [];
  const { gridX, gridY, cellSize, rows, cols, coordFont, majorStep, axisPad, gridW, gridH } =
    layout;
  const labelEvery = cellSize >= 12 ? 1 : majorStep;

  for (let c = 0; c < cols; c++) {
    const n = c + 1;
    if (labelEvery > 1 && n % labelEvery !== 0 && n !== 1 && n !== cols) continue;
    const cx = gridX + c * cellSize + cellSize / 2;
    parts.push(
      `<text x="${cx}" y="${gridY - axisPad / 2}" font-size="${coordFont}" fill="${INK}" text-anchor="middle" dominant-baseline="middle">${n}</text>`,
      `<text x="${cx}" y="${gridY + gridH + axisPad / 2}" font-size="${coordFont}" fill="${INK}" text-anchor="middle" dominant-baseline="middle">${n}</text>`,
    );
  }
  for (let r = 0; r < rows; r++) {
    const n = r + 1;
    if (labelEvery > 1 && n % labelEvery !== 0 && n !== 1 && n !== rows) continue;
    const cy = gridY + r * cellSize + cellSize / 2;
    parts.push(
      `<text x="${gridX - 4}" y="${cy}" font-size="${coordFont}" fill="${INK}" text-anchor="end" dominant-baseline="middle">${n}</text>`,
      `<text x="${gridX + gridW + 4}" y="${cy}" font-size="${coordFont}" fill="${INK}" text-anchor="start" dominant-baseline="middle">${n}</text>`,
    );
  }
  return parts;
}

function guidesSvg(layout: Layout): string[] {
  const parts: string[] = [];
  const { gridX, gridY, gridW, gridH, cellSize, rows, cols, majorStep } = layout;
  const lw = Math.max(1.5, cellSize * 0.08);
  for (let c = majorStep; c < cols; c += majorStep) {
    const x = gridX + c * cellSize;
    parts.push(
      `<line x1="${x}" y1="${gridY}" x2="${x}" y2="${gridY + gridH}" stroke="${RED_GUIDE}" stroke-width="${lw}"/>`,
    );
  }
  for (let r = majorStep; r < rows; r += majorStep) {
    const y = gridY + r * cellSize;
    parts.push(
      `<line x1="${gridX}" y1="${y}" x2="${gridX + gridW}" y2="${y}" stroke="${RED_GUIDE}" stroke-width="${lw}"/>`,
    );
  }
  parts.push(
    `<rect x="${gridX + 0.5}" y="${gridY + 0.5}" width="${gridW - 1}" height="${gridH - 1}" fill="none" stroke="${INK}" stroke-width="${Math.max(1, cellSize * 0.06)}"/>`,
  );
  return parts;
}

export function sheetToSvg(result: ProcessResult, layout: Layout): string {
  const parts: string[] = [];
  parts.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
    `<rect width="${layout.width}" height="${layout.height}" fill="${PAGE_BG}"/>`,
    `<rect width="${layout.width}" height="${layout.headerH}" fill="${YELLOW}"/>`,
    `<text x="${Math.round(layout.cellSize * 1.2)}" y="${layout.headerH / 2}" font-size="${Math.round(layout.headerH * 0.42)}" font-weight="bold" fill="${INK}" dominant-baseline="middle">${escapeXml(layout.title)}</text>`,
  );

  const keyFont = Math.max(5, layout.cellSize * 0.26);
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const cell = result.grid[r][c];
      const x = layout.gridX + c * layout.cellSize;
      const y = layout.gridY + r * layout.cellSize;
      const fill = cell.isExternal || !cell.key ? PAGE_BG : cell.color || PAGE_BG;
      parts.push(
        `<rect x="${x}" y="${y}" width="${layout.cellSize}" height="${layout.cellSize}" fill="${fill}"/>`,
      );
      if (layout.showCellKeys && !cell.isExternal && cell.key) {
        parts.push(
          `<text x="${x + layout.cellSize / 2}" y="${y + layout.cellSize / 2}" font-size="${keyFont}" fill="${contrastInk(fill)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(cell.key)}</text>`,
        );
      }
    }
  }

  parts.push(...guidesSvg(layout));
  parts.push(...coordsSvg(layout));

  parts.push(
    `<text x="${layout.width / 2}" y="${layout.labelY}" font-size="${Math.max(11, Math.round(layout.cellSize * 0.55))}" font-weight="bold" fill="${MUTED}" text-anchor="middle" dominant-baseline="middle">${escapeXml(layout.paletteLabel)}</text>`,
  );

  const pillX = layout.totalCenterX - layout.totalPillW / 2;
  const pillY = layout.totalCenterY - layout.totalPillH / 2;
  parts.push(
    `<rect x="${pillX}" y="${pillY}" width="${layout.totalPillW}" height="${layout.totalPillH}" rx="${layout.totalPillH / 2}" fill="${YELLOW}"/>`,
    `<text x="${layout.totalCenterX}" y="${layout.totalCenterY}" font-size="${Math.round(layout.totalPillH * 0.48)}" font-weight="bold" fill="${INK}" text-anchor="middle" dominant-baseline="middle">总计: ${layout.totalBeads} 颗</text>`,
  );

  const { swatch, itemW, itemH, perRow, textGap, x: legendX, y: legendY } =
    layout.legend;
  const codeFont = Math.max(9, Math.round(swatch * 0.55));
  layout.beadCounts.forEach((item, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = legendX + col * itemW;
    const y = legendY + row * itemH;
    parts.push(
      `<rect x="${x}" y="${y}" width="${swatch}" height="${swatch}" rx="${Math.max(2, swatch * 0.12)}" fill="${item.color}" stroke="#BDBDBD" stroke-width="1"/>`,
      `<text x="${x + swatch + textGap}" y="${y + swatch / 2}" font-size="${codeFont}" fill="${MUTED}" text-anchor="start" dominant-baseline="middle">${escapeXml(item.key)} (${item.count})</text>`,
    );
  });

  parts.push(
    `<text x="${layout.width / 2}" y="${layout.footerY}" font-size="${Math.max(10, Math.round(layout.cellSize * 0.45))}" fill="${MUTED}" text-anchor="middle" dominant-baseline="middle">本地导出 · 图纸含色号与用量</text>`,
    `</svg>`,
  );

  return parts.join("\n");
}

export async function exportSheetSvg(
  result: ProcessResult,
  options: SheetOptions = {},
): Promise<Blob> {
  const layout = buildSheetLayout(result, options);
  const svg = sheetToSvg(result, layout);
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

export async function exportSheetJpeg(
  result: ProcessResult,
  options: SheetOptions = {},
): Promise<Blob> {
  const layout = buildSheetLayout(result, {
    ...options,
    cellSize: options.cellSize ?? 24,
  });
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 Canvas");
  renderSheetToCanvas(ctx, result, layout);

  const quality = options.jpegQuality ?? 0.92;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
  );
  if (!blob) throw new Error("JPG 导出失败");
  return blob;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
