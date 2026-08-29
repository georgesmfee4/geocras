# -*- coding: utf-8 -*-
"""Deux passes : on compose, on mesure les pages réelles, on recompose."""
import os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B
import optimize
import pypdf

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "source.txt")
DOCX = os.path.join(HERE, "GeoCras-Cahier-des-charges.docx")


def norm(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def measure(pdf_path, heads, figs, n_front=0):
    r = pypdf.PdfReader(pdf_path)
    pages = [norm(p.extract_text() or "") for p in r.pages]
    # Le corps commence à la première page portant « CHAPITRE 1 » : chercher avant
    # reviendrait à trouver chaque titre dans le sommaire lui-même.
    body = next((i for i, t in enumerate(pages) if "chapitre1" in t), 0)
    toc, ftoc = {}, {}
    cursor = 0
    for idx, (lvl, num, title) in enumerate(heads):
        needle = norm(num + title)
        start = 0 if idx < n_front else max(cursor, body)
        stop = body if idx < n_front else len(pages)
        found = ""
        for i in range(start, stop):
            if needle and needle in pages[i]:
                found = i + 1
                if idx >= n_front:
                    cursor = i
                break
        toc[(num, title)] = found
    cursor = body
    for n, cap in figs:
        needle = norm("Figure%d" % n + cap[:40])
        for i in range(cursor, len(pages)):
            if needle and needle in pages[i]:
                ftoc[n] = i + 1
                cursor = i
                break
    return toc, ftoc, len(r.pages)


def main():
    optimize.main()
    print("passe 1 — composition à blanc")
    b = B.build(SRC, DOCX)
    pdf = B.to_pdf(DOCX, HERE)
    toc, ftoc, n = measure(pdf, b._pre_heads, b._pre_figs, b._n_front)
    print(f"   {n} pages, {sum(1 for v in toc.values() if v)}/{len(toc)} titres localisés, "
          f"{len(ftoc)}/{len(b._pre_figs)} figures localisées")

    for it in range(2, 4):
        print(f"passe {it} — sommaire paginé")
        b = B.build(SRC, DOCX, toc_pages=toc, fig_pages=ftoc)
        pdf = B.to_pdf(DOCX, HERE)
        toc2, ftoc2, n2 = measure(pdf, b._pre_heads, b._pre_figs, b._n_front)
        stable = (toc2 == toc and ftoc2 == ftoc)
        toc, ftoc = toc2, ftoc2
        print(f"   {n2} pages, sommaire {'stable' if stable else 'réajusté'}")
        if stable:
            break
    else:
        B.build(SRC, DOCX, toc_pages=toc, fig_pages=ftoc)
        pdf = B.to_pdf(DOCX, HERE)

    import subprocess
    lin = pdf + ".lin"
    subprocess.run(["qpdf", "--linearize", "--object-streams=generate", pdf, lin],
                   check=True, capture_output=True)
    os.replace(lin, pdf)

    r = pypdf.PdfReader(pdf)
    print(f"\nterminé : {len(r.pages)} pages, {os.path.getsize(pdf) // 1024} Ko")
    print("  " + DOCX)
    print("  " + pdf)


if __name__ == "__main__":
    main()
