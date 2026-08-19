import { Camera, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { env } from '../config/env';
import { useTheme } from '../theme/ThemeProvider';
import { MAP_PITCH_3D } from '../theme/tokens';
import { SectionLabel } from '../ui/SectionLabel';
import { Text } from '../ui/Text';
import { boundsOf, centerOf, isDegenerate } from './bounds';
import { buildMapStyle, INITIAL_VIEW } from './style';

export type MapCanvasRef = {
  /** Recentre sur la position de l'utilisateur — bouton croix de visée. */
  recenter: (center: [number, number], zoom?: number) => void;
  /**
   * Glissement continu du mode suivi.
   *
   * Distinct de `focus` par sa durée : elle est calée sur l'intervalle entre
   * deux points GPS, pour que la carte glisse d'un point au suivant au lieu de
   * s'arrêter entre chaque — c'est ce qui fait la différence entre un suivi et
   * une succession de sauts.
   */
  follow: (center: [number, number]) => void;
  /** Amène un point au centre sans changer le zoom — sélection d'un garage. */
  focus: (center: [number, number]) => void;
  /** Cadre deux points, par exemple l'utilisateur et le garage retenu. */
  fitTo: (a: [number, number], b: [number, number]) => void;
  /**
   * Cadre un **ensemble** de points — un tracé complet, virages compris.
   *
   * Distinct de `fitTo`, qui ne connaît que les deux extrémités : un itinéraire
   * qui contourne un quartier sort largement du rectangle formé par son départ
   * et son arrivée, et se retrouve coupé aux deux tiers. Passer la géométrie
   * entière est la seule façon d'être sûr que la totalité du trait est à
   * l'écran.
   */
  frame: (points: readonly (readonly [number, number])[]) => void;
  /** Bascule à plat (0°) ou inclinée. */
  setTilted: (tilted: boolean) => void;
};

export type MapCanvasProps = {
  children?: ReactNode;
  onPress?: () => void;
  /**
   * L'utilisateur a déplacé la carte à la main.
   *
   * Ne se déclenche **pas** sur nos propres mouvements de caméra : MapLibre
   * distingue les deux via `userInteraction`. Sans cette distinction, le mode
   * suivi se couperait lui-même dès son premier recentrage.
   */
  onUserGesture?: () => void;
  /**
   * Le style vectoriel est chargé et la carte affiche quelque chose.
   *
   * C'est le seul moment où l'on peut retirer le squelette sans laisser
   * apparaître une surface vide : tant que le style n'est pas là, MapLibre
   * rend un aplat.
   */
  onReady?: () => void;
  /** Hauteur du chrome haut — recherche, filtres — mesurée à l'écran. */
  paddingTop?: number;
  /** Rembourrage de caméra, pour que la feuille du bas ne masque pas le centre. */
  paddingBottom?: number;
  /**
   * Carte manipulable, ou simple illustration.
   *
   * `false` coupe tous les gestes : c'est le mode des **aperçus** posés dans un
   * écran qui défile, comme l'itinéraire de la fiche garage. Sans ça, un doigt
   * qui veut faire défiler la page fait glisser la carte à la place, et l'aperçu
   * finit à trois cents kilomètres de son sujet sans moyen de revenir.
   *
   * L'attribution reste affichée dans les deux cas : c'est une obligation de
   * licence OpenStreetMap, pas une décoration d'interface.
   */
  interactive?: boolean;
};

/**
 * Place réservée au-dessus d'une coordonnée pour l'écusson et sa bulle.
 *
 * Un marqueur est ancré par sa pointe : tout ce qui le compose monte donc
 * au-dessus du point. Un garage cadré pile sous la barre de recherche aurait
 * son numéro et son nom coupés — c'est-à-dire le garage n° 1, celui qu'on
 * regarde en premier.
 */
const MARKER_HEADROOM = 90;

/**
 * Durée d'un glissement du mode suivi.
 *
 * Calée sur l'intervalle de publication du GPS (5 s) : l'animation vers un
 * point se termine à peu près quand le suivant arrive, donc la carte glisse en
 * continu. Une durée courte produirait au contraire une saccade toutes les
 * cinq secondes, suivie d'un long arrêt. L'interpolation est linéaire pour la
 * même raison — une courbe « ease » marquerait chaque point d'un ralenti.
 */
const FOLLOW_DURATION_MS = 4200;

/**
 * Toile cartographique.
 *
 * Encapsule MapLibre pour qu'aucun écran n'ait à connaître le fournisseur de
 * tuiles ni le style : le jour où l'on bascule MapTiler → PMTiles auto-hébergé,
 * seul `style.ts` change.
 *
 * Le logo MapLibre est masqué, **l'attribution reste affichée** : c'est une
 * obligation de licence OpenStreetMap et des conditions MapTiler, pas une
 * option esthétique.
 */
export const MapCanvas = forwardRef<MapCanvasRef, MapCanvasProps>(function MapCanvas(
  {
    children,
    onPress,
    onUserGesture,
    onReady,
    paddingTop = 0,
    paddingBottom = 0,
    interactive = true,
  },
  ref,
) {
  const theme = useTheme();
  const cameraRef = useRef<CameraRef>(null);

  const mapStyle = useMemo(
    () => (env.maptilerKey ? buildMapStyle(env.maptilerKey) : null),
    [],
  );

  /**
   * File d'attente des mouvements de caméra.
   *
   * Le premier point GPS arrive en une seconde ou deux ; le style vectoriel,
   * lui, doit être téléchargé. Sur un réseau lent, l'app demande donc à la
   * caméra de rejoindre l'utilisateur **avant** que la carte existe — et
   * MapLibre ignore silencieusement l'ordre. L'écran s'ouvre alors sur le
   * centre de Yaoundé au lieu de la position réelle, sans qu'aucune erreur ne
   * le signale.
   *
   * On retient donc le dernier ordre reçu et on le rejoue au chargement du
   * style. Le *dernier* seulement : rejouer une file entière ferait défiler la
   * carte d'un point à l'autre au démarrage.
   */
  const styleLoaded = useRef(false);
  const pending = useRef<(() => void) | null>(null);

  const run = (command: () => void): void => {
    if (styleLoaded.current) command();
    else pending.current = command;
  };

  const onStyleLoaded = (): void => {
    styleLoaded.current = true;
    pending.current?.();
    pending.current = null;
    onReady?.();
  };

  /**
   * Rembourrage commun à tous les mouvements de caméra.
   *
   * Sans lui, « recentrer » place l'utilisateur au centre géométrique de
   * l'écran — c'est-à-dire derrière la feuille du bas. Le point visé doit
   * tomber au centre de la partie **visible** de la carte, et la feuille est
   * mesurée à l'écran plutôt que devinée par une constante.
   */
  const padding = {
    top: paddingTop + MARKER_HEADROOM,
    right: 40,
    bottom: paddingBottom + 40,
    left: 40,
  };

  /**
   * Cadrage d'un ensemble de points.
   *
   * Implémentation unique : `fitTo` n'est plus qu'un appel à deux éléments. Le
   * cas dégénéré — départ et arrivée confondus, ce qui arrive dès que le
   * dépanneur atteint la panne — ne passe pas par `fitBounds`, qui partirait en
   * butée de zoom sur une boîte de côté nul. On recentre alors sur le milieu à
   * une échelle de rue.
   */
  const frame = (points: readonly (readonly [number, number])[]): void => {
    const bounds = boundsOf(points);
    if (!bounds) return;

    if (isDegenerate(bounds)) {
      run(() =>
        cameraRef.current?.flyTo({ center: centerOf(bounds), zoom: 16, padding, duration: 700 }),
      );
      return;
    }

    run(() =>
      // `LngLatBounds` est plat, dans l'ordre ouest / sud / est / nord — celui
      // que `boundsOf` produit déjà.
      cameraRef.current?.fitBounds([...bounds], {
        padding: { ...padding, bottom: paddingBottom + 60 },
        duration: 700,
      }),
    );
  };

  useImperativeHandle(ref, () => ({
    recenter: (center, zoom = 15) => {
      run(() => cameraRef.current?.flyTo({ center, zoom, padding, duration: 700 }));
    },
    follow: (center) => {
      run(() =>
        cameraRef.current?.easeTo({ center, padding, duration: FOLLOW_DURATION_MS, easing: 'linear' }),
      );
    },
    focus: (center) => {
      // `easeTo` et non `flyTo` : le vol prend de l'altitude avant de replonger,
      // ce qui est spectaculaire sur un long trajet et désorientant sur les
      // quelques centaines de mètres qui séparent deux garages voisins.
      run(() => cameraRef.current?.easeTo({ center, padding, duration: 520 }));
    },
    fitTo: (a, b) => frame([a, b]),
    frame,
    setTilted: (tilted) => {
      // `setStop` et non `easeTo` : les autres méthodes exigent un centre, or
      // basculer en 3D ne doit surtout pas déplacer la carte — l'utilisateur
      // vient peut-être de la cadrer à la main.
      run(() =>
        void cameraRef.current?.setStop({ pitch: tilted ? MAP_PITCH_3D : 0, duration: 520 }),
      );
    },
  }));

  // Sans style, `onDidFinishLoadingStyle` ne se déclenchera jamais : il faut
  // libérer l'appelant explicitement, sinon son squelette d'attente resterait
  // affiché par-dessus le message d'erreur qu'on est en train de rendre.
  useEffect(() => {
    if (!mapStyle) onReady?.();
  }, [mapStyle, onReady]);

  // Sans clé, les tuiles renverraient 403 et la carte resterait grise sans
  // explication. On dit ce qui manque plutôt que de laisser deviner.
  if (!mapStyle) {
    return (
      <View
        style={[
          styles.fill,
          {
            backgroundColor: theme.colors.background,
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.space.xl,
            gap: theme.space.md,
          },
        ]}
      >
        <SectionLabel>Carte indisponible</SectionLabel>
        <Text variant="txt" style={{ textAlign: 'center' }}>
          Clé MapTiler absente.
        </Text>
        <Text variant="numSm" tone="muted" style={{ textAlign: 'center' }}>
          EXPO_PUBLIC_MAPTILER_KEY
        </Text>
      </View>
    );
  }

  return (
    <Map
      style={styles.fill}
      mapStyle={mapStyle}
      logo={false}
      compass={false}
      scaleBar={false}
      attribution
      onPress={onPress}
      // Gestes coupés un par un plutôt qu’un `pointerEvents="none"` sur le
      // conteneur : l’attribution doit rester cliquable, c’est une condition
      // de la licence des tuiles.
      dragPan={interactive}
      touchZoom={interactive}
      doubleTapZoom={interactive}
      doubleTapHoldZoom={interactive}
      touchRotate={interactive}
      touchPitch={interactive}
      onDidFinishLoadingStyle={onStyleLoaded}
      // `onRegionWillChange` plutôt que `onRegionDidChange` : le suivi doit
      // lâcher prise dès que le doigt bouge la carte, pas à la fin du geste.
      onRegionWillChange={(event) => {
        if (event.nativeEvent.userInteraction) onUserGesture?.();
      }}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: INITIAL_VIEW.center, zoom: INITIAL_VIEW.zoom }}
        minZoom={9}
        maxZoom={19}
      />
      {children}
    </Map>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
