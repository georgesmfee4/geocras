# -*- coding: utf-8 -*-
"""Petite boîte à outils SVG pour les figures du cahier des charges.

Palette alignée sur l'identité GeoCras : encre chaude, accent rouge, fond crème.
"""
INK      = "#1C1A17"
INK2     = "#6E6A62"
MUTED    = "#A39D91"
RED      = "#E53935"
RED_DK   = "#C62A26"
TINT     = "#FCECEA"
BG       = "#FFFFFF"
PANEL    = "#F6F4EF"
RULE     = "#D9D4C9"
GREEN    = "#2F8F5B"
AMBER    = "#E0A32E"
BLUE     = "#2D6FD6"

FONT = "'IBM Plex Sans','Helvetica Neue',Arial,sans-serif"
MONO = "'IBM Plex Mono','DejaVu Sans Mono',monospace"


def esc(t):
    return (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


class Svg:
    def __init__(self, w, h, bg=BG):
        self.w, self.h = w, h
        self.parts = []
        self.defs = []
        self.bg = bg

    def add(self, s):
        self.parts.append(s)
        return self

    def rect(self, x, y, w, h, fill=BG, stroke=INK, sw=1.6, rx=0, dash=None, op=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        o = f' opacity="{op}"' if op else ""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" '
                 f'stroke="{stroke}" stroke-width="{sw}"{d}{o}/>')
        return self

    def chamfer(self, x, y, w, h, cut=14, fill=BG, stroke=INK, sw=1.6):
        """Rectangle au coin inférieur droit coupé — la forme signature du produit."""
        pts = f"{x},{y} {x+w},{y} {x+w},{y+h-cut} {x+w-cut},{y+h} {x},{y+h}"
        self.add(f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
        return self

    def text(self, x, y, t, size=13, fill=INK, anchor="start", weight="400",
             font=None, ls=None, italic=False):
        f = font or FONT
        l = f' letter-spacing="{ls}"' if ls else ""
        i = ' font-style="italic"' if italic else ""
        self.add(f'<text x="{x}" y="{y}" font-family="{f}" font-size="{size}" fill="{fill}" '
                 f'text-anchor="{anchor}" font-weight="{weight}"{l}{i}>{esc(t)}</text>')
        return self

    def lines(self, x, y, rows, size=12, fill=INK2, anchor="start", lh=15, weight="400", font=None):
        for i, r in enumerate(rows):
            self.text(x, y + i * lh, r, size=size, fill=fill, anchor=anchor, weight=weight, font=font)
        return self

    def line(self, x1, y1, x2, y2, stroke=INK, sw=1.5, dash=None, marker=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        m = f' marker-end="url(#{marker})"' if marker else ""
        self.add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" '
                 f'stroke-width="{sw}"{d}{m}/>')
        return self

    def path(self, d, stroke=INK, sw=1.5, fill="none", dash=None, marker=None):
        da = f' stroke-dasharray="{dash}"' if dash else ""
        m = f' marker-end="url(#{marker})"' if marker else ""
        self.add(f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{da}{m}/>')
        return self

    def ellipse(self, cx, cy, rx, ry, fill=BG, stroke=INK, sw=1.6):
        self.add(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" '
                 f'stroke="{stroke}" stroke-width="{sw}"/>')
        return self

    def circle(self, cx, cy, r, fill=BG, stroke=INK, sw=1.6):
        self.add(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
        return self

    def render(self):
        markers = f'''
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="{INK}"/>
  </marker>
  <marker id="arrowred" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="{RED}"/>
  </marker>
  <marker id="arrowmut" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="{INK2}"/>
  </marker>
  <marker id="open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="{INK}" stroke-width="1.6"/>
  </marker>
  <marker id="openred" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="{RED}" stroke-width="1.6"/>
  </marker>
  <marker id="diamond" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse">
    <path d="M 0 6 L 6 2 L 12 6 L 6 10 z" fill="{BG}" stroke="{INK}" stroke-width="1.3"/>
  </marker>
  <marker id="dot" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6">
    <circle cx="4" cy="4" r="3.4" fill="{INK}"/>
  </marker>
  {''.join(self.defs)}
</defs>'''
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}">{markers}'
                f'<rect width="{self.w}" height="{self.h}" fill="{self.bg}"/>'
                + "".join(self.parts) + "</svg>")

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.render())
        return path


def wrap(text, width):
    """Découpe naïve en lignes de `width` caractères, sur les espaces."""
    words, out, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= width:
            cur = (cur + " " + w).strip()
        else:
            out.append(cur); cur = w
    if cur:
        out.append(cur)
    return out
