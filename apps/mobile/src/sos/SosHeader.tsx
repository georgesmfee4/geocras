import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChevronLeftIcon } from '../ui/icons';
import { Text } from '../ui/Text';

export type SosHeaderProps = {
  title: string;
  /**
   * Étape courante, à partir de 1. Omise hors du parcours de déclaration —
   * l'écran de résultats réutilise le même en-tête mais n'est pas une étape
   * dénombrable : y afficher « 4/3 » ou une quatrième barre mentirait sur la
   * longueur du parcours.
   */
  step?: number;
  totalSteps?: number;
  onBack: () => void;
  backLabel: string;
};

/**
 * En-tête du parcours SOS : retour, titre, et barre de progression segmentée.
 *
 * La barre est en **segments séparés** et non en jauge continue, exactement
 * comme la maquette. La différence n'est pas décorative : trois traits
 * annoncent un parcours fini et dénombrable — on voit qu'il reste deux écrans,
 * pas « environ un tiers ». Sur un formulaire qu'on remplit en panne, savoir
 * combien il reste vaut mieux que savoir où l'on en est.
 *
 * Le numéro d'étape est en mono : c'est une donnée mesurée.
 */
export function SosHeader({ title, step, totalSteps, onBack, backLabel }: SosHeaderProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md, paddingHorizontal: theme.space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={8}
          style={{
            width: MIN_TOUCH_TARGET,
            height: MIN_TOUCH_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: -theme.space.md,
          }}
        >
          <ChevronLeftIcon color={theme.colors.ink} />
        </Pressable>

        <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </Text>

        {step !== undefined && totalSteps !== undefined ? (
          <Text variant="monoSmall" tone="muted">
            {step}/{totalSteps}
          </Text>
        ) : null}
      </View>

      {step !== undefined && totalSteps !== undefined ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: 3,
                backgroundColor: index < step ? theme.colors.primary : theme.colors.rule,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
