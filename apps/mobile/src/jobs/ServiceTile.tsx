import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { BlinkingDot } from '../ui/BlinkingDot';
import { ChamferView } from '../ui/ChamferView';
import { ChevronRightIcon, type IconProps } from '../ui/icons';
import { Text } from '../ui/Text';

export type ServiceTileProps = {
  /** Nom du service, en capitales — c'est un poste de travail, pas un menu. */
  title: string;
  lead: string;
  icon: (props: IconProps) => ReactNode;
  /**
   * Compteur affiché en gros chiffre mono. `null` quand le service n'a rien à
   * dénombrer — la tuile Radar tant qu'elle n'est pas ouverte.
   */
  count?: number | null;
  /** Le service écoute en direct : pastille clignotante. */
  live?: boolean;
  /** Marqueur d'un service annoncé mais pas encore ouvert. */
  badge?: string;
  onPress?: (() => void) | undefined;
};

/**
 * Tuile d'entrée d'un service du poste de travail garagiste.
 *
 * Deux tuiles, pas une liste de liens : ce ne sont pas des rubriques mais deux
 * **modes de travail** distincts — répondre à ce qui arrive, ou surveiller ce
 * qui pourrait arriver. Une liste de lignes les aurait mis au même rang qu'un
 * réglage.
 *
 * La tuile **active** prend l'encre, pas la surface blanche : c'est l'inversion
 * de contraste, et non la taille, qui fait qu'on la trouve avant d'avoir lu.
 * Le compteur y est posé en gros mono comme un cadran — un garagiste veut
 * savoir *combien*, avant même de savoir *quoi*.
 *
 * La tuile inerte, elle, ne fait pas semblant : fond de page, filet, et le mot
 * qui dit qu'elle n'ouvre rien encore. Une tuile grisée qui réagit au toucher
 * serait pire qu'absente.
 */
export function ServiceTile({
  title,
  lead,
  icon: Icon,
  count = null,
  live = false,
  badge,
  onPress,
}: ServiceTileProps) {
  const theme = useTheme();

  const enabled = onPress !== undefined;
  const ink = enabled ? theme.colors.surface : theme.colors.inkSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole={enabled ? 'button' : undefined}
      accessibilityLabel={count === null ? `${title}. ${lead}` : `${title}, ${count}. ${lead}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View
        style={{
          minHeight: 124,
          flexDirection: 'row',
          backgroundColor: enabled ? theme.colors.ink : theme.colors.background,
          borderWidth: enabled ? 0 : 1,
          borderColor: theme.colors.rule,
        }}
      >
        {/*
          Filet rouge plein hauteur, à gauche.

          C'est le filet de section du produit, redressé et étiré : il rattache
          la tuile à l'identité au lieu d'en faire une carte de tableau de bord
          interchangeable.
        */}
        <View style={{ width: 4, backgroundColor: enabled ? theme.colors.primary : theme.colors.rule }} />

        <View style={{ flex: 1, padding: theme.space.lg, gap: theme.space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            {Icon({ color: enabled ? theme.colors.primary : theme.colors.muted, size: 20 })}

            <Text variant="lblb" style={{ color: enabled ? theme.colors.surface : theme.colors.muted }}>
              {title}
            </Text>

            {live ? <BlinkingDot size={7} color={theme.colors.success} /> : null}

            <View style={{ flex: 1 }} />

            {badge ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.muted,
                  paddingHorizontal: theme.space.sm,
                  paddingVertical: 2,
                }}
              >
                <Text variant="lblb" tone="muted">
                  {badge}
                </Text>
              </View>
            ) : null}

            {enabled ? <ChevronRightIcon color={theme.colors.surface} size={18} /> : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.md }}>
            {count !== null ? (
              /*
                Le compteur est chamfré, la tuile ne l'est pas : le cahier des
                charges réserve l'angle coupé aux badges et aux actions, pas aux
                surfaces de contenu. Le badge à zéro reste affiché, contrairement
                à celui de la barre d'onglets — ici « 0 » est une réponse à la
                question qu'on est venu poser, pas une notification vide.
              */
              <ChamferView
                fill={count > 0 ? theme.colors.primary : 'transparent'}
                borderColor={theme.colors.surface}
                borderWidth={count > 0 ? 0 : 1}
                contentStyle={{
                  minWidth: 52,
                  paddingHorizontal: theme.space.md,
                  paddingVertical: 2,
                  alignItems: 'center',
                }}
              >
                <Text variant="numXl" style={{ color: theme.colors.surface, fontSize: 34, lineHeight: 40 }}>
                  {count}
                </Text>
              </ChamferView>
            ) : null}

            <Text
              variant="txt"
              numberOfLines={2}
              style={{ flex: 1, color: ink, opacity: enabled ? 0.75 : 1, paddingBottom: 4 }}
            >
              {lead}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
