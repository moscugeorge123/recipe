"""Rebuild the Material Symbols subsets from assets/fonts/icon-names.json.

Usage (fontTools + brotli required: pip install fonttools brotli):
    npm pack material-symbols            # or any copy of the full variable font
    python scripts/build-icon-fonts.py path/to/material-symbols-outlined.woff2

To add an icon: add its name to assets/fonts/icon-names.json and rerun.
Outputs MaterialSymbolsOutlined.ttf (FILL 0) and MaterialSymbolsOutlinedFill.ttf
(FILL 1), wght 400, GRAD 0, opsz 24, with only the listed ligatures.
"""
import json
import sys
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"
CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_ "


def ligature_map(font):
    cmap = font.getBestCmap()
    rev = {v: chr(k) for k, v in cmap.items()}
    out = {}
    for lk in font["GSUB"].table.LookupList.Lookup:
        for st in lk.SubTable:
            st = getattr(st, "ExtSubTable", st)
            if hasattr(st, "ligatures"):
                for first, ligs in st.ligatures.items():
                    for lig in ligs:
                        name = "".join(rev[g] for g in [first] + list(lig.Component))
                        out[name] = lig.LigGlyph
    return out


def build(src, fill, dest, names):
    font = TTFont(src)
    font = instancer.instantiateVariableFont(
        font, {"FILL": fill, "GRAD": 0, "opsz": 24, "wght": 400}
    )
    wanted = set(names)
    have = ligature_map(font)
    missing = sorted(wanted - set(have))
    if missing:
        sys.exit("Not in the Material Symbols font: " + ", ".join(missing))
    # Drop every ligature we do not need so the subsetter's closure keeps only ours.
    for lk in font["GSUB"].table.LookupList.Lookup:
        for st in lk.SubTable:
            st = getattr(st, "ExtSubTable", st)
            if not hasattr(st, "ligatures"):
                continue
            cmap = font.getBestCmap()
            rev = {v: chr(k) for k, v in cmap.items()}
            for first in list(st.ligatures):
                st.ligatures[first] = [
                    lg
                    for lg in st.ligatures[first]
                    if "".join(rev[g] for g in [first] + list(lg.Component)) in wanted
                ]
                if not st.ligatures[first]:
                    del st.ligatures[first]
    opts = Options()
    opts.layout_features = ["rlig", "liga"]
    opts.notdef_outline = True
    opts.name_IDs = [1, 2, 3, 4, 5, 6]
    opts.glyph_names = False
    sub = Subsetter(opts)
    sub.populate(unicodes=[ord(c) for c in CHARS])
    sub.subset(font)
    font.flavor = None  # a woff2 source would otherwise save woff2 bytes under a .ttf name
    font.save(dest)
    print(dest.name, dest.stat().st_size, "bytes,", len(wanted), "icons")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    names = json.loads((FONTS / "icon-names.json").read_text())
    build(sys.argv[1], 0, FONTS / "MaterialSymbolsOutlined.ttf", names)
    build(sys.argv[1], 1, FONTS / "MaterialSymbolsOutlinedFill.ttf", names)


if __name__ == "__main__":
    main()
