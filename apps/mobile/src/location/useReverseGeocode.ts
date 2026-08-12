import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { haversineMeters, type LatLng } from '@geocras/shared';

/**
 * Libellé lisible de la position de l'utilisateur.
 *
 * L'écran Carte annonce « POSITION EXACTE » : il doit donc nommer l'endroit où
 * se trouve *l'utilisateur*, pas celui du garage le plus proche. Reprendre le
 * quartier du garage n° 1 produirait un libellé faux dès que le premier
 * résultat est à deux kilomètres — et un libellé faux sous un intitulé
 * « position exacte » est pire que pas de libellé du tout.
 *
 * Le géocodage inverse est **local à l'appareil** (Geocoder Android /
 * CLGeocoder iOS) : il ne passe pas par notre API et ne consomme pas de quota
 * MapTiler. En revanche il échoue hors ligne, et n'est pas garanti sur un
 * Android dépourvu de services Google — d'où un retour `null` explicite que
 * l'appelant sait remplacer par son propre repli.
 */

/**
 * Distance en dessous de laquelle on ne relance pas le géocodage.
 *
 * Le GPS republie une position toutes les 5 s. Sans ce seuil on lancerait un
 * géocodage par tick alors que le nom de rue, lui, ne change pas — pour rien,
 * et sur la batterie de quelqu'un qui est déjà en panne. 120 m correspond
 * grosso modo à un segment de rue à Yaoundé.
 */
const REGEOCODE_THRESHOLD_M = 120;

/**
 * Recul après un échec.
 *
 * Sans lui, un appareil sans Geocoder retenterait à chaque point GPS, soit
 * toutes les 5 s indéfiniment. L'échec est presque toujours structurel (pas de
 * services Google, pas de réseau) : réessayer vite ne sert à rien.
 */
const RETRY_AFTER_FAILURE_MS = 30_000;

export type ReverseGeocodeResult = {
  /** `null` tant qu'aucun libellé n'a pu être obtenu. */
  label: string | null;
  loading: boolean;
};

/**
 * Plus Code (« open location code »), du type `W5F6+93`.
 *
 * Hors des grandes villes camerounaises, le Geocoder d'Android n'a pas de nom
 * de rue et rend un Plus Code dans `name`. C'est une coordonnée déguisée : ça
 * ne dit rien à personne, et ça occupe la place du quartier, qui lui est
 * lisible. On préfère « Mvila » à « W5F6+93, Mvila ».
 */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;

function usable(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || PLUS_CODE.test(trimmed)) return null;
  return trimmed;
}

/**
 * Compose le libellé à partir des composants d'adresse.
 *
 * La rue est ce qui situe le mieux quelqu'un debout à côté de sa voiture. À
 * défaut, le nom du lieu, puis le quartier. On y accole la zone quand elle
 * ajoute une information — « Rue de Nachtigal, Elig-Essono » plutôt que
 * « Rue de Nachtigal ».
 */
function composeLabel(address: Location.LocationGeocodedAddress): string | null {
  const primary =
    usable(address.street) ??
    usable(address.name) ??
    usable(address.district) ??
    usable(address.city);
  if (!primary) return null;

  const area = usable(address.district) ?? usable(address.subregion) ?? usable(address.city);
  if (!area || area === primary) return primary;

  return `${primary}, ${area}`;
}

export function useReverseGeocode(position: LatLng | null): ReverseGeocodeResult {
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Dernière position réellement résolue — sert à mesurer le déplacement. */
  const resolvedFor = useRef<LatLng | null>(null);
  /** Horodatage du dernier échec, pour le recul. */
  const failedAt = useRef<number>(0);

  // On dépend des coordonnées, pas de l'objet : `useCoordinates()` en construit
  // un nouveau à chaque rendu, ce qui relancerait cet effet en boucle.
  const lat = position?.lat ?? null;
  const lng = position?.lng ?? null;

  useEffect(() => {
    if (lat === null || lng === null) return;

    const point: LatLng = { lat, lng };

    const previous = resolvedFor.current;
    if (previous && haversineMeters(previous, point) < REGEOCODE_THRESHOLD_M) return;
    if (Date.now() - failedAt.current < RETRY_AFTER_FAILURE_MS) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: point.lat,
          longitude: point.lng,
        });
        if (cancelled) return;

        const next = address ? composeLabel(address) : null;

        if (next) {
          // On ne marque la position comme résolue que si le géocodage a rendu
          // quelque chose : sinon le seuil des 120 m interdirait toute nouvelle
          // tentative alors qu'on n'a encore aucun libellé.
          resolvedFor.current = point;
          setLabel(next);
        } else {
          failedAt.current = Date.now();
        }
      } catch {
        // Hors ligne, ou Geocoder indisponible. L'appelant affiche son repli ;
        // on ne signale rien — un nom de rue manquant n'est pas une panne.
        if (!cancelled) failedAt.current = Date.now();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return { label, loading };
}
