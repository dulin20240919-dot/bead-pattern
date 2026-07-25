export type Rgb = { r: number; g: number; b: number };

export type BeadColor = {
  key: string;
  hex: string;
  rgb: Rgb;
  name?: string;
};

export type GridCell = {
  key: string;
  color: string;
  isExternal: boolean;
};

export type BeadCount = {
  key: string;
  color: string;
  count: number;
};

export type ProcessOptions = {
  gridSize: number;
  palette: BeadColor[];
  /** 0–100: 保留细节 → 合并相同 */
  colorQuantize: number;
  removeBackground: boolean;
  enableCrispMode: boolean;
  /** 在颜色交界 / 主体外轮廓加一圈黑色描边 */
  enableOutline?: boolean;
  paletteLabel?: string;
};

export type ProcessResult = {
  grid: GridCell[][];
  gridRows: number;
  gridCols: number;
  beadCounts: BeadCount[];
  paletteUsed?: BeadColor[];
  paletteLabel?: string;
};
