import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { BlinkingDot } from './BlinkingDot';
import { ChamferView } from './ChamferView';
import type { IconProps } from './icons';
import { Text } from './Text';

/** Hauteur du bloc de boutons, hors zone sûre. */
const BAR_HEIGHT = 56;

/**
 * La barre porte **soit** un engagement, **soit** une attente — jamais les deux,
 * jamais aucun des deux.
 *
 * L'union le rend impossible à composer de travers. La version précédente
 * n'offrait qu'un bouton, ce qui obligeait à représenter « il n'y a rien à
 * faire » par un bouton désactivé : une forme qui promet une action, un aplat
 * rouge chamfré — la seule chose chamfrée de l'écran, donc celle que l'œil
 * cherche en premier — et qui ne répond pas au doigt. On appuyait, il ne se
 * passait rien, et le libellé long qu'il fallait y loger débordait par-dessus
 * le marché.
 */
export type ActionBarProps = {
  /** Action de gauche : secondaire, encadrée. */
  secondary: ActionProps;
  busy?: boolean;
} & (
  | {
      /** Action de droite : l'engagement, en rouge et chamfrée. */
      primary: ActionProps;
      waiting?: never;
    }
  | {
      primary?: never;
      /**
       * Ce qu'on attend, en deux mots.
       *
       * Occupe la place de l'engagement sans en prendre l'apparence : ni rouge,
       * ni chamfré, ni touchable. Court par nécessité — la fente fait un peu
       * plus de la moitié de la barre.
       */
      waiting: string;
    }
);

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
export function ActionBar({ secondary, primary, waiting, busy = false }: ActionBarProps) {
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
      {primary ? (
        <ActionButton {...primary} tone="primary" busy={busy} flex={1.45} />
      ) : (
        <WaitingSlot label={waiting ?? ''} />
      )}
    </View>
  );
}

/**
 * L'attente, à la place de l'engagement.
 *
 * Trois choses la distinguent d'un bouton, et les trois comptent :
 *
 *  - **pas de chamfer** — le coin coupé appartient aux actions, et c'est
 *    précisément ce que l'œil cherche pour savoir où appuyer ;
 *  - **pas de rouge, pas d'aplat** — un filet et le fond de page, comme un
 *    champ en lecture seule ;
 *  - **une pastille qui bat** — elle dit que quelque chose tourne encore, ce
 *    qu'un bouton grisé ne dit pas : lui a l'air en panne.
 *
 * Le rôle d'accessibilité est `text` et non `button` : un lecteur d'écran ne
 * doit pas annoncer une commande là où il n'y en a pas.
 */
function WaitingSlot({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        flex: 1.45,
        minHeight: BAR_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.md,
        borderWidth: 1,
        borderColor: theme.colors.rule,
      }}
    >
      <BlinkingDot size={7} color={theme.colors.success} />
      <Text
        variant="btnSm"
        tone="secondary"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{ flexShrink: 1 }}
      >
        {label}
      </Text>
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
