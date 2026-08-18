import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { AuthMark } from './AuthMark';
import { ChevronLeftIcon } from './icons';
import { Text, Wordmark } from './Text';

/**
 * Hauteur de la bande diagonale qui referme le bandeau.
 *
 * Volontairement basse : la pente vaut vingt-deux points pour toute la largeur
 * de l'écran, soit environ trois degrés. Au-delà, la diagonale devient un
 * motif et attire l'œil pour elle-même ; ici elle ne fait que refuser
 * l'horizontale, ce qui suffit à dire que le bandeau n'est pas une barre de
 * navigation.
 */
const DIAGONAL_HEIGHT = 22;

export type AuthHeroProps = {
  title: string;
  /** Une ligne, en capitales mono. Pas une phrase — le bandeau n'est pas un texte. */
  tagline: string;
  /**
   * Version resserrée, pour l'inscription : trois champs, une mention légale et
   * un renvoi tiennent en dessous, le bandeau leur cède la place.
   */
  compact?: boolean;
  onBack: () => void;
  /** Avancement du formulaire, de 0 à 1 — la marque s'en sert pour se resserrer. */
  progress: number;
  /** Requête en vol. */
  busy?: boolean;
  /** Nombre d'échecs depuis l'ouverture. */
  failures?: number;
};

/**
 * Bandeau des écrans d'authentification.
 *
 * Sombre dans les deux thèmes — voir le jeton `hero` — et refermé par un filet
 * rouge en diagonale, qui est la seule licence prise avec la charte : le filet
 * y est horizontal et long de 14 px devant un intitulé. Ici il traverse
 * l'écran. C'est le même trait, à la même épaisseur, dans le même rouge ; il
 * change d'échelle parce qu'il change de travail — il ne titre plus une
 * section, il sépare deux mondes.
 *
 * Le halo rouge du haut est un dégradé **radial**, comme celui du splash :
 * `expo-linear-gradient` ne sait pas le produire, d'où le passage par SVG. Un
 * dégradé linéaire donnerait une bande, pas une lueur.
 */
export function AuthHero({
  title,
  tagline,
  compact = false,
  onBack,
  progress,
  busy = false,
  failures = 0,
}: AuthHeroProps) {
  const theme = useTheme();
  const { t } = useI18n();

  const badge = compact ? 48 : 64;

  return (
    <View style={{ backgroundColor: theme.colors.hero }}>
      {/*
        La lueur est centrée haut et s'éteint avant les bords : elle réchauffe
        le noir derrière la marque sans jamais dessiner de cercle visible. Les
        deux arrêts sont dans la primaire du thème, l'opacité fait le reste —
        aucune couleur nouvelle n'entre par ici.
      */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="authHeroGlow" cx="50%" cy="30%" r="70%">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.26} />
            <Stop offset="0.62" stopColor={theme.colors.primary} stopOpacity={0.06} />
            <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authHeroGlow)" />
      </Svg>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.space.sm,
          height: 56,
        }}
      >
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={10}
          style={({ pressed }) => ({
            width: MIN_TOUCH_TARGET,
            height: MIN_TOUCH_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <ChevronLeftIcon color={theme.colors.onHero} />
        </Pressable>

        {/* La largeur du bouton est rendue à droite, sinon le logotype se
            centre sur ce qui reste et penche visiblement. */}
        <View style={{ flex: 1, alignItems: 'center', paddingRight: MIN_TOUCH_TARGET }}>
          <Wordmark size={15} color={theme.colors.onHero} />
        </View>
      </View>

      <View
        style={{
          alignItems: 'center',
          paddingHorizontal: theme.space.xl,
          paddingTop: compact ? theme.space.sm : theme.space.lg,
          paddingBottom: compact ? theme.space.xl : theme.space.xxl,
          gap: compact ? theme.space.md : theme.space.lg,
        }}
      >
        {/*
          Deux anneaux d'un point, pas un cercle plein : c'est la portée d'un
          signal, la même idée que les ondes du splash. Ils ne sont pas fixes —
          la marque est une visée qui se resserre sur le formulaire, voir
          `<AuthMark>`.
        */}
        <AuthMark size={badge} progress={progress} busy={busy} failures={failures} />

        <View style={{ alignItems: 'center', gap: theme.space.sm }}>
          <Text
            variant={compact ? 'h1b' : 'd1b'}
            numberOfLines={1}
            style={{ color: theme.colors.onHero, textAlign: 'center' }}
          >
            {title}
          </Text>
          <Text style={{ color: theme.colors.onHeroMuted, textAlign: 'center' }} variant="footnote">
            {tagline}
          </Text>
        </View>
      </View>

      {/*
        Le coin du bas. Le polygone peint le fond de page **sous** la diagonale,
        le filet rouge se pose exactement sur l'arête. Les deux sont rentrés
        d'une unité dans le cadre : un trait posé sur le bord serait coupé en
        deux par le clip du SVG, et le rouge s'amincirait dans l'angle sans
        qu'on comprenne pourquoi.
      */}
      <View style={{ height: DIAGONAL_HEIGHT }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 20" preserveAspectRatio="none">
          <Polygon points="0,19 100,1 100,20 0,20" fill={theme.colors.background} />
          <Line
            x1={0}
            y1={19}
            x2={100}
            y2={1}
            stroke={theme.colors.primary}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      </View>
    </View>
  );
}
