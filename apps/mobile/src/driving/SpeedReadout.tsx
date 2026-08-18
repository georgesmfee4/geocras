import { View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { useDrivingStore } from '../stores/driving';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';

/** Filet posé sous l'unité. Imposé par la maquette : 64 × 2. */
const RULE = { width: 64, height: 2 } as const;

/**
 * Le compteur de vitesse.
 *
 * Trois décisions, toutes dictées par le fait qu'on le lit **en conduisant** :
 *
 *  1. **104 points de mono.** C'est le plus gros chiffre de toute l'application,
 *     et il a son propre niveau typographique. À bout de bras, sur un support de
 *     tableau de bord, c'est la taille en dessous de laquelle il faut fixer
 *     l'écran au lieu de le survoler.
 *  2. **Chasse fixe.** `tabular-nums` est acquis avec la variante : sans lui, le
 *     passage de 88 à 91 déplacerait le bloc entier sur un rafraîchissement à
 *     4 Hz, et l'œil suivrait le mouvement au lieu de lire la valeur.
 *  3. **Abonnement local.** Le composant lit le store lui-même plutôt que de
 *     recevoir la vitesse en propriété : c'est ce qui garde les quatre rendus
 *     par seconde ici, au lieu de les propager à l'écran entier — pile
 *     d'alertes et barre de contrôle comprises.
 *
 * En pause, le chiffre s'estompe au lieu de retomber à zéro : on n'a pas mesuré
 * zéro, on a arrêté de mesurer. Afficher `0` serait une fausse lecture.
 */
export function SpeedReadout({ paused }: { paused: boolean }) {
  const theme = useTheme();
  const { t } = useI18n();
  const speedKmh = useDrivingStore((state) => state.speedKmh);

  return (
    <View
      style={{ alignItems: 'center', opacity: paused ? 0.4 : 1 }}
      /*
        Un seul élément d'accessibilité pour le bloc entier : `accessible`
        regroupe les enfants, et le lecteur d'écran annonce « 62 km/h » au lieu
        d'énoncer « 62 » puis « KM/H » en deux arrêts.
      */
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${speedKmh} ${t('driving.kmh')}`}
    >
      <Text variant="speed" numberOfLines={1}>
        {speedKmh}
      </Text>

      {/*
        Encre secondaire et non discrète. Sur le noir, `muted` passait ; sur le
        blanc chaud il tombe sous les trois pour un de contraste, et ce libellé
        de onze points très interlettré est précisément ce qui disparaît en
        premier en plein soleil. Or il porte l'unité — sans lui, le plus gros
        chiffre de l'app ne veut plus rien dire.
      */}
      <Text variant="speedUnit" tone="secondary" style={{ marginTop: theme.space.sm }}>
        {t('driving.kmh')}
      </Text>

      {/*
        Le filet rouge, ici en 64 points au lieu des 14 d'un intitulé de
        section. C'est le même trait qui change de travail : il ne titre pas le
        compteur, il le pose — il lui donne un sol, ce dont un chiffre de cette
        taille a besoin pour ne pas flotter au milieu du noir.
      */}
      <View
        style={{
          width: RULE.width,
          height: RULE.height,
          marginTop: theme.space.xl,
          backgroundColor: theme.colors.primary,
        }}
      />
    </View>
  );
}
