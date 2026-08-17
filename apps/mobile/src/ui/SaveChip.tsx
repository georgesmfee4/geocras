import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChamferView } from './ChamferView';
import { CheckIcon } from './icons';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved';

/** Battement lent : il attire l'œil sans clignoter comme une alarme. */
const PULSE_MS = 780;
const PULSE_MIN = 0.45;

/**
 * Enregistrement, dans l'en-tête d'un écran de formulaire.
 *
 * Trois raisons d'être jaune et non rouge : le rouge appartient aux actions
 * d'urgence — SOS, suppression — et l'user finirait par ne plus le distinguer ;
 * le jaune `highlight` est déjà le ton des situations qui demandent l'attention
 * sans être graves ; et un aplat vif tient à côté d'un titre sans l'écraser.
 *
 * Il **n'existe que quand il y a quelque chose à enregistrer**. Un bouton
 * toujours là, grisé la plupart du temps, ne dit rien ; celui-ci apparaît en
 * battant à la première frappe, ce qui est exactement le message : « il reste
 * un geste à faire ». Après l'enregistrement il devient une coche verte, puis
 * disparaît.
 *
 * Le battement s'arrête si le système demande de réduire les animations — la
 * pastille reste alors pleinement visible, jamais figée sur son état pâle.
 */
export function SaveChip({ state, onPress }: { state: SaveState; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  const pulsing = state === 'dirty' && !reducedMotion;

  useEffect(() => {
    if (!pulsing) {
      opacity.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: PULSE_MIN,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [pulsing, opacity]);

  if (state === 'idle') return null;

  const saved = state === 'saved';

  return (
    <Animated.View style={{ opacity }}>
      <Pressable
        onPress={onPress}
        disabled={state !== 'dirty'}
        accessibilityRole="button"
        accessibilityLabel={saved ? t('account.saved') : t('common.save')}
        accessibilityState={{ disabled: state !== 'dirty', busy: state === 'saving' }}
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <ChamferView
          fill={saved ? theme.colors.success : theme.colors.highlight}
          style={{ minHeight: MIN_TOUCH_TARGET - 6 }}
          contentStyle={{
            minHeight: MIN_TOUCH_TARGET - 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            paddingLeft: theme.space.md,
            // Rembourrage plus large à droite : le coin coupé mange l'angle, et
            // un libellé qui vient s'y loger paraît rogné.
            paddingRight: theme.space.lg,
          }}
        >
          {state === 'saving' ? (
            <ActivityIndicator size="small" color={theme.colors.onHighlight} />
          ) : saved ? (
            <CheckIcon color="#FFFFFF" size={15} />
          ) : null}

          <Text
            variant="btnSm"
            style={{ color: saved ? '#FFFFFF' : theme.colors.onHighlight }}
          >
            {saved ? t('account.saved') : t('common.save')}
          </Text>
        </ChamferView>
      </Pressable>
    </Animated.View>
  );
}
