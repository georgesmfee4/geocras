import { describe, expect, it } from 'vitest';
import {
  BEBAS_FALLBACK_FAMILY,
  BEBAS_FAMILY,
  BEBAS_INK_HEIGHT_EM,
  BEBAS_VARIANTS,
  centeredBebasPadding,
  plexType,
  typeBebas,
} from './typography';

/**
 * Ces tests ne vérifient pas un rendu — le projet ne monte volontairement
 * aucun composant. Ils verrouillent les deux choses qui, dans cette refonte,
 * se cassent sans rien signaler : une valeur de jeton reprise « au propre »
 * vers la spec d'origine, et une formule de centrage qu'on ne peut pas
 * contrôler à l'œil sur un simulateur.
 */

describe('compensation du crénage sur texte Bebas centré', () => {
  it('ne corrige rien quand le texte n’est pas centré', () => {
    expect(centeredBebasPadding({ letterSpacing: 2.2 })).toBeNull();
    expect(centeredBebasPadding({ textAlign: 'left', letterSpacing: 2.2 })).toBeNull();
  });

  it('ne corrige rien sans crénage positif', () => {
    expect(centeredBebasPadding({ textAlign: 'center' })).toBeNull();
    expect(centeredBebasPadding({ textAlign: 'center', letterSpacing: 0 })).toBeNull();
    expect(centeredBebasPadding({ textAlign: 'center', letterSpacing: -0.5 })).toBeNull();
  });

  it('pose un padding égal au crénage', () => {
    expect(centeredBebasPadding({ textAlign: 'center', letterSpacing: 2.2 })).toBe(2.2);
  });

  it('s’ajoute à un padding déjà posé par l’appelant au lieu de l’écraser', () => {
    expect(centeredBebasPadding({ textAlign: 'center', letterSpacing: 2.2, paddingLeft: 8 })).toBe(
      10.2,
    );
  });

  /**
   * Le cœur de la correction : l'encre se retrouve à
   * `(paddingLeft − letterSpacing) / 2` du centre de la boîte. La compensation
   * n'est juste que si cet écart tombe à zéro.
   */
  it('ramène l’encre exactement au centre pour chaque variante', () => {
    for (const [nom, v] of Object.entries(typeBebas)) {
      const padding = centeredBebasPadding({ textAlign: 'center', ...v });
      expect(padding, nom).not.toBeNull();
      expect((padding! - v.letterSpacing) / 2, nom).toBe(0);
    }
  });
});

describe('jetons Bebas', () => {
  it('laisse à chaque variante une ligne au moins aussi haute que son encre', () => {
    for (const [nom, v] of Object.entries(typeBebas)) {
      expect(v.lineHeight, nom).toBeGreaterThanOrEqual(v.fontSize * BEBAS_INK_HEIGHT_EM);
    }
  });

  it('n’emploie que du crénage positif — Bebas est déjà condensée', () => {
    for (const [nom, v] of Object.entries(typeBebas)) {
      expect(v.letterSpacing, nom).toBeGreaterThan(0);
    }
  });

  /**
   * Bebas capitalise d'elle-même : ses glyphes minuscules sont des copies des
   * capitales. Un `textTransform` serait redondant et casserait le repli, qui
   * lui a un vrai bas-de-casse.
   */
  it('ne porte aucun textTransform', () => {
    for (const [nom, v] of Object.entries(typeBebas)) {
      expect(v, nom).not.toHaveProperty('textTransform');
    }
  });

  it('demande toutes la même et unique graisse', () => {
    for (const [nom, v] of Object.entries(typeBebas)) {
      expect(v.fontFamily, nom).toBe(BEBAS_FAMILY);
    }
    expect(BEBAS_FALLBACK_FAMILY).not.toBe(BEBAS_FAMILY);
  });

  /**
   * Une clé Bebas qui recouvrirait une clé Plex changerait la police d'écrans
   * non repris, sans erreur ni avertissement.
   */
  it('ne recouvre aucune variante de l’échelle Plex', () => {
    for (const nom of Object.keys(typeBebas)) {
      expect(plexType, nom).not.toHaveProperty(nom);
    }
  });

  it('expose exactement les variantes que <Text> doit basculer sur le repli', () => {
    expect([...BEBAS_VARIANTS].sort()).toEqual(Object.keys(typeBebas).sort());
  });
});

describe('padding non numérique', () => {
  /**
   * `paddingLeft` accepte un pourcentage côté React Native. Le rattrapage vaut
   * un demi-pixel ; il ne doit pas coûter une mise en page.
   */
  it('renonce à la correction plutôt que d’écraser un pourcentage', () => {
    expect(
      centeredBebasPadding({ textAlign: 'center', letterSpacing: 2.2, paddingLeft: '10%' }),
    ).toBeNull();
    expect(
      centeredBebasPadding({ textAlign: 'center', letterSpacing: 2.2, paddingLeft: null }),
    ).toBeNull();
  });
});
