import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import {
  downloadBlob,
  exportSheetJpeg,
  exportSheetSvg,
} from "./lib/exportPattern";
import { loadImageData, processImageFile } from "./lib/imageProcessor";
import { BRAND_PRESETS, getBrandById } from "./lib/palette";
import type { ProcessResult } from "./lib/types";
import "./App.css";

type Lightbox =
  | { kind: "source"; src: string }
  | { kind: "pattern"; src: string }
  | null;

export default function App() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [gridSize, setGridSize] = useState(50);
  const [brandId, setBrandId] = useState(BRAND_PRESETS[0]?.id ?? "");
  const [colorQuantize, setColorQuantize] = useState(30);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [enableCrispMode, setEnableCrispMode] = useState(false);
  const [enableOutline, setEnableOutline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"svg" | "jpg" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [lightbox, setLightbox] = useState<Lightbox>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brand = getBrandById(brandId);

  const totalBeads = useMemo(
    () => result?.beadCounts.reduce((s, c) => s + c.count, 0) ?? 0,
    [result],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!result || !canvasRef.current) return;
    drawPatternPreview(canvasRef.current, result);
  }, [result]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setBusy(true);
    try {
      const data = await loadImageData(file);
      setImageData(data);
      await runProcess(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取图片失败");
    } finally {
      setBusy(false);
    }
  }

  async function runProcess(data = imageData) {
    if (!data) {
      setError("请先上传图片");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 30));
      const next = processImageFile(data, {
        gridSize,
        palette: brand.colors,
        colorQuantize,
        removeBackground,
        enableCrispMode,
        enableOutline,
        paletteLabel: brand.name.startsWith("#") ? brand.name : `#${brand.name}`,
      });
      startTransition(() => setResult(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "处理失败");
    } finally {
      setBusy(false);
    }
  }

  async function onExport(kind: "svg" | "jpg") {
    if (!result) return;
    setExporting(kind);
    setError(null);
    try {
      const base = stripExt(fileName ?? "pattern");
      const label = result.paletteLabel ?? brand.name;
      const cellSize = result.gridCols >= 160 ? 22 : result.gridCols >= 100 ? 26 : 30;
      const sheetOpts = {
        cellSize,
        showCellKeys: true,
        paletteLabel: label,
        title: "拼豆图纸",
        gridSize,
      };
      if (kind === "svg") {
        const blob = await exportSheetSvg(result, sheetOpts);
        downloadBlob(blob, `${base}_pattern.svg`);
      } else {
        const blob = await exportSheetJpeg(result, {
          ...sheetOpts,
          jpegQuality: 0.92,
        });
        downloadBlob(blob, `${base}_pattern.jpg`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(null);
    }
  }

  function openSourcePreview() {
    if (!previewUrl) return;
    setLightbox({ kind: "source", src: previewUrl });
  }

  function openPatternPreview() {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    // redraw at higher res for lightbox
    const hi = document.createElement("canvas");
    drawPatternPreview(hi, result, 960);
    setLightbox({ kind: "pattern", src: hi.toDataURL("image/png") });
  }

  return (
    <div className="app">
      <header className="topbar">
        <strong>拼豆图纸转换</strong>
        <span>纯前端 · 本地处理</span>
      </header>

      <main className="layout">
        <aside className="panel side">
          <h2>参数设置</h2>

          <div className="field">
            <div className="field-head">
              <span>网格尺寸</span>
              <strong>{gridSize}</strong>
            </div>
            <div className="range-labels">
              <span>粗糙</span>
              <span>精细</span>
            </div>
            <input
              type="range"
              min={24}
              max={208}
              step={1}
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <div className="field-head">
              <span>品牌选择</span>
            </div>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {BRAND_PRESETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}（{b.colors.length}）
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <div className="field-head">
              <span>颜色量化</span>
              <strong>{colorQuantize}</strong>
            </div>
            <div className="range-labels">
              <span>保留细节</span>
              <span>合并相同</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={colorQuantize}
              onChange={(e) => setColorQuantize(Number(e.target.value))}
            />
          </div>

          <label className="switch">
            <span>背景移除</span>
            <input
              type="checkbox"
              checked={removeBackground}
              onChange={(e) => setRemoveBackground(e.target.checked)}
            />
          </label>

          <label className="switch">
            <span>清晰优化</span>
            <input
              type="checkbox"
              checked={enableCrispMode}
              onChange={(e) => setEnableCrispMode(e.target.checked)}
            />
          </label>

          <label className="switch">
            <span>黑色描边</span>
            <input
              type="checkbox"
              checked={enableOutline}
              onChange={(e) => setEnableOutline(e.target.checked)}
            />
          </label>
          <p className="tip">在轮廓与色块交界处加一圈黑色，拼豆层次更清楚。</p>

          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy || !imageData}
              onClick={() => void runProcess()}
            >
              {busy ? "生成中…" : "重新生成"}
            </button>
            <label className="secondary-btn">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              重新上传
            </label>
          </div>

          {!imageData && (
            <label className="upload">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <span>点击上传图片开始</span>
            </label>
          )}

          {error && <p className="error">{error}</p>}
        </aside>

        <section className="main-stack">
          <div className="panel block">
            <div className="block-head">
              <h2>原图</h2>
              {previewUrl && (
                <button type="button" className="linkish" onClick={openSourcePreview}>
                  点击查看大图
                </button>
              )}
            </div>
            <button
              type="button"
              className="media-card"
              disabled={!previewUrl}
              onClick={openSourcePreview}
              aria-label="查看原图大图"
            >
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="原图" />
                  <span className="zoom-badge" aria-hidden>
                    <ZoomIcon />
                  </span>
                </>
              ) : (
                <div className="empty">上传后显示原图</div>
              )}
            </button>
          </div>

          <div className="panel block">
            <div className="block-head">
              <h2>
                拼豆图案
                {result ? `（${result.gridCols}x${result.gridRows}）` : ""}
              </h2>
              {result && (
                <button type="button" className="linkish" onClick={openPatternPreview}>
                  点击查看大图
                </button>
              )}
            </div>
            <button
              type="button"
              className="media-card pattern"
              disabled={!result}
              onClick={openPatternPreview}
              aria-label="查看拼豆图案大图"
            >
              {result ? (
                <>
                  <canvas ref={canvasRef} />
                  <span className="zoom-badge" aria-hidden>
                    <ZoomIcon />
                  </span>
                </>
              ) : (
                <div className="empty">生成后显示拼豆图案</div>
              )}
            </button>

            <div className="export-row">
              <button
                type="button"
                className="primary wide"
                disabled={!result || exporting !== null}
                onClick={() => void onExport("jpg")}
              >
                {exporting === "jpg" ? "导出中…" : "下载完整图纸"}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={!result || exporting !== null}
                onClick={() => void onExport("svg")}
              >
                {exporting === "svg" ? "导出中…" : "SVG"}
              </button>
            </div>
          </div>

          {result && (
            <div className="panel block">
              <div className="stats-head">
                <h3>统计</h3>
                <span>
                  共 {result.beadCounts.length} 种颜色 / {totalBeads} 颗
                </span>
              </div>
              <ul className="stats-list">
                {result.beadCounts.map((c, i) => (
                  <li key={c.key}>
                    <span className="rank">{i + 1}</span>
                    <span className="swatch" style={{ background: c.color }} />
                    <code>{c.key}</code>
                    <span className="hex">{c.color}</span>
                    <span className="n">{c.count} 颗</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>

      {lightbox && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-bar">
              <strong>{lightbox.kind === "source" ? "原图预览" : "拼豆图案预览"}</strong>
              <button type="button" className="ghost" onClick={() => setLightbox(null)}>
                关闭
              </button>
            </div>
            <div className="lightbox-body">
              <img src={lightbox.src} alt="放大预览" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ZoomIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 15.5L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.5 8v5M8 10.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function drawPatternPreview(
  canvas: HTMLCanvasElement,
  result: ProcessResult,
  maxSide = 560,
) {
  const cell = Math.max(3, Math.floor(maxSide / Math.max(result.gridCols, result.gridRows)));
  const w = result.gridCols * cell;
  const h = result.gridRows * cell;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  for (let r = 0; r < result.gridRows; r++) {
    for (let c = 0; c < result.gridCols; c++) {
      const cellData = result.grid[r][c];
      ctx.fillStyle =
        cellData.isExternal || !cellData.key ? "#ffffff" : cellData.color;
      ctx.fillRect(c * cell, r * cell, cell, cell);
      if (cell >= 5) {
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1;
        ctx.strokeRect(c * cell + 0.5, r * cell + 0.5, cell - 1, cell - 1);
      }
    }
  }
}

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, "");
}
