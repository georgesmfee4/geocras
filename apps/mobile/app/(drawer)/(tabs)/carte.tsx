import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { haversineMeters, type GarageSummary, type Service } from '@geocras/shared';
import { useNearbyGarages } from '../../../src/api/hooks';
import { useI18n } from '../../../src/i18n/I18nProvider';
import { usePreferences } from '../../../src/settings/preferences';
import { useCoordinates, useLocation } from '../../../src/location/LocationProvider';
import { useReverseGeocode } from '../../../src/location/useReverseGeocode';
import { useStableOrigin } from '../../../src/location/useStableOrigin';
import { GarageMarkers } from '../../../src/map/GarageMarkers';
import { MapCanvas, type MapCanvasRef } from '../../../src/map/MapCanvas';
import { UserPuck } from '../../../src/map/UserPuck';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { chromeShadow, mapControlSize, MIN_TOUCH_TARGET } from '../../../src/theme/tokens';
import { CarteSkeleton } from '../../../src/screens/CarteSkeleton';
import { EmptyRadius } from '../../../src/ui/EmptyRadius';
import { ActiveRequestSearch } from '../../../src/sos/ActiveRequestSearch';
import { useSosEntry } from '../../../src/sos/useSosEntry';
import { BlinkingDot } from '../../../src/ui/BlinkingDot';
import { ChamferView } from '../../../src/ui/ChamferView';
import { Chip } from '../../../src/ui/Chip';
import { GarageCard } from '../../../src/ui/GarageCard';
import {
  AccountGearIcon,
  ClearIcon,
  ClockIcon,
  CrosshairIcon,
  MagnifierIcon,
  ShieldCheckIcon,
  TiltIcon,
  TowTruckIcon,
} from '../../../src/ui/icons';
import { Skeleton } from '../../../src/ui/Skeleton';
import { SosButton } from '../../../src/ui/SosButton';
import { Text, Wordmark } from '../../../src/ui/Text';

/** Hauteur du voile haut, pour que la barre de recherche reste lisible. */
const SCRIM_HEIGHT = 190;

/**
 * Hauteur de feuille utilisée **avant la première mesure**.
 *
 * La vraie valeur vient d'un `onLayout` : elle alimente le rembourrage de la
 * caméra, et une constante fausse ferait atterrir « recentrer » derrière la
 * feuille sur les écrans qui ne font pas la taille de la maquette.
 */
const SHEET_HEIGHT_ESTIMATE = 268;

const CARD_WIDTH = 250;
const CARD_GAP = 12;

/**
 * Distance au-delà de laquelle on ne cadre plus l'utilisateur avec le garage
 * n° 1 : le dézoom nécessaire rendrait le plan de ville inexploitable.
 */
const FRAME_MAX_DISTANCE_M = 4000;

/**
 * Déplacement minimal avant que la caméra suive.
 *
 * Choisi au-dessus du bruit GPS constaté sur appareil (±16 m par beau temps)
 * pour qu'une carte immobile le reste.
 */
const FOLLOW_THRESHOLD_M = 15;

/**
 * Durée au bout de laquelle le squelette s'efface quoi qu'il arrive.
 *
 * Un squelette qui ne part jamais est pire que le vide qu'il remplace : il
 * cacherait le bouton SOS, la seule chose dont on ait besoin quand la carte ne
 * charge pas.
 */
const SKELETON_MAX_MS = 6000;

type Filters = { certifiedOnly: boolean; openNow: boolean; towing: boolean };

