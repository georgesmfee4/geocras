import { isPlausibleMove, smoothSpeed, type LatLng } from '@geocras/shared';

export type RawFix = {
  lat: number;
  lng: number;
  accuracyM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  timestamp: number;
};

export type FilteredFix = RawFix & { smoothedSpeedMps: number };

/**
 * Filtre de positions.
 *
 * En centre-ville de Yaoundé, la précision tombe à 20–50 m et le GPS produit
 * des sauts : sans filtrage, l'ETA affiché bondit d'un ping à l'autre et le
 * point de l'utilisateur téléporte sur la carte. Deux mécanismes :
 *
 *  1. **Rejet des sauts implausibles** — un déplacement impliquant plus de
 *     150 km/h entre deux points est du bruit, pas une voiture.
 *  2. **Lissage exponentiel de la vitesse** — le chiffre affiché doit être
 *     stable, pas instantané.
 *
 * On ne filtre pas sur la précision seule : un point à ±40 m reste la meilleure
 * information disponible quand c'est tout ce qu'on a.
 */
export class PositionFilter {
  private last: FilteredFix | null = null;

  /**
   * Au-delà, on considère la mesure inexploitable. Généreux volontairement :
   * masquer un point à ±150 m laisserait l'utilisateur sans position du tout.
   */
  private static readonly MAX_ACCURACY_M = 200;

  reset(): void {
    this.last = null;
  }

  get current(): FilteredFix | null {
    return this.last;
  }

  /** Renvoie la position retenue, ou `null` si la mesure a été écartée. */
  accept(fix: RawFix): FilteredFix | null {
    if (fix.accuracyM !== null && fix.accuracyM > PositionFilter.MAX_ACCURACY_M) {
      return null;
    }

    if (this.last) {
      const elapsedSeconds = (fix.timestamp - this.last.timestamp) / 1000;
      const from: LatLng = { lat: this.last.lat, lng: this.last.lng };
      const to: LatLng = { lat: fix.lat, lng: fix.lng };

      // Un horodatage identique ou antérieur signale un point rejoué : on garde
      // le précédent plutôt que de diviser par zéro.
      if (elapsedSeconds <= 0) return null;
      if (!isPlausibleMove(from, to, elapsedSeconds)) return null;
    }

    const smoothedSpeedMps = smoothSpeed(
      this.last?.smoothedSpeedMps ?? null,
      fix.speedMps ?? 0,
    );

    this.last = { ...fix, smoothedSpeedMps };
    return this.last;
  }
}
