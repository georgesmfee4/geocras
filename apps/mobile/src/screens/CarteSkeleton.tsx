import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { mapColors } from '../theme/tokens';
import { GhostMap } from '../ui/GhostMap';
import { Skeleton } from '../ui/Skeleton';
import { Wordmark } from '../ui/Text';

export type CarteSkeletonProps = {
  /** Hauteur réservée à la feuille du bas, pour qu'elle ne se déplace pas. */
  sheetHeight: number;
};

/**
 * Écran d'accueil en attente.
 *
 * Il existe pour une raison précise : entre la disparition du splash et le
 * premier rendu de la carte, il s'écoule le temps de créer la surface native
 * MapLibre **et** de télécharger le style vectoriel. Sur un réseau camerounais
 * ce n'est pas instantané, et l'écran restait vide — un blanc franc juste
 * après un splash rouge, qui se lit comme un plantage.
 *
 * La réponse n'est pas un indicateur de chargement mais la **silhouette de
 * l'écran qui arrive** : mêmes blocs, mêmes positions, mêmes hauteurs. Quand
 * la carte prend le relais, rien ne bouge — le wordmark, la barre de recherche
 * et le bouton SOS sont déjà à leur place définitive.
 *
 * Le fond reprend `mapColors.land` et non la couleur de fond de l'app : c'est
 * la teinte qu'aura la carte une fois chargée, donc la substitution ne produit
 * aucun changement de valeur.
 */
export function CarteSkeleton({ sheetHeight }: CarteSkeletonProps) {
  const theme = useTheme();

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: mapColors.land }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/*
        Filigrane de plan de ville, le même que sur le splash. C'est ce qui
        fait lire la zone comme « une carte qui arrive » plutôt que comme une
        surface vide, et c'est aussi le fil visuel entre les deux écrans.
      */}
      <GhostMap opacity={0.09} color={theme.colors.ink} />

      <SafeAreaView edges={['top']}>
        <View
          style={{
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.sm,
            gap: theme.space.md,
          }}
        >
          {/* Le wordmark est réel : il est déjà chargé, rien ne justifie de le
              masquer derrière un bloc gris. */}
          <View style={{ alignItems: 'center' }}>
            <Wordmark size={15} />
          </View>

          <Skeleton width="100%" height={48} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <Skeleton width={8} height={8} style={{ borderRadius: 4 }} />
            <Skeleton width={188} height={14} />
          </View>

          <View style={{ flexDirection: 'row', gap: theme.space.md }}>
            <Skeleton width={104} height={34} />
            <Skeleton width={92} height={34} />
            <Skeleton width={128} height={34} />
          </View>
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
            <Skeleton width={40} height={40} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width={92} height={9} />
              <Skeleton width={168} height={15} />
            </View>
            <Skeleton width={58} height={28} />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width={250} height={78} />
            <Skeleton width={250} height={78} />
          </View>
        </View>

        <View style={{ padding: theme.space.lg }}>
          <Skeleton width="100%" height={64} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
