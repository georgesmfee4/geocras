import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { AlertIcon, ClockIcon, type IconProps } from './icons';
import { Text } from './Text';

export type CalloutTone = 'highlight' | 'danger';

/**
 * Encart d'explication.
 *
 * Deux tons seulement, et la distinction est stricte :
 *
 * - `highlight` — jaune : « ceci mérite votre attention ». Le changement de
 *   numéro, le dossier de garage en cours de vérification. Rien n'est cassé,
 *   mais il y a une conséquence à connaître avant de continuer.
 * - `danger` — rouge : l'erreur qui vient de se produire.
 *
 * Le rouge du produit appartient aux actions d'urgence et aux échecs. S'en
 * servir pour dire « votre dossier est à l'étude » le dévaluerait partout
 * ailleurs, à commencer par le bouton SOS.
 */
export function Callout({
  tone = 'highlight',
  icon: Icon,
  title,
  children,
}: {
  tone?: CalloutTone;
  /** Par défaut : l'horloge en jaune, l'alerte en rouge. */
  icon?: (props: IconProps) => ReactNode;
  title?: string;
  children: string;
}) {
  const theme = useTheme();

  const accent = tone === 'danger' ? theme.colors.primary : theme.colors.highlight;
  const background = tone === 'danger' ? theme.colors.primaryTint : theme.colors.highlightTint;
  const Glyph = Icon ?? (tone === 'danger' ? AlertIcon : ClockIcon);

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.space.md,
        backgroundColor: background,
        borderLeftWidth: 3,
        borderLeftColor: accent,
        paddingVertical: theme.space.md,
        paddingHorizontal: theme.space.md,
      }}
    >
      {/*
        Le pictogramme est tracé dans l'encre et non dans le jaune vif : sur le
        fond pâle de l'encart, le jaune tombe sous le seuil de lisibilité en
        plein soleil — c'est la même raison qui a fait naître `userPositionDeep`.
      */}
      <View style={{ paddingTop: 1 }}>
        <Glyph color={tone === 'danger' ? theme.colors.primary : theme.colors.ink} size={18} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="bodyStrong">{title}</Text> : null}
        <Text variant="small" tone={tone === 'danger' ? 'primary' : 'secondary'}>
          {children}
        </Text>
      </View>
    </View>
  );
}
