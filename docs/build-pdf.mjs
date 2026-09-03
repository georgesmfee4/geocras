/**
 * Fabrique le PDF de la note de décision.
 *
 *   node docs/build-pdf.mjs
 *
 * Deux étapes, et la première est celle qui compte :
 *
 *  1. **les polices sont intégrées au fichier**, en base64, depuis
 *     `node_modules/@expo-google-fonts`. Ce sont exactement les fontes que
 *     l'application embarque. Un `<link>` vers Google Fonts aurait produit un
 *     PDF au rendu variable selon la connexion de la machine qui le fabrique —
 *     et une note de décision qui ne ressemble pas au produit qu'elle décrit
 *     perd la moitié de son argument ;
 *  2. Edge en mode sans interface imprime le résultat. Aucune dépendance à
 *     installer : il est présent sur toute machine Windows.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** Les cinq graisses employées par la note. */
const FONTS = [
  ['IBM Plex Sans', 400, 'ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf'],
  ['IBM Plex Sans', 600, 'ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf'],
  ['IBM Plex Sans', 700, 'ibm-plex-sans/700Bold/IBMPlexSans_700Bold.ttf'],
  ['IBM Plex Mono', 400, 'ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'],
  ['IBM Plex Mono', 600, 'ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf'],
];

function fontFaces() {
  return FONTS.map(([family, weight, path]) => {
    const file = join(root, 'node_modules', '@expo-google-fonts', path);
    if (!existsSync(file)) throw new Error(`Police introuvable : ${file}`);

    const data = readFileSync(file).toString('base64');
    return [
      '@font-face{',
      `font-family:'${family}';`,
      `font-weight:${weight};`,
      'font-style:normal;font-display:block;',
      `src:url(data:font/ttf;base64,${data}) format('truetype');`,
      '}',
    ].join('');
  }).join('\n');
}

/** Le premier Edge ou Chrome trouvé sur la machine. */
function browser() {
  const candidates = [
    `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  ];

  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('Ni Edge ni Chrome trouvé : impossible de produire le PDF.');
  return found;
}

const template = readFileSync(join(here, 'note-modes-de-service.html'), 'utf8');
if (!template.includes('/*FONTS*/')) throw new Error('Marqueur /*FONTS*/ absent du gabarit.');

const build = join(here, '.build');
mkdirSync(build, { recursive: true });

const html = join(build, 'note.html');
const pdf = join(here, 'GeoCras-Modes-de-service.pdf');

writeFileSync(html, template.replace('/*FONTS*/', fontFaces()), 'utf8');

execFileSync(
  browser(),
  [
    '--headless=new',
    '--disable-gpu',
    // Sans cette option, Edge n'imprime ni les aplats de couleur ni les filets :
    // la note sortirait en noir et blanc, sans le rouge qui structure la page.
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdf}`,
    // Les polices sont dans le fichier, mais la mise en page attend malgré tout
    // un instant : un rendu lancé trop tôt sort avec les fontes de repli.
    '--virtual-time-budget=6000',
    `file:///${html.replace(/\\/g, '/')}`,
  ],
  { stdio: 'inherit' },
);

process.stdout.write(`\nPDF écrit : ${pdf}\n`);
