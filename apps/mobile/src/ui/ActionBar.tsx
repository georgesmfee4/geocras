import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChamferView } from './ChamferView';
import type { IconProps } from './icons';
import { Text } from './Text';

/** Hauteur du bloc de boutons, hors zone sûre. */
const BAR_HEIGHT = 56;

export type ActionBarProps = {
  /** Action de gauche : secondaire, encadrée. */
  secondary: ActionProps;
  /** Action de droite : l'engagement, en rouge et chamfrée. */
  primary: ActionProps;
  busy?: boolean;
};

export type ActionProps = {
  label: string;
  icon: (props: IconProps) => ReactNode;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Barre d'action de bas d'écran, **posée par-dessus et non dans le flux**.
 *
 * Partagée par les deux côtés du produit — le garagiste qui accepte ou décline,
 * le client qui appelle ou confirme une arrivée. Ce sont les mêmes gestes dans
 * la même situation : debout au bord d'une route, une main sur le téléphone.
 * Deux composants auraient divergé au premier ajustement, et les deux moitiés
 * de la même intervention n'auraient plus eu la même grammaire.
 *
 * L'action est urgente et déjà décidée : l'enterrer sous un écran qui défile,
 * c'est demander de lire avant d'agir. La barre reste donc collée au bas,
 * toujours atteignable au pouce.
 *
 * La composition tient en trois règles :
 *
 *  - **deux actions, jamais trois.** Un choix binaire se prend sans regarder ;
 *    au troisième bouton il faut lire les trois ;
 *  - **la droite engage.** Rouge, chamfrée, plus large — c'est la seule chose
 *    chamfrée de l'écran, donc la seule que l'œil trouve sans chercher. La
 *    gauche est encadrée, du même poids visuel qu'un retour ;
 *  - **l'icône précède le mot** sur les deux, pour qu'elles se lisent comme une
 *    paire et pas comme deux composants empruntés à deux écrans.
 */
export function ActionBar({ secondary, primary, busy = false }: ActionBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        // Le fond n'est pas décoratif : sans lui, le contenu qui défile passe
        // sous les boutons et les rend illisibles au pire moment.
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.rule,
        paddingHorizontal: theme.space.lg,
        paddingTop: theme.space.md,
        paddingBottom: Math.max(insets.bottom, theme.space.md),
        flexDirection: 'row',
        gap: theme.space.md,
      }}
    >
      <ActionButton {...secondary} tone="outline" busy={false} flex={1} />
      <ActionButton {...primary} tone="primary" busy={busy} flex={1.45} />
    </View>
  );
}

/**
 * Hauteur commune aux deux boutons, calée sur la cible tactile.
 *
 * Le bouton encadré ne peut pas être plus court que le rouge : deux hauteurs
 * différentes donneraient à la paire l'air d'un assemblage, et c'est exactement
 * le défaut qu'on corrige.
 */
function ActionButton({
  label,
  icon: Icon,
  onPress,
  disabled = false,
  tone,
  busy,
  flex,
}: ActionProps & { tone: 'outline' | 'primary'; busy: boolean; flex: number }) {
  const theme = useTheme();

  const inert = disabled || busy;
  const ink = tone === 'primary' ? theme.colors.surface : theme.colors.ink;

  const content = busy ? (
    <ActivityIndicator color={ink} />
  ) : (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.sm,
      }}
    >
      {Icon({ color: ink, size: 18 })}
      <Text variant="btn" numberOfLines={1} ellipsizeMode="tail" style={{ color: ink }}>
        {label}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy }}
      style={({ pressed }) => ({
        flex,
        opacity: inert ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      {tone === 'primary' ? (
        <ChamferView
          fill={theme.colors.primary}
          style={{ minHeight: BAR_HEIGHT }}
          contentStyle={{
            minHeight: BAR_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.space.md,
          }}
        >
          {content}
        </ChamferView>
      ) : (
        <View
          style={{
            minHeight: Math.max(BAR_HEIGHT, MIN_TOUCH_TARGET),
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.space.md,
            backgroundColor: theme.colors.surface,
            // Filet de 2 px : à 1 px le bouton encadré disparaît à côté de
            // l'aplat rouge, et la paire perd son équilibre.
            borderWidth: 2,
            borderColor: theme.colors.ink,
          }}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

/** Hauteur totale réservée sous le contenu pour que la barre ne masque rien. */
export function useActionBarInset(): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + 12 + Math.max(insets.bottom, 12) + 1;
}
