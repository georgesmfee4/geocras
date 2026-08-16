import { describe, expect, it } from 'vitest';
import { decodePolyline6 } from './polyline';

/**
 * Tracé réellement renvoyé par OSRM pour un trajet d'Ebolowa — du quartier
 * Nko'ovos vers Elat, 771 m.
 *
 * Une vraie réponse plutôt qu'un exemple fabriqué : c'est la seule façon de
 * vérifier qu'on décode le format que le serveur envoie, et non celui qu'on
 * croit qu'il envoie.
 */
const EBOLOWA = 'elwqDkfnhThNyPhGgRujAoKcLcEmGgLk@we@jDua@|EaWjAyx@jK}o@~Cy^kFcOeWsD';

describe('décodage polyline6', () => {
  it('rend les coordonnées en [lng, lat]', () => {
    const points = decodePolyline6(EBOLOWA);
    const first = points[0]!;

    // OSRM annonce ce point de passage en [11.165302, 2.928851]. L'ordre
    // compte : inversé, le tracé partirait du golfe de Guinée.
    expect(first[0]).toBeCloseTo(11.1653, 4);
    expect(first[1]).toBeCloseTo(2.92885, 4);
  });

  it('reste dans les limites du Cameroun sur toute sa longueur', () => {
    // Le symptôme d'un facteur d'échelle erroné — 1e5 au lieu de 1e6 — n'est
    // pas une exception : c'est un tracé cohérent, dix fois trop grand, quelque
    // part au large. Seul un contrôle géographique l'attrape.
    for (const [lng, lat] of decodePolyline6(EBOLOWA)) {
      expect(lng).toBeGreaterThan(8.4);
      expect(lng).toBeLessThan(16.2);
      expect(lat).toBeGreaterThan(1.6);
      expect(lat).toBeLessThan(13.1);
    }
  });

  it('avance point par point sans sauter', () => {
    const points = decodePolyline6(EBOLOWA);
    expect(points.length).toBeGreaterThan(5);

    // Un tracé simplifié de 771 m n'a aucun segment kilométrique : un delta
    // aberrant signalerait une désynchronisation du décodage en cours de route.
    for (let i = 1; i < points.length; i += 1) {
      const [lngA, latA] = points[i - 1]!;
      const [lngB, latB] = points[i]!;
      expect(Math.abs(lngB - lngA)).toBeLessThan(0.02);
      expect(Math.abs(latB - latA)).toBeLessThan(0.02);
    }
  });

  it('rend une liste vide sur une chaîne vide', () => {
    expect(decodePolyline6('')).toEqual([]);
  });
});
