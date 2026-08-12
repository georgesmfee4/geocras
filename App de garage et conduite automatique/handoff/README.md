# GeoCras — Dossier de handoff Claude Code

Tout ce qu'il faut pour construire l'application. À utiliser **dans l'ordre**.

## Contenu

```
handoff/
├── README.md                    ← ce fichier
├── ecrans/                      ← les 11 maquettes en PNG
├── 00-ARCHITECTURE.md           ← PROMPT 1 : faire proposer l'architecture
├── 01-CLAUDE.md                 ← à copier tel quel à la racine du repo
├── 02-SETUP.md                  ← scaffolding + thème
├── 03-NAVIGATION.md             ← squelette de navigation
├── 04-BACKEND-API.md            ← Express + MongoDB + géospatial
├── 05-TEMPS-REEL.md             ← Socket.io + notifications
└── ecrans-prompts/              ← un prompt par écran
```

## Règle d'or

**Un prompt = un écran = un commit.** Ne demande jamais « code toute l'application ».
Joins toujours le PNG de l'écran concerné au prompt.

## Ordre d'exécution

1. `00-ARCHITECTURE.md` — Claude lit ton dossier `geocras-backend` et **propose** une architecture. Tu valides avant toute ligne de code.
2. Copier `01-CLAUDE.md` → `CLAUDE.md` à la racine du repo.
3. `02-SETUP.md` puis `03-NAVIGATION.md`.
4. `04-BACKEND-API.md` (peut se faire en parallèle).
5. Les écrans un par un, dans l'ordre de `ecrans-prompts/`.
6. `05-TEMPS-REEL.md` en dernier (dépend du backend et de l'écran 04).
