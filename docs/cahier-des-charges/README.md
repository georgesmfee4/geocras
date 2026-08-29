# Cahier des charges

Le dossier complet du projet : analyse des besoins, critique de l'existant, solution
retenue, spécifications générales et détaillées avec la modélisation UML, schéma de la
base de données, justification des choix techniques et état des résultats.

- [`GeoCras-Cahier-des-charges.pdf`](GeoCras-Cahier-des-charges.pdf) — 52 pages, paginé
- [`GeoCras-Cahier-des-charges.docx`](GeoCras-Cahier-des-charges.docx) — même document, éditable

## Régénérer le document

```bash
python3 make.py
```

Le script compose une première fois, relit le PDF produit pour savoir sur quelle page
chaque titre est réellement tombé, puis recompose avec un sommaire et une table des
figures dont les numéros sont justes. Il s'arrête dès que la pagination se stabilise.

Il faut `python-docx`, `pypdf`, `Pillow` et LibreOffice Writer, ainsi que les polices
IBM Plex — le document les utilise, et LibreOffice substituerait sans elles.

## Régénérer les figures

```bash
python3 fig_archi.py && python3 fig_usecase.py && python3 fig_etats.py \
  && python3 fig_classes.py && python3 fig_seq_sos.py \
  && python3 fig_seq_reconnexion.py && python3 fig_activite.py && python3 fig_bd.py
python3 render.py
```

Chaque `fig_*.py` écrit un SVG dans `figures/`, et `render.py` les convertit en PNG avec
Chromium. Le SVG reste la source : c'est lui qu'on modifie, pas le PNG.

## Organisation

| Fichier | Rôle |
|---|---|
| `source.txt` | le texte du document, dans un balisage léger |
| `build.py` | le moteur de composition : balisage vers DOCX, puis PDF |
| `make.py` | l'enchaînement des deux passes de pagination |
| `svgkit.py` | la boîte à outils de dessin partagée par les figures |
| `fig_*.py` | une figure chacun |
| `render.py` | conversion des SVG en PNG |

## Une réserve à connaître

Les captures d'écran du chapitre 7 sont les **maquettes de référence**, pas des captures
prises sur un appareil en fonctionnement. La couche cartographique ne tourne pas dans
l'environnement de développement rapide et exige un build installable, donc un téléphone.
Le document le dit explicitement au lecteur. Les vraies captures viendront avec la
campagne d'essais sur appareil, et il suffira alors de remplacer les fichiers de
`docs/maquettes/` référencés dans `source.txt`.
