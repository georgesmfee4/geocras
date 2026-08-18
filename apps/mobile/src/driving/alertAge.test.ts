import { describe, expect, it } from 'vitest';
import { ALERT_LIVE_MS, formatAlertAge } from './alertAge';

describe('formatAlertAge', () => {
  it('compte en secondes sous la minute — c’est tout l’intérêt de ce format', () => {
    expect(formatAlertAge(0, 'fr')).toBe('il y a 0 s');
    expect(formatAlertAge(40_000, 'fr')).toBe('il y a 40 s');
    expect(formatAlertAge(59_999, 'fr')).toBe('il y a 59 s');
  });

  it('passe aux minutes puis aux heures', () => {
    expect(formatAlertAge(60_000, 'fr')).toBe('il y a 1 min');
    expect(formatAlertAge(3_599_000, 'fr')).toBe('il y a 59 min');
    expect(formatAlertAge(3_600_000, 'fr')).toBe('il y a 1 h');
  });

  it('traduit sans changer de découpage', () => {
    expect(formatAlertAge(40_000, 'en')).toBe('40s ago');
    expect(formatAlertAge(120_000, 'en')).toBe('2min ago');
    expect(formatAlertAge(7_200_000, 'en')).toBe('2h ago');
  });

  it('borne à zéro plutôt que d’afficher un âge négatif', () => {
    // Une alerte horodatée une poignée de millisecondes dans le futur — arrondi
    // du tick — ne doit pas produire « il y a -1 s ».
    expect(formatAlertAge(-500, 'fr')).toBe('il y a 0 s');
  });

  it('laisse une alerte vivante plus longtemps que l’intervalle entre deux alertes', () => {
    // Sinon la pile serait vide la moitié du temps : le seuil de fraîcheur doit
    // rester au-dessus du délai global de six secondes du moteur.
    expect(ALERT_LIVE_MS).toBeGreaterThan(6000);
  });
});
