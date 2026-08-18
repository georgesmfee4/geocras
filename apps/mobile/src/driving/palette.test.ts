import { describe, expect, it } from 'vitest';
import { cockpitPalette } from './palette';

/**
 * Contraste WCAG entre deux couleurs hexadécimales.
 *
 * Écrit ici plutôt qu'importé : c'est la seule chose du projet qui en ait
 * besoin, et une formule de quatre lignes vaut mieux qu'une dépendance.
 */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const raw = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const schemes = ['dark', 'light'] as const;

describe('palette du poste de conduite', () => {
  /**
   * Le contrôle de superposition, rendu mécanique.
   *
   * Comparer deux captures à l'œil ne dit pas *pourquoi* un bloc a bougé. La
   * cause est toujours la même — une clé présente d'un côté et pas de l'autre,
   * ou une valeur de géométrie qui a fini dans la table. Ces deux tests la
   * détectent avant le rendu.
   */
  it('porte exactement les mêmes clés dans les deux thèmes', () => {
    expect(Object.keys(cockpitPalette.light).sort()).toEqual(
      Object.keys(cockpitPalette.dark).sort(),
    );
  });

  it('ne contient aucune valeur de mise en page', () => {
    // Les seuls nombres admis décrivent une ombre — décalage, flou, élévation,
    // opacité. Aucun ne participe à la mise en page : une ombre ne pousse rien.
    // Tout autre nombre dans cette table serait une géométrie dépendante du
    // thème, c'est-à-dire un décalage entre clair et sombre.
    const numericKeys = Object.entries(cockpitPalette.dark)
      .filter(([, value]) => typeof value === 'number')
      .map(([key]) => key)
      .sort();

    expect(numericKeys).toEqual([
      'discContactBlur',
      'discContactOpacity',
      'discContactY',
      'discGlowBlur',
      'discGlowElevation',
      'discGlowOpacity',
      'discGlowY',
      'haloOpacity',
    ]);
  });

  it('borde le halo avec le fond du thème, jamais du noir', () => {
    // Un bord noir sur fond clair pose un cerne gris autour du halo — le défaut
    // exact qui fait dire « le mode clair est cassé ».
    for (const scheme of schemes) {
      expect(cockpitPalette[scheme].haloEdge).toBe(cockpitPalette[scheme].bg);
    }
  });

  it('garde le rouge de la marque identique dans les deux thèmes', () => {
    // Le disque, les filets du bandeau et l'onglet actif sont des ancres : on
    // ne les « adapte » pas au fond sur lequel ils tombent.
    expect(cockpitPalette.light.rule).toBe(cockpitPalette.dark.rule);
    expect(cockpitPalette.light.tabActive).toBe(cockpitPalette.dark.tabActive);
    expect(cockpitPalette.dark.rule).toBe('#E53935');
  });

  it('tient la phrase de description au-dessus de 4,5:1 des deux côtés', () => {
    for (const scheme of schemes) {
      const { body, bg } = cockpitPalette[scheme];
      expect(contrast(body, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('justifie la clé `body` distincte de `eyebrow`', () => {
    // C'est la raison d'être des deux clés : la même valeur passe sur le fond
    // sombre et échoue sur le fond clair. Si ce test tombe un jour, c'est que
    // l'un des deux fonds a bougé — et que la question est à reposer.
    const { eyebrow } = cockpitPalette.light;
    expect(contrast(eyebrow, cockpitPalette.dark.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(eyebrow, cockpitPalette.light.bg)).toBeLessThan(4.5);
  });

  it('tient aussi le titre et les libellés de réglage', () => {
    for (const scheme of schemes) {
      const { title, rowLabel, card, bg } = cockpitPalette[scheme];
      expect(contrast(title, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rowLabel, card)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
