# -*- coding: utf-8 -*-
"""Rendu des figures SVG en PNG via Chromium (aucun binding natif requis)."""
import glob, os, sys, re
from playwright.sync_api import sync_playwright

EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
HERE = os.path.dirname(os.path.abspath(__file__))
SCALE = 2

targets = sys.argv[1:] or sorted(glob.glob(os.path.join(HERE, "figures", "*.svg")))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox", "--font-render-hinting=none"])
    for svg in targets:
        raw = open(svg, encoding="utf-8").read()
        w = int(re.search(r'width="(\d+)"', raw).group(1))
        h = int(re.search(r'height="(\d+)"', raw).group(1))
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=SCALE)
        pg.set_content('<style>html,body{margin:0;padding:0;background:#fff}</style>' + raw)
        pg.wait_for_timeout(400)
        out = svg.replace(".svg", ".png")
        pg.screenshot(path=out, omit_background=False)
        pg.close()
        print(f"  {os.path.basename(out):32} {w}x{h} @{SCALE}x")
    b.close()
