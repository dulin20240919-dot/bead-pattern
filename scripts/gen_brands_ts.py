import json
from pathlib import Path

raw = json.loads(Path("scripts/brands_raw.json").read_text(encoding="utf-8"))

# Prefer canonical names; skip duplicate Mard-221 without #
priority = [
    "#Mard-221色",
    "CoCo-221色",
    "Mard-96色",
    "CoCo-96色",
    "DODO-192色",
]

brands = []
for name in priority:
    if name not in raw:
        # fuzzy find
        hit = next((k for k in raw if name.replace("#", "") in k or k in name), None)
        if not hit:
            print("missing", name)
            continue
        name = hit
    item = raw[name]
    brands.append(
        {
            "id": item["name"],
            "name": item["name"],
            "colors": item["colors"],
        }
    )
    print("include", item["name"], len(item["colors"]))

Path("src/data/brands.json").write_text(
    json.dumps(brands, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)
print("wrote src/data/brands.json", sum(len(b["colors"]) for b in brands), "total colors")
