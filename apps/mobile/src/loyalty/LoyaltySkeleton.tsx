import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Skeleton } from '../ui/Skeleton';

/**
 * Emplacement du carrousel de grades.
 *
 * Exporté parce qu'il sert **deux fois** : dans le squelette de chargement, et
 * comme cale pendant l'animation d'ouverture, le temps que le carrousel
 * lui-même soit monté. Les deux doivent occuper la même hauteur au pixel près —
 * un bloc plus court ferait remonter tout le bas de la page au moment où les
 * vraies cartes arrivent.
 */
export function GradesPlaceholder({ animated = true }: { animated?: boolean }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md }}>
      {/* Segments puis cartes — la première déborde, comme au repos. */}
      <View style={{ flexDirection: 'row', gap: 3, paddingHorizontal: theme.space.xl }}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View key={index} style={{ flex: 1 }}>
            <Skeleton width="100%" height={3} animated={animated} />
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space.md, paddingLeft: theme.space.xl }}>
        <Skeleton width={280} height={176} animated={animated} />
        <Skeleton width={280} height={176} animated={animated} />
      </View>
    </View>
  );
}

/**
 * Attente de l'écran Fidélité.
 *
 * Il ne s'agit pas de « montrer quelque chose pendant que ça charge » : les
 * blocs reprennent **la géométrie exacte** de l'écran final — hauteur du solde,
 * carte de progression, largeur de la carte de grade qui déborde à droite. Rien
 * ne se déplace donc au moment où la donnée arrive, alors qu'un indicateur
 * centré aurait fait sauter toute la page d'un coup.
 *
 * C'est aussi ce qui rend l'attente lisible : on sait avant de lire qu'il y
 * aura un chiffre en haut, une barre au milieu, des cartes en bas.
 *
 * `animated={false}` pendant la transition d'ouverture : à ce moment-là, ce
 * squelette est la **seule** chose que l'écran rend, et il ne doit rien coûter.
 * L'ondulation démarre ensuite, si la donnée se fait attendre.
 */
export function LoyaltySkeleton({ animated = true }: { animated?: boolean }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.xxl, paddingTop: theme.space.xl }}>
      {/* Solde et grade. */}
      <View style={{ paddingHorizontal: theme.space.xl, gap: theme.space.md }}>
        <Skeleton width={120} height={13} animated={animated} />
        <Skeleton width={180} height={34} animated={animated} />
        <Skeleton width={140} height={15} animated={animated} />
      </View>

      {/* Carte « prochain grade », fond encre dans l'écran final. */}
      <View style={{ paddingHorizontal: theme.space.xl }}>
        <Skeleton width="100%" height={112} animated={animated} />
      </View>

      <GradesPlaceholder animated={animated} />

      {/* Les intitulés dépliables du bas. */}
      <View style={{ paddingHorizontal: theme.space.xl, gap: theme.space.lg }}>
        <Skeleton width="55%" height={13} animated={animated} />
        <Skeleton width="45%" height={13} animated={animated} />
        <Skeleton width="60%" height={13} animated={animated} />
      </View>
    </View>
  );
}
