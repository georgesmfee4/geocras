/**
 * Horloge de l'application.
 *
 * Deux problèmes distincts sont traités ici, et les confondre a produit deux
 * affichages faux sur l'écran d'attente :
 *
 *  1. **L'instant.** Comparer un horodatage serveur à `Date.now()` revient à
 *     soustraire deux horloges différentes. Sur un téléphone dont l'heure
 *     dérive — le cas courant hors synchronisation réseau, et systématique sur
 *     un émulateur — un compteur censé partir de zéro démarrait à plusieurs
 *     minutes, voire en négatif. On mesure donc le décalage une fois pour
 *     toutes à partir de l'en-tête `Date` des réponses HTTP, et on compte dans
 *     le temps du serveur.
 *
 *  2. **Le fuseau.** `getHours()` rend l'heure du fuseau **de l'appareil**. Un
 *     téléphone réglé sur UTC affichait « 00:13 » pour une demande envoyée à
 *     01:13 à Yaoundé. Or l'heure d'un dépannage est un fait local partagé
 *     entre le client et le garagiste : elle doit se lire pareil des deux
 *     côtés, quel que soit le réglage de chaque appareil. On la rend donc
 *     toujours en heure du Cameroun.
 */

/**
 * Décalage horaire du Cameroun, en minutes.
 *
 * UTC+1 toute l'année : le pays n'applique pas d'heure d'été, ce qui permet un
 * décalage fixe plutôt qu'une base de fuseaux. `Intl` avec `timeZone` serait
 * plus général, mais dépend de la présence d'ICU dans le moteur JavaScript —
 * variable selon les versions de Hermes, pour un produit qui n'est vendu que
 * dans un seul fuseau.
 */
export const CAMEROON_UTC_OFFSET_MIN = 60;

/**
 * Écart entre l'horloge du serveur et celle de l'appareil, en millisecondes.
 *
 * `0` tant qu'aucune réponse n'a été observée : on part alors du principe que
 * l'appareil est à l'heure, ce qui est le comportement d'avant et ne peut pas
 * être pire.
 */
let skewMs = 0;

/**
 * Enregistre l'heure annoncée par le serveur.
 *
 * Appelé par le client HTTP à chaque réponse. La valeur porte le temps de
 * trajet de la réponse (quelques centaines de millisecondes au pire) et n'a
 * qu'une seconde de résolution : très suffisant pour un compteur d'attente qui
 * s'affiche en minutes et secondes, et sans commune mesure avec la dérive
 * qu'il corrige.
 */
export function noteServerDate(header: string | null | undefined): void {
  if (!header) return;

  const serverMs = Date.parse(header);
  if (Number.isNaN(serverMs)) return;

  skewMs = serverMs - Date.now();
}

/** Écart mesuré, exposé pour les tests et le diagnostic. */
export function clockSkewMs(): number {
  return skewMs;
}

/** L'instant courant, dans le temps du serveur. */
export function serverNow(): number {
  return Date.now() + skewMs;
}

/**
 * Secondes écoulées depuis un horodatage serveur.
 *
 * Bornée à zéro : un horodatage à peine dans le futur — arrondi de l'en-tête
 * `Date` à la seconde, ou création de la demande pendant le trajet de la
 * réponse — ne doit pas afficher un compteur négatif.
 */
export function elapsedSecondsSince(iso: string, now: number = serverNow()): number | null {
  const started = Date.parse(iso);
  if (Number.isNaN(started)) return null;
  return Math.max(0, Math.round((now - started) / 1000));
}

/** `04:12`, puis `1:04:12` au-delà de l'heure. */
export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Ancienneté d'un horodatage, en une poignée de caractères — « il y a 2 j ».
 *
 * Volontairement grossier, et de plus en plus à mesure qu'on remonte : sur un
 * avis vieux de trois mois, « il y a 3 mois » dit tout ce qui compte, alors
 * qu'une date exacte demanderait un calcul mental pour arriver à la même
 * conclusion. En dessous de la minute on écrit « à l'instant » plutôt que
 * « il y a 0 min », qui se lit comme un bug.
 *
 * Les seuils sont approximatifs par construction (mois de 30 jours) : c'est un
 * repère de fraîcheur, pas un calendrier.
 */
export function formatRelativeAge(
  iso: string,
  locale: 'fr' | 'en' = 'fr',
  now: number = serverNow(),
): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '—';

  const seconds = Math.max(0, Math.round((now - parsed) / 1000));
  const fr = locale === 'fr';

  if (seconds < 60) return fr ? 'à l’instant' : 'just now';

  const scale: readonly [limit: number, per: number, fr: string, en: string][] = [
    [3600, 60, 'min', 'min'],
    [86_400, 3600, 'h', 'h'],
    [604_800, 86_400, 'j', 'd'],
    [2_592_000, 604_800, 'sem', 'w'],
    [31_536_000, 2_592_000, 'mois', 'mo'],
  ];

  for (const [limit, per, unitFr, unitEn] of scale) {
    if (seconds < limit) {
      const value = Math.floor(seconds / per);
      return fr ? `il y a ${value} ${unitFr}` : `${value}${unitEn} ago`;
    }
  }

  const years = Math.floor(seconds / 31_536_000);
  return fr ? `il y a ${years} an${years > 1 ? 's' : ''}` : `${years}y ago`;
}

/**
 * Heure d'un horodatage ISO, en 24 h et **en heure du Cameroun**.
 *
 * `01h18` en français, `01:18` en anglais : l'heure s'écrit avec un « h » en
 * français, et le reste de l'app le fait déjà pour les durées (`1h04`).
 *
 * On travaille sur les composantes UTC de la date puis on ajoute le décalage :
 * le résultat ne dépend donc ni du fuseau de l'appareil, ni de son heure.
 */
/**
 * Composantes calendaires d'un horodatage, **en heure du Cameroun**.
 *
 * Sert à regrouper l'historique par mois et à dater chaque ligne. Le fuseau
 * compte plus qu'on ne croit ici : une intervention de 00h30 à Yaoundé tombe
 * la veille en UTC, et se rangerait sous le mauvais mois une nuit sur trente.
 */
export function cameroonDateParts(iso: string): {
  year: number;
  /** 1 à 12 — l'indice de `month.N` dans les traductions, pas celui de `Date`. */
  month: number;
  day: number;
} | null {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;

  const shifted = new Date(parsed + CAMEROON_UTC_OFFSET_MIN * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * Date courte, `12/08`.
 *
 * Jour puis mois dans les deux langues : c'est l'ordre en usage au Cameroun, et
 * une app qui inverserait la date pour ses utilisateurs anglophones du même
 * pays créerait l'ambiguïté au lieu de la lever. L'année n'y est pas — elle est
 * portée par l'intitulé de mois qui coiffe le groupe.
 */
export function formatShortDate(iso: string): string {
  const parts = cameroonDateParts(iso);
  if (!parts) return '—';
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}`;
}

export function formatClockTime(iso: string, locale: 'fr' | 'en' = 'fr'): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '—';

  const shifted = new Date(parsed + CAMEROON_UTC_OFFSET_MIN * 60_000);
  const hours = String(shifted.getUTCHours()).padStart(2, '0');
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');

  return locale === 'fr' ? `${hours}h${minutes}` : `${hours}:${minutes}`;
}
