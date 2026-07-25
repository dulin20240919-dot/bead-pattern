# 拼豆图纸转换 / Bead Pattern

纯前端的拼豆（融合豆 / Perler Beads）图纸工具：上传图片 → 匹配品牌色卡 → 生成方格图纸 → 导出带色号、用量与坐标系的 JPG / SVG。

无需后端，图片只在浏览器本地处理，打开即用。

在线体验（飞书妙搭）：https://acnryzfmn8yl.aiforce.cloud/app/app_17asbxyp3t4

## 功能

- 上传图片，按长边网格尺寸保比例像素化
- 多品牌色卡（Mard / CoCo / Artkal 等）色号匹配
- 颜色量化（区域合并）、可选去背景、清晰优化、黑色描边
- 预览拼豆图案，导出完整图纸：
  - 方格无间隙铺满
  - 四边坐标（从 1 起）
  - 按网格尺寸每隔 5 / 10 格红色辅助线
  - 底部色号用量图例（占比约 ≤20%）
- 导出 JPG 与 SVG

## 快速开始

需要 Node.js 18+。

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址（默认 `http://127.0.0.1:5173/`）。

### 构建静态站点

```bash
npm run build
```

产物在 `dist/`，可部署到任意静态托管（GitHub Pages、Cloudflare Pages、Netlify、飞书妙搭等）。

```bash
npm run preview   # 本地预览构建结果
```

## 使用说明

1. 上传一张图片（建议主体清晰、背景简单）
2. 调整参数：
   - **网格尺寸**：长边格数，默认 50；≤80 时红线间隔 5，更大时间隔 10
   - **颜色量化**：数值越大，相近色合并越多、色数越少
   - **品牌色卡**：按你手头的豆子品牌选择
   - **去除背景 / 清晰优化 / 黑色描边**：按需开启
3. 点击生成，预览满意后导出 JPG 或 SVG，按色号与坐标拼豆

## 技术栈

- Vite + React + TypeScript
- 全部算法与导出在浏览器端完成（Canvas / SVG）

## 算法概要

对照常见拼豆工具与开源实现，核心流程为：

1. **保比例网格**：长边 = 网格尺寸，短边按宽高比取整
2. **格内取色**：默认 RGB 均值；清晰优化时用逐像素色卡投票
3. **色号匹配**：加权 RGB + HSL 混合距离（对齐豆格 `betterColorDistance` 思路）
4. **颜色量化**：滑条值直接作为 BFS 合并阈值
5. **背景移除**（可选）：四边 flood-fill
6. **黑色描边**（可选）：外轮廓 + 大色差交界描边

参考开源：

- [shinelikeamillion/perler-bead-algorithm](https://github.com/shinelikeamillion/perler-bead-algorithm)
- [Zippland/perler-beads](https://github.com/Zippland/perler-beads)

## 项目结构

```
src/
  App.tsx                 # 界面与交互
  lib/
    imageProcessor.ts     # 像素化 / 量化 / 去背景 / 描边
    color.ts              # 色距与最近色匹配
    exportPattern.ts      # JPG / SVG 图纸导出
    palette.ts            # 品牌色卡加载
  data/
    brands.json           # 色卡数据
```

## 许可

MIT License — 详见 [LICENSE](./LICENSE)。

色卡色号为各品牌公开资料的近似 HEX，仅供个人拼豆参考；实物颜色以厂商为准。

## 贡献

欢迎 Issue / PR。提交前请本地确认：

```bash
npm run build
```