/** Comparaison insensible aux accents — « Mécanique » doit sortir sur « meca ». */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export default function CarteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { t, translateError } = useI18n();
  const { status, fix, accuracyM, simulated, retry } = useLocation();
  const origin = useCoordinates();

  const sosEntry = useSosEntry();
  const mapRef = useRef<MapCanvasRef>(null);
  const carouselRef = useRef<ScrollView>(null);

  const [filters, setFilters] = useState<Filters>({
    certifiedOnly: false,
    openNow: false,
    towing: false,
  });
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tilted, setTilted] = useState(false);
  /**
   * Mode suivi : la carte reste centrée sur l'utilisateur qui se déplace.
   *
   * Actif à l'ouverture, et coupé dès que l'utilisateur touche la carte. C'est
   * la convention de toutes les applications de navigation, et elle règle le
   * seul vrai conflit du mode suivi : sans elle, la carte revient de force sur
   * la position au moment précis où l'on essaie de regarder ailleurs.
   */
  const [following, setFollowing] = useState(true);
  /**
   * Squelette d'attente entre le splash et la première image de carte.
   *
   * Il couvre le temps de création de la surface native MapLibre et de
   * téléchargement du style vectoriel — sinon l'écran est vide juste après un
   * splash rouge, ce qui se lit comme un plantage.
   */
  const [mapReady, setMapReady] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(SHEET_HEIGHT_ESTIMATE);
  const [chromeHeight, setChromeHeight] = useState(SCRIM_HEIGHT);

  /**
   * La recherche part d'une origine **ancrée**, pas du point brut.
   *
   * Le point brut, lui, continue d'alimenter le marqueur bleu, le cercle de
   * précision et le bouton de recentrage : l'utilisateur voit donc sa position
   * réelle bouger en direct, mais la liste des garages ne se recharge que
   * lorsqu'il s'est déplacé pour de bon. Sans cet ancrage, un téléphone posé
   * sur une table relance une requête toutes les quelques secondes.
   */
  const searchOrigin = useStableOrigin(origin);

  /**
   * Rayon réglé dans les paramètres.
   *
   * Il fait partie de la clé de cache de `useNearbyGarages` : le passer de 15 à
   * 40 km relance donc une vraie recherche au lieu de resservir la précédente.
   *
   * `hydrated` retient la première requête le temps que le stockage soit relu.
   * Sans lui, la carte chercherait à 15 km au montage puis relancerait à 40 une
   * fraction de seconde plus tard — deux recherches pour une seule question, et
   * elles se paient en données mobiles.
   */
  const searchRadiusKm = usePreferences((state) => state.searchRadiusKm);
  const preferencesReady = usePreferences((state) => state.hydrated);

  const nearby = useNearbyGarages(searchOrigin, {
    radiusKm: searchRadiusKm,
    ready: preferencesReady,
    certifiedOnly: filters.certifiedOnly,
    openNow: filters.openNow,
    ...(filters.towing ? { services: ['towing'] as Service[] } : {}),
  });

  const results = useMemo(() => nearby.data?.results ?? [], [nearby.data]);

  /**
   * Recherche par nom, appliquée aux résultats déjà chargés.
   *
   * Volontairement locale : la liste est plafonnée à 20 garages et tient en
   * mémoire, donc filtrer côté client répond à la frappe sans aller-retour
   * réseau — décisif sur une 3G camerounaise. Les rangs ne sont **pas**
   * renumérotés : ils viennent du serveur et désignent la position dans le
   * classement complet, pas dans ce que la recherche laisse voir.
   */
  const garages = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return results;
    const needle = normalize(trimmed);
    return results.filter(
      (garage) =>
        normalize(garage.name).includes(needle) ||
        normalize(garage.quarter ?? '').includes(needle),
    );
  }, [results, query]);

  /**
   * Ce que la carte et le carrousel montrent.
   *
   * Le repli du serveur (`fallback`, le garage le plus proche **hors** rayon)
   * n'est volontairement **pas** affiché ici. Il l'était, et le résultat se
   * contredisait à l'écran : la ligne de contexte annonçait « Aucun garage
   * dans ce rayon » pendant qu'une vignette proposait un garage à cent
   * kilomètres. Au-delà du rayon de recherche, un garage n'est pas un
   * résultat — personne ne se fait dépanner à cent kilomètres — et le
   * présenter comme tel donne une fausse piste à quelqu'un en panne.
   *
   * L'écran de résultats du SOS, lui, continue de le mentionner : là,
   * l'utilisateur a explicitement demandé une intervention et l'information
   * « le plus proche est à 107 km » l'aide à décider d'appeler l'assistance.
   */
  const mapped = garages;

  const openCount = garages.filter((garage) => garage.openNow).length;

  const { label: geocodedLabel } = useReverseGeocode(origin);

  /**
   * Message de liste vide.
   *
   * Sans position, la requête n'est même pas partie : afficher « aucun garage
   * dans ce rayon » désignerait alors le mauvais coupable, et enverrait
   * quelqu'un élargir sa recherche alors que c'est son GPS qu'il faut
   * débloquer.
   */
  const emptyMessage =
    status === 'denied'
      ? t('location.denied')
      : query.trim()
        ? t('results.empty')
        : t('map.noneInRadius');

  /**
   * Le carrousel montre des squelettes tant qu'on ne sait pas encore quoi y
   * mettre — pendant la requête, mais aussi **avant** : sans position, la
   * requête n'est même pas partie et `isLoading` reste faux.
   *
   * Sans ce second cas, la zone affichait « Acquisition de votre position… »
   * juste sous la ligne de contexte qui disait déjà exactement la même chose.
   */
  const loadingCards = nearby.isLoading || (origin === null && status !== 'denied');

  /**
   * La recherche a bien eu lieu et n'a rien donné dans le rayon.
   *
   * À distinguer d'un carrousel vide pour une autre raison — pas de position,
   * localisation refusée, recherche par nom sans correspondance. Seul ce cas
   * précis mérite l'illustration du rayon vide ; les autres appellent un
   * message qui nomme leur propre cause.
   */
  const searchedInVain =
    origin !== null && !query.trim() && nearby.data != null && nearby.data.results.length === 0;

  const toggle = useCallback((key: keyof Filters) => {
    void Haptics.selectionAsync();
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  /** Sélection depuis la carte : on centre et on aligne le carrousel. */
  const selectFromMap = useCallback(
    (garage: GarageSummary) => {
      void Haptics.selectionAsync();
      setSelectedId(garage.id);
      // Regarder un garage, c'est regarder ailleurs que soi : laisser le suivi
      // actif ramènerait la caméra sur l'utilisateur au bout de quinze mètres,
      // en emportant le garage qu'on vient d'ouvrir.
      setFollowing(false);
      mapRef.current?.focus([garage.lng, garage.lat]);

      const index = mapped.findIndex((item) => item.id === garage.id);
      if (index >= 0) {
        carouselRef.current?.scrollTo({ x: index * (CARD_WIDTH + CARD_GAP), animated: true });
      }
    },
    [mapped],
  );

  const openGarage = useCallback(
    (garage: GarageSummary) => {
      setSelectedId(garage.id);
      router.push(`/garage/${garage.id}`);
    },
    [router],
  );

  const toggleTilt = useCallback(() => {
    void Haptics.selectionAsync();
    setTilted((current) => {
      const next = !current;
      mapRef.current?.setTilted(next);
      return next;
    });
  }, []);

  const recenter = useCallback(() => {
    if (!origin) return;
    void Haptics.selectionAsync();
    setSelectedId(null);
    // Le bouton ne fait pas que recentrer : il **réarme le suivi**. C'est la
    // seule façon de le rallumer, et c'est là que l'utilisateur le cherche.
    setFollowing(true);
    cameraTarget.current = { lat: origin.lat, lng: origin.lng };
    mapRef.current?.recenter([origin.lng, origin.lat]);
  }, [origin]);

  /**
   * Cadrage d'ouverture.
   *
   * En deux temps, parce que les deux informations n'arrivent pas ensemble :
   * la caméra rejoint l'utilisateur dès le premier point GPS, puis, quand les
   * garages arrivent, elle recule pour tenir **l'utilisateur et son garage
   * n° 1** dans le même cadre. Centrer sur le seul utilisateur laisse le
   * marqueur de tête sous la barre de recherche — c'est-à-dire caché — alors
   * qu'il porte le nom et la distance du garage le plus proche.
   *
   * Chaque étape ne se joue **qu'une fois** : recadrer à chaque point GPS
   * arracherait la carte des mains de quelqu'un en train de la déplacer.
   */
  const didCenter = useRef(false);
  const didFrame = useRef(false);
  /** Dernier point sur lequel la caméra a été envoyée. */
  const cameraTarget = useRef<{ lat: number; lng: number } | null>(null);
  const lat = origin?.lat ?? null;
  const lng = origin?.lng ?? null;
  const lead = results[0];

  useEffect(() => {
    if (lat === null || lng === null) return;

    if (!didCenter.current) {
      didCenter.current = true;
      cameraTarget.current = { lat, lng };
      mapRef.current?.recenter([lng, lat]);
    }

    if (didFrame.current || !lead) return;
    didFrame.current = true;

    // Au-delà, cadrer les deux points dézoomerait jusqu'à rendre la rue
    // illisible — typiquement le repli à cent kilomètres. Mieux vaut alors
    // rester sur l'utilisateur et laisser la feuille annoncer la distance.
    if (lead.distanceM <= FRAME_MAX_DISTANCE_M) {
      mapRef.current?.fitTo([lng, lat], [lead.lng, lead.lat]);
    }
  }, [lat, lng, lead]);

  /**
   * Mode suivi.
   *
   * Le seuil de 15 m est ce qui sépare un suivi d'un tremblement : à ±16 m de
   * précision — la valeur relevée sur appareil — le point publié bouge sans
   * arrêt alors que le téléphone est immobile. Sans seuil, la carte glisserait
   * en permanence autour d'un utilisateur qui ne bouge pas.
   *
   * Il est plus fin que celui de la recherche (150 m) parce que les deux
   * n'ont pas le même coût : recadrer la caméra est gratuit, relancer une
   * recherche consomme du réseau.
   */
  useEffect(() => {
    if (!following || lat === null || lng === null) return;
    // On laisse le cadrage d'ouverture se faire d'abord.
    if (!didCenter.current) return;

    const previous = cameraTarget.current;
    if (previous && haversineMeters(previous, { lat, lng }) < FOLLOW_THRESHOLD_M) return;

    cameraTarget.current = { lat, lng };
    mapRef.current?.follow([lng, lat]);
  }, [following, lat, lng]);

  /** Un geste sur la carte reprend la main : le suivi s'arrête. */
  const releaseFollow = useCallback(() => {
    setFollowing((current) => (current ? false : current));
  }, []);

  const handleMapReady = useCallback(() => setMapReady(true), []);

  /**
   * Filet de sécurité du squelette.
   *
   * `onDidFinishLoadingStyle` ne se déclenche pas si le téléchargement du
   * style échoue — hors ligne, DNS qui ne répond pas, quota MapTiler dépassé.
   * Sans ce délai, le squelette resterait affiché indéfiniment et masquerait
   * une carte partiellement utilisable ainsi que le bouton SOS. Passé ce
   * délai, on montre ce qu'on a.
   */
  useEffect(() => {
    if (mapReady) return;
    const timer = setTimeout(() => setMapReady(true), SKELETON_MAX_MS);
    return () => clearTimeout(timer);
  }, [mapReady]);

  const onSheetLayout = (event: LayoutChangeEvent): void => {
    setSheetHeight(event.nativeEvent.layout.height);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <MapCanvas
        ref={mapRef}
        paddingTop={chromeHeight}
        paddingBottom={sheetHeight}
        onPress={() => setSelectedId(null)}
        onUserGesture={releaseFollow}
        onReady={handleMapReady}
      >
        {fix ? <UserPuck position={{ lat: fix.lat, lng: fix.lng }} accuracyM={accuracyM} /> : null}
        <GarageMarkers garages={mapped} onSelect={selectFromMap} selectedId={selectedId} />
      </MapCanvas>

      {/* Voile dégradé : la barre de recherche doit rester lisible quel que
          soit le fond de carte — bâtiment clair ou végétation foncée. */}
      <LinearGradient
        colors={[theme.colors.background, `${theme.colors.background}00`]}
        style={[styles.scrim, { height: SCRIM_HEIGHT }]}
        pointerEvents="none"
      />

      <SafeAreaView
        edges={['top']}
        style={styles.chrome}
        pointerEvents="box-none"
        // Mesuré plutôt que deviné : la barre d'état, la taille de police
        // système et le repli des filtres font varier cette hauteur d'un
        // appareil à l'autre, et c'est elle qui décide où la caméra recentre.
        onLayout={(event) => setChromeHeight(event.nativeEvent.layout.height)}
      >
        <View style={{ paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm, gap: theme.space.md }}>
          {/*
            La maquette place le wordmark dans la bande d'état, à côté de
            l'heure et de la batterie. Cette bande appartient au système : on
            ne peut pas y peindre. Il est donc posé juste en dessous, centré —
            même rôle d'ancrage de marque, sans mentir sur ce que l'app
            contrôle.
          */}
          <View style={{ alignItems: 'center' }}>
            <Wordmark size={15} />
          </View>

          {/*
            Position forcée par `EXPO_PUBLIC_DEBUG_ORIGIN`. Le bandeau est
            volontairement laid et en travers de la marque : c'est un réglage
            de développement qui fausse toutes les distances de l'écran, et
            personne ne doit pouvoir le confondre avec un vrai relevé GPS.
          */}
          {simulated ? (
            <View
              style={{
                backgroundColor: theme.colors.warning,
                paddingHorizontal: theme.space.md,
                paddingVertical: theme.space.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.sm,
              }}
            >
              <Text variant="sectionLabel" style={{ color: theme.colors.ink }}>
                Position simulée
              </Text>
              {origin ? (
                <Text variant="monoSmall" style={{ color: theme.colors.ink }}>
                  {origin.lat.toFixed(4)} · {origin.lng.toFixed(4)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/*
            Une seule barre, pleine largeur.

            Le bouton de menu était un carré chamfré séparé, posé à gauche : il
            volait 60 px de large au champ de recherche pour une action qu'on
            déclenche rarement. Il est maintenant **dans** la barre, à droite,
            là où le pouce arrive naturellement — et c'est lui qui donne accès
            au profil, puisque le tiroir le contient.
          */}
          <View
            style={{
              height: 48,
              backgroundColor: theme.colors.surface,
              // 2 px : le rayon que la charte réserve aux champs de saisie.
              // La barre était à angle vif, ce qui la faisait lire comme une
              // dalle posée plutôt que comme un champ.
              borderRadius: theme.radius.field,
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: theme.space.md,
              paddingRight: theme.space.sm,
              gap: theme.space.md,
              shadowColor: theme.colors.shadow,
              ...chromeShadow,
            }}
          >
            {/* Encre secondaire et non « discret » : à `#A39D91` sur blanc, la
                loupe tombe à 2,3:1 et s'efface en plein soleil. */}
            <MagnifierIcon color={theme.colors.inkSecondary} />

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('map.searchPlaceholder')}
              placeholderTextColor={theme.colors.muted}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel={t('map.searchPlaceholder')}
              style={{
                flex: 1,
                // On reprend la variante `body` à la main plutôt que de
                // l'étaler : son `lineHeight` rogne le texte dans un
                // `TextInput` Android. `paddingVertical: 0` neutralise le
                // rembourrage implicite qui décentrerait le texte dans le
                // champ de 48 px.
                fontFamily: theme.type.body.fontFamily,
                fontSize: theme.type.body.fontSize,
                height: 48,
                paddingVertical: 0,
                color: theme.colors.ink,
              }}
            />

            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={10}
                style={{ paddingHorizontal: theme.space.xs }}
              >
                <ClearIcon color={theme.colors.inkSecondary} />
              </Pressable>
            ) : null}

            {/*
              Filet de séparation. Le bouton de compte partage la barre avec
              le champ, mais n'a rien à voir avec la recherche : sans cette
              césure d'un pixel, il se lit comme un bouton « valider » du
              champ. Deux fonctions, deux zones.
            */}
            <View
              style={{
                width: 1,
                height: 22,
                backgroundColor: theme.colors.rule,
                marginRight: -theme.space.xs,
              }}
            />

            {/*
              Compte et réglages. Chamfré comme l'était l'avatar qu'il
              remplace : le champ de saisie, lui, garde son rayon de 2 px — le
              cahier des charges interdit l'angle coupé sur les champs, pas
              sur les boutons qu'ils contiennent.
            */}
            <ChamferView
              fill={theme.colors.primaryTint}
              style={{ width: 36, height: 36 }}
              contentStyle={{
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pressable
                onPress={() => navigation.dispatch({ type: 'OPEN_DRAWER' })}
                accessibilityRole="button"
                accessibilityLabel={t('map.openMenu')}
                hitSlop={8}
                style={styles.centered36}
              >
                <AccountGearIcon color={theme.colors.primary} size={20} />
              </Pressable>
            </ChamferView>
          </View>

          {/*
            Les filtres montent sous la recherche, la ligne de contexte
            descend sous les filtres.

            Ce n'est pas qu'une permutation : les deux rangées du haut sont
            désormais des **commandes** — on tape, on filtre — et forment une
            seule pile de chrome blanc posée sur la carte. La ligne de contexte,
            elle, est un **compte rendu** de ce que ces commandes ont produit.
            La placer après, au contact de la carte qu'elle décrit, met la
            cause au-dessus de l'effet.
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // Rembourrage vertical : sans lui le `ScrollView` rogne l'ombre des
            // puces au ras de leur boîte, et le décollement disparaît.
            contentContainerStyle={{
              gap: theme.space.md,
              paddingRight: theme.space.lg,
              paddingVertical: 4,
            }}
            style={{ marginVertical: -4 }}
          >
            <Chip
              label={t('map.filterCertified')}
              active={filters.certifiedOnly}
              icon={ShieldCheckIcon}
              onPress={() => toggle('certifiedOnly')}
            />
            <Chip
              label={t('map.filterOpen')}
              active={filters.openNow}
              icon={ClockIcon}
              onPress={() => toggle('openNow')}
            />
            <Chip
              label={t('map.filterTowing')}
              active={filters.towing}
              icon={TowTruckIcon}
              onPress={() => toggle('towing')}
            />
          </ScrollView>

          <ContextLine
            loading={nearby.isFetching}
            failed={nearby.isError}
            errorLabel={nearby.error ? translateError(nearby.error) : null}
            onRetry={() => void nearby.refetch()}
            count={openCount}
            total={garages.length}
            hasOrigin={origin !== null}
          />
        </View>
      </SafeAreaView>

      <View style={[styles.sideControls, { bottom: sheetHeight + theme.space.lg }]}>
        <Pressable
          onPress={toggleTilt}
          accessibilityRole="button"
          accessibilityLabel={tilted ? t('map.tiltFlat') : t('map.tiltTilted')}
          accessibilityState={{ selected: tilted }}
          style={[styles.sideButton, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}
        >
          <TiltIcon color={theme.colors.ink} tilted={tilted} />
        </Pressable>

        {/*
          Le bouton porte l'état du suivi, il ne se contente pas de le
          déclencher. Rempli en jaune = la carte vous suit ; blanc = elle est
          restée où vous l'avez laissée. Sans ce retour visuel, le mode suivi
          est un comportement qui s'active et se coupe tout seul sans que
          personne ne comprenne pourquoi.
        */}
        <Pressable
          onPress={recenter}
          disabled={!origin}
          accessibilityRole="button"
          accessibilityLabel={t(following ? 'map.following' : 'map.recenter')}
          accessibilityState={{ disabled: !origin, selected: following }}
          style={[
            styles.sideButton,
            {
              shadowColor: theme.colors.shadow,
              backgroundColor:
                following && origin ? theme.colors.userPosition : theme.colors.surface,
            },
          ]}
        >
          {/*
            Sans position, on grise l'icône et non le bouton entier : un carré
            blanc à 45 % d'opacité par-dessus la carte se lit comme un défaut
            d'affichage, pas comme une commande indisponible.

            Suivi actif, l'icône passe à l'**encre** et non au blanc : du blanc
            sur le jaune `#F5B301` tombe à 1,9:1, illisible en plein soleil.
            Inactive, elle prend le jaune sombre, pour la même raison à
            l'envers.
          */}
          <CrosshairIcon
            color={
              !origin
                ? theme.colors.muted
                : following
                  ? theme.colors.ink
                  : theme.colors.userPositionDeep
            }
          />
        </Pressable>
      </View>

      <View
        onLayout={onSheetLayout}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.sheet,
            borderTopRightRadius: theme.radius.sheet,
          },
        ]}
      >
        <View style={{ alignItems: 'center', paddingVertical: theme.space.md }}>
          <View style={{ width: 34, height: 3, backgroundColor: theme.colors.rule }} />
        </View>

        <View style={{ paddingHorizontal: theme.space.lg, gap: theme.space.lg }}>
          <PositionRow
            addressLabel={geocodedLabel}
            origin={origin}
            status={status}
            accuracyM={accuracyM}
            onRetry={retry}
          />

          <View style={{ height: 78, justifyContent: 'center' }}>
            {loadingCards ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                contentContainerStyle={{ gap: CARD_GAP }}
              >
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} width={CARD_WIDTH} height={78} />
                ))}
              </ScrollView>
            ) : mapped.length > 0 ? (
              <ScrollView
                ref={carouselRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                // Le carrousel s'arrête sur une vignette entière : une carte
                // coupée en deux au repos donne l'impression d'un rendu raté.
                snapToInterval={CARD_WIDTH + CARD_GAP}
                decelerationRate="fast"
                contentContainerStyle={{ gap: CARD_GAP, paddingRight: theme.space.lg }}
              >
                {mapped.map((garage) => (
                  <GarageCard
                    key={garage.id}
                    garage={garage}
                    width={CARD_WIDTH}
                    selected={garage.id === selectedId}
                    onPress={() => openGarage(garage)}
                  />
                ))}
              </ScrollView>
            ) : searchedInVain ? (
              // Le rayon a bien été fouillé et il est vide : on le montre,
              // plutôt que de le dire en petit texte gris.
              <EmptyRadius radiusKm={nearby.data?.meta.radiusKm ?? searchRadiusKm} />
            ) : (
              <Text variant="small" tone="muted">
                {emptyMessage}
              </Text>
            )}
          </View>
        </View>

        <View style={{ padding: theme.space.lg }}>
          {/*
            Le SOS ne mène plus droit au formulaire : `useSosEntry` demande
            d'abord au serveur si une demande est déjà ouverte, et rouvre
            l'écran correspondant à son avancement le cas échéant.
          */}
          <SosButton
            title={t('sos.title')}
            subtitle={t('sos.subtitle')}
            onPress={() => sosEntry.start()}
          />
        </View>
      </View>

      {/*
        Posé en dernier, donc au-dessus de tout : il masque la carte tant
        qu'elle n'a rien à montrer. Le vrai écran est monté **derrière** —
        MapLibre a besoin d'être dans l'arbre pour commencer à charger, et la
        recherche de garages part pendant ce temps.
      */}
      {!mapReady ? <CarteSkeleton sheetHeight={sheetHeight} /> : null}

      {/* Recherche d'une demande en cours, déclenchée par le bouton SOS. */}
      <ActiveRequestSearch visible={sosEntry.checking} />
    </View>
  );
}

