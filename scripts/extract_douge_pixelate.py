from pathlib import Path
import re
import sys

# Usage: python extract_douge_pixelate.py <path-to-bundled.js>
if len(sys.argv) < 2:
    raise SystemExit("Usage: python extract_douge_pixelate.py <path-to-bundled.js>")

s = Path(sys.argv[1]).read_text(encoding="utf-8", errors="ignore")

# Find pixelate function body by index
idx = s.find('key:"pixelate"')
print("pixelate idx", idx)
print(s[idx : idx + 2200])
print("\n====\n")
# find where gridRows gridCols set from image size
for m in re.finditer(r"gridRows|gridCols|gridSize|aspect|canvasWidth|imageWidth", s):
    pass
# find ImageProcessor constructor / set size
idx2 = s.find("this.gridSize=")
print("gridSize assign contexts:")
for m in re.finditer(r".{80}this\.gridSize=.{{0,200}}", s):
    print(m.group(0)[:250])
    print("---")
