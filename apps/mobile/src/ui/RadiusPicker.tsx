import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

/** Côté du dessin. Trois anneaux y tiennent sans se toucher. */
const ART = 54;

/**
 * Rayons des trois anneaux, du plus proche au plus lointain.
 *
 * Ils ne sont pas proportionnels aux kilomètres et ne doivent pas l'être : 5,
 * 15 et 30 km à l'échelle donneraient un premier anneau confondu avec le point
 * central. Ce dessin dit **un cran de plus**, pas une distance — celle-ci est
 * écrite en chiffres juste en dessous, où elle se lit exactement.
 */
const RINGS = [9, 16, 23] as const;

/** Point de position au centre — le même repère que sur la carte. */
const DOT = 3.4;

export type RadiusPickerProps<T extends number> = {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
};

/**
 * Choix du rayon de recherche, en portée dessinée.
 *
 * Trois tuiles, trois portées. La version précédente était une liste de trois
 * lignes cochables, chacune avec sa phrase d'explication — « Un quartier », « La
 * route » — soit trois lignes de texte pour dire ce qu'un cercle dit d'un coup
 * d'œil. Sur un écran de réglages qui n'a que du texte, c'était la section la
 * plus verbeuse pour le réglage le plus visuel de l'application.
 *
 * Chaque tuile allume ses anneaux jusqu'à son rang : un pour le quartier, deux
 * pour la ville, trois pour la route. Les anneaux éteints restent tracés en
 * filet — c'est ce qui fait que les trois dessins se comparent, au lieu de
 * grandir chacun dans son coin.
 *
 * Le dernier anneau allumé est **en pointillés** : c'est une limite qu'on
 * fouille, pas une zone qu'on possède. Même trait que le rayon fouillé de
 * `<EmptyRadius>`, pour que les deux dessins se reconnaissent.
 */
export function RadiusPicker<T extends number>({ options, value, onChange }: RadiusPickerProps<T>) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.sm }} accessibilityRole="radiogroup">
      {options.map((option, index) => {
        const selected = option === value;

        // Éteint, le dessin reste lisible mais s'efface derrière le choix
        // courant : c'est le rouge qui désigne, pas la taille du cercle.
        const lit = selected ? theme.colors.primary : theme.colors.inkSecondary;
        const dim = theme.colors.rule;

        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option} km`}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: theme.space.sm,
              paddingVertical: theme.space.md,
              backgroundColor: selected
                ? theme.colors.primaryTint
                : pressed
                  ? theme.colors.primaryTint
                  : theme.colors.surface,
              borderWidth: 1,
              borderColor: selected ? theme.colors.primary : theme.colors.rule,
            })}
          >
            <Svg width={ART} height={ART} viewBox={`0 0 ${ART} ${ART}`}>
              {RINGS.map((radius, ring) => {
                const on = ring <= index;
                const edge = ring === index;

                return (
                  <Circle
                    key={radius}
                    cx={ART / 2}
                    cy={ART / 2}
                    r={radius}
                    fill="none"
                    stroke={on ? lit : dim}
                    strokeWidth={on ? 1.4 : 1}
                    strokeDasharray={edge ? '3 4' : undefined}
                    opacity={on ? 1 : 0.9}
                  />
                );
              })}

              <Circle cx={ART / 2} cy={ART / 2} r={DOT} fill={lit} />
            </Svg>

            {/*
              Le nombre porte la mesure, l'unité l'accompagne — d'où deux
              niveaux de mono et non un seul : « 30 km » écrit d'un bloc fait
              lire l'unité aussi fort que le chiffre, alors qu'elle est la même
              sur les trois tuiles et que seul le chiffre les distingue.
            */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
              <Text variant="num" tone={selected ? 'primary' : 'ink'}>
                {option}
              </Text>
              <Text
                variant="numSm"
                tone={selected ? 'primary' : 'muted'}
                style={{ paddingBottom: 2 }}
              >
                km
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