/**
 * Ligne de contexte : « • **7** garages ouverts autour de vous ».
 *
 * Elle porte aussi l'état du chargement et l'échec réseau, parce que c'est
 * exactement le même fait — combien de garages on connaît autour de soi, et
 * avec quelle confiance. Un bandeau d'erreur séparé, posé au-dessus de la
 * carte, masquerait la carte pour dire moins.
 */
function ContextLine({
  loading,
  failed,
  errorLabel,
  onRetry,
  count,
  total,
  hasOrigin,
}: {
  loading: boolean;
  failed: boolean;
  errorLabel: string | null;
  onRetry: () => void;
  count: number;
  total: number;
  hasOrigin: boolean;
}) {
  const theme = useTheme();
  const { t, plural } = useI18n();

  const shown = count > 0 ? count : total;
  const countKey =
    count > 0
      ? plural(count) === 'one'
        ? 'map.openGarages.one'
        : 'map.openGarages'
      : plural(total) === 'one'
        ? 'map.garagesAround.one'
        : 'map.garagesAround';

  if (failed) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary }}
        />
        <Text variant="body" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {errorLabel ?? t('map.loadFailed')}
        </Text>
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text variant="bodyStrong" tone="primary">
            {t('common.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
      {/* La pastille passe au rouge pendant un rechargement : elle signale une
          donnée vivante, sa couleur dit si elle est à jour. */}
      <BlinkingDot color={loading ? theme.colors.primary : theme.colors.success} />
      <Text variant="body" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
        {!hasOrigin ? (
          // Sans position, il n'y a pas de « autour de vous » : annoncer
          // « 0 garages » attribuerait au parc de garages ce qui relève du GPS.
          t('map.acquiring')
        ) : loading && total === 0 ? (
          t('map.searching')
        ) : (
          // Le décompte, y compris à zéro. C'est le panneau du rayon vide, en
          // dessous, qui explique — le répéter ici ferait dire deux fois la
          // même chose à deux endroits de la même feuille.
          <>
            <Text variant="monoStrong">{shown}</Text> {t(countKey)}
          </>
        )}
      </Text>
    </View>
  );
}

