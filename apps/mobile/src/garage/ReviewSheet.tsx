import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { REVIEW_COMMENT_MAX } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/SectionLabel';
import { STAR_PATH } from '../ui/Stars';
import { Text } from '../ui/Text';
import { useReducedMotion } from '../ui/useReducedMotion';

/** Libellé de chaque note, indexé de 1 à 5. */
const RATING_LABELS: Readonly<Record<number, TranslationKey>> = {
  1: 'review.rate1',
  2: 'review.rate2',
  3: 'review.rate3',
  4: 'review.rate4',
  5: 'review.rate5',
};

/**
 * Seuil à partir duquel le compteur de caractères passe en rouge.
 *
 * Il ne sert à rien tant qu'il reste de la place : c'est en approchant de la
 * limite qu'on a besoin de savoir combien il reste, pas au premier mot.
 */
const COUNTER_WARN_AT = 0.85;

export type ReviewSheetProps = {
  visible: boolean;
  /** Nom du garage noté — rappelé pour qu'on sache ce qu'on est en train de juger. */
  garageName: string;
  submitting: boolean;
  error: string | null;
  safeAreaBottom: number;
  onClose: () => void;
  onSubmit: (rating: number, comment: string | null) => void;
};

/**
 * Saisie d'un avis : une note, un commentaire facultatif.
 *
 * La note d'abord, en grand, et rien d'autre au départ. C'est la seule donnée
 * obligatoire, celle qui alimente la moyenne du garage — le commentaire est un
 * bonus que la plupart des gens n'écriront pas, et lui donner la même place
 * ferait passer l'écran pour un formulaire alors qu'il s'agit de toucher cinq
 * étoiles.
 *
 * Le bouton de publication reste inactif tant qu'aucune étoile n'est touchée,
 * avec la raison écrite en dessous plutôt qu'un bouton grisé sans explication.
 */
export function ReviewSheet({
  visible,
  garageName,
  submitting,
  error,
  safeAreaBottom,
  onClose,
  onSubmit,
}: ReviewSheetProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
    >
      <View style={[styles.fill, { backgroundColor: theme.colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => {
            if (!submitting) onClose();
          }}
        />

        {visible ? (
          <SheetBody
            garageName={garageName}
            submitting={submitting}
            error={error}
            safeAreaBottom={safeAreaBottom}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function SheetBody({
  garageName,
  submitting,
  error,
  safeAreaBottom,
  onClose,
  onSubmit,
}: Omit<ReviewSheetProps, 'visible'>) {
  const theme = useTheme();
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const rise = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      rise.setValue(1);
      return;
    }

    Animated.timing(rise, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reducedMotion, rise]);

  const remaining = REVIEW_COMMENT_MAX - comment.length;
  const tight = comment.length >= REVIEW_COMMENT_MAX * COUNTER_WARN_AT;

  return (
    <Animated.View
      style={{
        maxHeight: windowHeight * 0.92,
        backgroundColor: theme.colors.background,
        borderTopLeftRadius: theme.radius.sheetLarge,
        borderTopRightRadius: theme.radius.sheetLarge,
        transform: [
          { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [64, 0] }) },
        ],
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flexShrink: 1 }}
        contentContainerStyle={{
          padding: theme.space.xl,
          paddingBottom: theme.space.lg,
          gap: theme.space.xl,
        }}
      >
        <View style={{ gap: theme.space.md }}>
          <SectionLabel>{t('review.label')}</SectionLabel>
          <Text variant="display">{t('review.title')}</Text>
          <Text variant="bodyStrong" tone="secondary" numberOfLines={2}>
            {garageName}
          </Text>
          <Text variant="small" tone="muted">
            {t('review.lead')}
          </Text>
        </View>

        <View style={{ gap: theme.space.md, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: theme.space.xs }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setRating(value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: rating === value }}
                accessibilityLabel={`${value} ${t(RATING_LABELS[value] as TranslationKey)}`}
                style={({ pressed }) => ({
                  width: MIN_TOUCH_TARGET + 8,
                  height: MIN_TOUCH_TARGET + 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                {/* Étoile pleine jusqu'à la note choisie, contour au-delà : on
                    lit sa note comme on lirait celle d'un garage, avec la même
                    forme et la même couleur. */}
                <Svg width={36} height={36} viewBox="0 0 24 24">
                  <Path
                    d={STAR_PATH}
                    fill={value <= rating ? theme.colors.warning : 'transparent'}
                    stroke={value <= rating ? theme.colors.warning : theme.colors.muted}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            ))}
          </View>

          {/* Hauteur réservée : sans elle, la première étoile touchée pousse
              tout le formulaire vers le bas d'une ligne. */}
          <View style={{ minHeight: 21, justifyContent: 'center' }}>
            <Text variant={rating > 0 ? 'bodyStrong' : 'small'} tone={rating > 0 ? 'ink' : 'muted'}>
              {rating > 0
                ? t(RATING_LABELS[rating] as TranslationKey)
                : t('review.ratingRequired')}
            </Text>
          </View>
        </View>

        <View style={{ gap: theme.space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <SectionLabel>{t('review.commentLabel')}</SectionLabel>
            <Text variant="caption" tone="muted">
              {t('review.commentOptional')}
            </Text>
            <View style={{ flex: 1 }} />
            {/* Le compteur décompte ce qui **reste**, pas ce qui est écrit :
                c'est la seule des deux valeurs sur laquelle on décide de
                couper une phrase. */}
            <Text variant="monoSmall" tone={tight ? 'primary' : 'muted'}>
              {remaining}
            </Text>
          </View>

          <TextInput
            allowFontScaling={false}
            value={comment}
            onChangeText={setComment}
            placeholder={t('review.commentPlaceholder')}
            placeholderTextColor={theme.colors.muted}
            multiline
            // Borné à la saisie, et pas seulement à l'envoi : découvrir la
            // limite en se faisant refuser un texte déjà écrit est le meilleur
            // moyen de ne jamais le réécrire.
            maxLength={REVIEW_COMMENT_MAX}
            textAlignVertical="top"
            accessibilityLabel={t('review.commentLabel')}
            style={{
              minHeight: 116,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.rule,
              // 2 px : le rayon que la charte réserve aux champs de saisie —
              // et jamais de chamfer sur un champ.
              borderRadius: theme.radius.field,
              padding: theme.space.md,
              fontFamily: theme.type.body.fontFamily,
              fontSize: theme.type.body.fontSize,
              color: theme.colors.ink,
            }}
          />
        </View>
      </ScrollView>

      <View
        style={{
          gap: theme.space.md,
          paddingHorizontal: theme.space.xl,
          paddingTop: theme.space.lg,
          paddingBottom: theme.space.xl + safeAreaBottom,
          borderTopWidth: 1,
          borderTopColor: theme.colors.rule,
        }}
      >
        {error ? (
          <View style={{ backgroundColor: theme.colors.primary, padding: theme.space.md }}>
            <Text variant="small" tone="inverse">
              {error}
            </Text>
          </View>
        ) : null}

        <Button
          label={t('review.publish')}
          fullWidth
          loading={submitting}
          disabled={rating === 0}
          onPress={() => onSubmit(rating, comment.trim() === '' ? null : comment.trim())}
        />
        <Button
          label={t('common.cancel')}
          variant="outline"
          fullWidth
          disabled={submitting}
          onPress={onClose}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
});
