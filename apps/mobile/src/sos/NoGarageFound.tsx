import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { useReducedMotion } from '../ui/useReducedMotion';

export type NoGarageFoundProps = {
  /** Distance du garage le plus proche hors rayon, si le serveur en a trouvé un. */
  fallbackDistanceM: number | null;
  fallbackName: string | null;
  onCallSupport: () => void;
  onCancel: () => void;
  cancelling: boolean;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * État « aucun garage équipé dans le rayon ».
 *
 * Le cahier des charges interdit l'écran vide : au bord d'une route, une
 * impasse silencieuse est un échec produit. On donne donc trois choses — ce
 * qu'on a quand même trouvé, un humain à appeler, et une sortie propre.
 *
 * **Chromatique.** Le jaune porte l'alerte, le rouge porte l'action. Les deux
 * cohabitent sans se disputer parce qu'ils ne parlent pas de la même chose :
 * l'auréole ambrée dit « rien ici », le cœur rouge reste la marque et renvoie
 * au SOS en cours. Un panneau tout rouge aurait lu comme une erreur de l'app ;
 * tout jaune, comme un avertissement sans issue.
 */
export function NoGarageFound({
  fallbackDistanceM,
  fallbackName,
  onCallSupport,
  onCancel,
  cancelling,
}: NoGarageFoundProps) {
  const theme = useTheme();
  const { t, formatDistance } = useI18n();
  const reducedMotion = useReducedMotion();

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);

  const ringRadius = pulse.interpolate({ inputRange: [0, 1], outputRange: [17, 37] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] });

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        // Filet ambré épais sur le flanc gauche : la couleur d'alerte entre par
        // le bord, elle n'envahit pas la surface de lecture.
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.warning,
        padding: theme.space.lg,
        gap: theme.space.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <View style={{ width: 76, height: 76 }}>
          <Svg width="100%" height="100%" viewBox="0 0 80 80">
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="55%" stopColor={theme.colors.warning} stopOpacity={0.26} />
                <Stop offset="100%" stopColor={theme.colors.warning} stopOpacity={0} />
              </RadialGradient>
            </Defs>

            {/* Auréole ambrée — la portée fouillée, restée vide. */}
            <Circle cx={40} cy={40} r={38} fill="url(#halo)" />
            <Circle
              cx={40}
              cy={40}
              r={30}
              fill="none"
              stroke={theme.colors.warning}
              strokeWidth={1.6}
              strokeDasharray="4 5"
              opacity={0.75}
            />

            {!reducedMotion ? (
              <AnimatedCircle
                cx={40}
                cy={40}
                r={ringRadius as unknown as number}
                fill="none"
                stroke={theme.colors.warning}
                strokeWidth={2}
                opacity={ringOpacity as unknown as number}
              />
            ) : null}

            {/* Cœur rouge : la demande SOS existe toujours, elle attend. */}
            <Circle cx={40} cy={40} r={16} fill={theme.colors.primaryTint} />
            <Circle
              cx={40}
              cy={40}
              r={16}
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth={2.4}
            />
            <Path
              d="M40 31.5v10"
              stroke={theme.colors.primary}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <Circle cx={40} cy={47} r={1.9} fill={theme.colors.primary} />
          </Svg>
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading">{t('results.empty')}</Text>
          <Text variant="txt" tone="secondary">
            {t('results.emptyLead')}
          </Text>
        </View>
      </View>

      {/*
        Ce que le serveur a trouvé malgré tout. On ne le propose pas comme
        destination — cent kilomètres n'est pas une réponse — mais le taire
        laisserait croire qu'il n'existe rien du tout.
      */}
      {fallbackDistanceM !== null && fallbackName ? (
        <View
          style={{
            backgroundColor: theme.colors.background,
            padding: theme.space.md,
            gap: 2,
          }}
        >
          {/*
            Deux lignes, et non une seule tronquée : l'intitulé et le nom
            entraient en concurrence pour la même largeur, et c'est le nom —
            la seule information utile — qui se faisait couper.
          */}
          <Text variant="sectionLabel" style={{ color: theme.colors.sectionLabel }}>
            {t('results.nearestOutside')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <Text variant="h2" numberOfLines={1} style={{ flex: 1 }}>
              {fallbackName}
            </Text>
            <Text variant="monoStrong" tone="primary">
              {formatDistance(fallbackDistanceM)}
            </Text>
          </View>
        </View>
      ) : null}

      <Button label={t('results.callSupport')} fullWidth onPress={onCallSupport} />

      {/*
        Annuler est une sortie, pas une action mise en avant : contour et non
        aplat rouge. Elle referme la demande côté serveur — sans elle, le
        `pending` bloquerait tout nouveau SOS sans qu'on sache pourquoi.
      */}
      <Button
        label={t('results.cancelRequest')}
        variant="outline"
        fullWidth
        loading={cancelling}
        onPress={onCancel}
      />
    </View>
  );
}
