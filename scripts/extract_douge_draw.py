from pathlib import Path
import re
import sys

# Usage: python extract_douge_draw.py <path-to-bundled.js>
if len(sys.argv) < 2:
    raise SystemExit("Usage: python extract_douge_draw.py <path-to-bundled.js>")

s = Path(sys.argv[1]).read_text(encoding="utf-8", errors="ignore")

keys = [
    "drawImage",
    "object-fit",
    "crop",
    "fit",
    "contain",
    "cover",
    "naturalWidth",
    "scaleX",
    "imageWidth",
    "canvasWidth",
    "loadImage",
    "chooseImage",
]
out = []
for key in keys:
    for i, m in enumerate(re.finditer(re.escape(key), s)):
        if i >= 2:
            break
        out.append(f"\n## {key} @{m.start()}\n{s[max(0,m.start()-100):m.start()+350]}\n")

# Also search for mergeThreshold mapping from UI slider 0-100
for key in ["mergeThreshold", "quantize", "量化", "mergeSimilar"]:
    idxs = [m.start() for m in re.finditer(re.escape(key), s)]
    out.append(f"\n# {key} count={len(idxs)}")
    for idx in idxs[:3]:
        out.append(s[max(0, idx - 80) : idx + 200])

Path(r"D:/projects/pd/scripts/douge_draw.txt").write_text("\n".join(out), encoding="utf-8")
print("wrote", len(out))
