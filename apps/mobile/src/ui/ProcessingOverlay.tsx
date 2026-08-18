import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

/**
 * Le voile d'action en cours — l'état `processing` du tableau des états.
 *
 * **Il dit quelle action, pas « ça charge ».** C'est toute la différence avec
 * un indicateur d'écran : quand on annule un SOS, la seule question qui compte
 * est « est-ce que mon annulation est partie », et une roue anonyme au milieu
 * de la page n'y répond pas — elle laisse même croire que c'est l'écran qui se
 * recharge, donc que le geste n'a pas été pris.
 *
 * **Il bloque le toucher, volontairement.** Une annulation lancée deux fois
 * part deux fois : la seconde tombe sur une demande déjà close et remonte une
 * erreur, sur un écran où l'utilisateur est en panne au bord d'une route. Le
 * voile est la façon la plus simple de rendre le double appui impossible, et
 * elle se comprend sans être expliquée.
 *
 * Le voile est l'encre translucide du produit, jamais un noir neutre : le fond
 * de l'app est chaud, et un gris bleuté refroidirait toute l'image le temps de
 * l'attente.
 */
export function ProcessingOverlay({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.space.xxxl,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      // Il intercepte tout : c'est sa fonction, pas un effet de bord.
      pointerEvents="auto"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
          paddingHorizontal: theme.space.xl,
          paddingVertical: theme.space.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.rule,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
        <Text variant="h2b" numberOfLines={2} style={{ flexShrink: 1 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

