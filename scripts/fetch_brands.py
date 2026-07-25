import json
import urllib.request
from pathlib import Path

req = urllib.request.Request(
    "https://dgadmin.idouge.com/api/colors/all",
    headers={"User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(req, timeout=60) as r:
    data = json.load(r)["data"]

print("brands", len(data))
for b in data:
    name = b.get("brand_name", "")
    pal = b.get("palette") or []
    print(f"{b['id']:3} {name} colors={len(pal)}")

keep_names = {
    "#Mard-221色",
    "Mard-221色",
    "CoCo-221色",
    "优肯-197色",
    "DODO-192色",
    "Mard-96色",
    "CoCo-96色",
}

out = {}
for b in data:
    name = b["brand_name"]
    pal = b.get("palette") or []
    if not pal:
        continue
    if name in keep_names or "Artkal" in name:
        colors = [
            {"key": p["name"], "hex": "#" + str(p["color"]).lstrip("#").upper()}
            for p in pal
            if p.get("name") and p.get("color")
        ]
        out[name] = {"id": b["id"], "name": name, "colors": colors}
        print("KEEP", name, len(colors))

Path(r"D:/projects/pd/scripts").mkdir(exist_ok=True)
Path(r"D:/projects/pd/scripts/brands_raw.json").write_text(
    json.dumps(out, ensure_ascii=False), encoding="utf-8"
)
print("saved brands", len(out))
