# -*- coding: utf-8 -*-
"""Prépare les images embarquées dans le document.

Les figures sont des aplats de couleur : une palette de 128 teintes les rend à
l'identique pour un tiers du poids. Sans cette étape, le PDF pèse 3 Mo et se
transporte mal.
"""
import glob, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "assets")


def opt(src, dst, max_w, colors):
    im = Image.open(src).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.quantize(colors=colors, method=Image.MEDIANCUT,
                dither=Image.FLOYDSTEINBERG).save(dst, format="PNG", optimize=True)
    return os.path.getsize(src), os.path.getsize(dst)


def main():
    os.makedirs(OUT, exist_ok=True)
    a = b = 0
    for f in sorted(glob.glob(os.path.join(HERE, "figures", "*.png"))):
        x, y = opt(f, os.path.join(OUT, os.path.basename(f)), 1300, 128)
        a += x; b += y
    for f in sorted(glob.glob(os.path.join(HERE, "..", "maquettes", "*.png"))):
        x, y = opt(f, os.path.join(OUT, "maq-" + os.path.basename(f)), 470, 192)
        a += x; b += y
    print(f"images : {a // 1024} Ko → {b // 1024} Ko")


if __name__ == "__main__":
    main()