/**
 * Ligne « POSITION EXACTE ».
 *
 * Elle doit toujours tenir sur une ligne, et surtout ne jamais mentir : le
 * badge affiche la précision **réelle** rendue par le GPS, et le libellé vient
 * d'un géocodage inverse de la position de l'utilisateur. Quand le géocodage
 * échoue, on montre les coordonnées brutes en mono plutôt que d'emprunter le
 * quartier du garage le plus proche — sous un intitulé « position exacte », un
 * nom de lieu approximatif est pire que pas de nom.
 */
function PositionRow({
  addressLabel,
  origin,
  status,
  accuracyM,
  onRetry,
}: {
  addressLabel: string | null;
  origin: { lat: number; lng: number } | null;
  status: string;
  accuracyM: number | null;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const { t, formatNumber } = useI18n();

  const resolved = status === 'ready' && origin !== null;

  /**
   * **Seul** `denied` justifie un bouton de reprise.
   *
   * `acquiring` et `unavailable` veulent dire que le GPS cherche encore : le
   * `watchPositionAsync` tourne toujours, et un point peut tomber à la seconde
   * suivante. Proposer « Réessayer » là revient à demander de relancer ce qui
   * est déjà en cours — et à faire passer une attente normale pour un échec.
   * `denied`, en revanche, est un état définitif tant que l'utilisateur n'agit
   * pas : là, le bouton est la seule sortie.
   */
  const blocked = status === 'denied';
  const searching = !resolved && !blocked;

  const label = addressLabel
    ?? (origin
      ? `${formatNumber(origin.lat, 4)}° N · ${formatNumber(origin.lng, 4)}° E`
      : t('location.unavailable'));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
      <View
        style={{
          width: 40,
          height: 40,
          backgroundColor: `${theme.colors.userPosition}26`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            borderWidth: 3,
            borderColor: theme.colors.userPositionDeep,
          }}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="sectionLabel" style={{ color: theme.colors.sectionLabel }}>
          {t('map.exactPosition')}
        </Text>

        {searching ? (
          // Un squelette à la place de « Position indisponible ». Le mot
          // « indisponible » annonce un échec, alors que l'acquisition dure
          // normalement deux à quatre secondes : on affichait donc une panne
          // pendant le fonctionnement nominal.
          <Skeleton width={168} height={15} style={{ marginTop: 3 }} />
        ) : (
          /*
            Cette ligne doit toujours tenir sur une ligne. Les avenues de
            Yaoundé ont des noms longs — « Avenue du Président El Hadj Ahmadou
            Ahidjo » — alors on rétrécit un peu avant de couper, plutôt que de
            tronquer d'emblée un nom que l'utilisateur cherche justement à
            reconnaître.
          */
          <Text
            variant={addressLabel ? 'bodyStrong' : origin ? 'monoStrong' : 'bodyStrong'}
            numberOfLines={1}
            adjustsFontSizeToFit
            // Plancher haut : au-delà d'un léger rétrécissement, on préfère
            // couper. Une adresse réduite à dix pixels n'est plus lisible en
            // plein soleil, ce qui est précisément la condition d'usage.
            minimumFontScale={0.9}
          >
            {label}
          </Text>
        )}
      </View>

      {resolved ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.xs,
            backgroundColor: `${theme.colors.success}1A`,
            paddingHorizontal: theme.space.md,
            paddingVertical: theme.space.sm,
          }}
        >
          <BlinkingDot size={6} />
          {/* Précision réelle du GPS, jamais une valeur décorative. */}
          <Text variant="monoSmall" tone="success">
            ±{accuracyM === null ? '—' : Math.round(accuracyM)}m
          </Text>
        </View>
      ) : blocked ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text variant="bodyStrong" tone="primary">
            {t('location.retry')}
          </Text>
        </Pressable>
      ) : (
        // Même gabarit que le badge « ±5m » qui prendra sa place : la ligne ne
        // se réorganise pas au moment où la position arrive.
        <Skeleton width={58} height={28} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  chrome: { position: 'absolute', top: 0, left: 0, right: 0 },
  centered36: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sideControls: { position: 'absolute', right: 16, gap: 12 },
  sideButton: {
    width: mapControlSize,
    height: mapControlSize,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    // Même couche que la recherche et les filtres : tout ce qui flotte sur la
    // carte porte la même ombre, sinon la hiérarchie se lit de travers.
    ...chromeShadow,
  },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
