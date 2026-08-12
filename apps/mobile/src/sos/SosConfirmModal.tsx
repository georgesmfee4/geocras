import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { GarageSummary } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../ui/Button';
import { ChamferView } from '../ui/ChamferView';
import { GarageThumb } from '../ui/GarageThumb';
import { AlertIcon, CheckIcon, ShieldLockIcon } from '../ui/icons';
import { SectionLabel } from '../ui/SectionLabel';
import { Text } from '../ui/Text';
import { useReducedMotion } from '../ui/useReducedMotion';

export type SosConfirmModalProps = {
  /** Garage visé. `null` ferme la modale. */
  garage: GarageSummary | null;
  /** Panne déclarée, rappelée telle qu'elle apparaîtra au garage. */
  problemLabel: string | null;
  /** Numéro du client, montré masqué puis en clair. */
  clientPhone: string | null;
  submitting: boolean;
  error: string | null;
  safeAreaBottom: number;
  onCancel: () => void;
  onConfirm: (garage: GarageSummary) => void;
};

/**
 * Confirmation d'envoi du SOS.
 *
 * Deux choses à faire comprendre avant l'appui, et une seule chance de le
 * faire :
 *
 *  1. **c'est irréversible** — la demande s'attache à ce garage, en choisir un
 *     autre suppose de l'annuler ;
 *  2. **rien de personnel n'est encore transmis** — le garage voit la panne et
 *     le quartier, pas le numéro ni la position exacte, et c'est son
 *     acceptation qui déclenche le partage.
 *
 * Le second point est montré plutôt qu'expliqué : deux colonnes, « maintenant »
 * et « s'il accepte », séparées d'un filet, avec les mêmes deux lignes de part
 * et d'autre. Le numéro masqué à gauche et le même numéro en clair à droite
 * disent en un coup d'œil ce qu'un paragraphe met trois phrases à poser. C'est
 * la grammaire déjà employée pour les deux temps de trajet — deux cellules, un
 * filet — donc rien de nouveau à apprendre.
 */
export function SosConfirmModal({
  garage,
  problemLabel,
  clientPhone,
  submitting,
  error,
  safeAreaBottom,
  onCancel,
  onConfirm,
}: SosConfirmModalProps) {
  const theme = useTheme();
  const { t } = useI18n();

  /**
   * Dernier garage montré, gardé le temps de la fermeture.
   *
   * `Modal` met environ 150 ms à effacer son voile ; sans ce souvenir, le
   * contenu disparaît d'un coup à l'instant du refus et il ne reste qu'un voile
   * vide qui s'efface — on croit avoir cassé quelque chose.
   */
  const lastShown = useRef<GarageSummary | null>(null);
  if (garage) lastShown.current = garage;
  const rendered = garage ?? lastShown.current;

  return (
    <Modal
      visible={garage !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Le retour matériel d'Android doit annuler, jamais valider — mais il ne
      // doit pas non plus arracher l'écran pendant que la demande part.
      onRequestClose={() => {
        if (!submitting) onCancel();
      }}
    >
      <View style={[styles.fill, { backgroundColor: theme.colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => {
            if (!submitting) onCancel();
          }}
        />

        {rendered ? (
          <ConfirmSheet
            garage={rendered}
            problemLabel={problemLabel}
            clientPhone={clientPhone}
            submitting={submitting}
            error={error}
            safeAreaBottom={safeAreaBottom}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function ConfirmSheet({
  garage,
  problemLabel,
  clientPhone,
  submitting,
  error,
  safeAreaBottom,
  onCancel,
  onConfirm,
}: SosConfirmModalProps & { garage: GarageSummary }) {
  const theme = useTheme();
  const { t, formatDistance, formatDuration } = useI18n();
  const reducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  /**
   * Montée de la feuille.
   *
   * 260 ms : assez pour qu'on voie d'où elle vient — du bas, comme toutes les
   * feuilles de l'app — assez court pour ne pas retarder quelqu'un qui sait
   * déjà ce qu'il veut. Le voile, lui, est fondu par la `Modal` elle-même.
   */
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
      {/*
        Le contenu défile, les deux boutons **restent posés en bas**.

        Sans cette séparation, sur un écran court, l'action principale passe
        sous la ligne de flottaison : on demande alors de faire défiler une
        modale pour trouver le bouton qu'on est venu chercher. `flexShrink` est
        ce qui donne la priorité au pied de page quand la place manque.
      */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flexShrink: 1 }}
        contentContainerStyle={{
          padding: theme.space.xl,
          paddingBottom: theme.space.lg,
          gap: theme.space.xl,
        }}
      >
        <View style={{ gap: theme.space.md }}>
          <SectionLabel>{t('confirm.label')}</SectionLabel>
          <Text variant="display">{t('confirm.title')}</Text>
        </View>

        {/* Le garage visé, montré tel qu'il l'était dans la liste : même
            vignette, même rang, mêmes mesures. On confirme ce qu'on a choisi,
            pas une reformulation. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.md,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.rule,
            padding: theme.space.md,
          }}
        >
          <View>
            <GarageThumb uri={garage.photos[0]} name={garage.name} size={56} />
            <ChamferView
              fill={theme.colors.ink}
              style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20 }}
              contentStyle={{
                width: 20,
                height: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="monoStrong" tone="inverse" style={{ fontSize: 10, lineHeight: 13 }}>
                {garage.rank}
              </Text>
            </ChamferView>
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {garage.name}
            </Text>
            <Text variant="mono" tone="secondary" numberOfLines={1}>
              {formatDistance(garage.distanceM)} · {formatDuration(garage.etaMin)}
            </Text>
          </View>

          {garage.certified ? (
            <View
              style={{
                backgroundColor: theme.colors.primary,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text variant="sectionLabel" tone="inverse">
                ✓ {t('garage.certified')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ gap: theme.space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <ShieldLockIcon color={theme.colors.ink} size={18} />
            <Text variant="heading" style={{ flex: 1 }}>
              {t('confirm.privacy')}
            </Text>
          </View>

          <Text variant="small" tone="secondary">
            {t('confirm.privacyLead')}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.rule,
            }}
          >
            <VisibilityCell
              title={t('confirm.now')}
              icon={<ShieldLockIcon color={theme.colors.muted} size={15} />}
              phone={maskPhone(clientPhone)}
              phoneTone="muted"
              position={t('confirm.positionHidden')}
              positionTone="muted"
            />
            <View style={{ width: 1, backgroundColor: theme.colors.rule }} />
            <VisibilityCell
              title={t('confirm.afterAccept')}
              icon={<CheckIcon color={theme.colors.success} size={15} />}
              phone={formatPhone(clientPhone)}
              phoneTone="ink"
              position={t('confirm.positionShared')}
              positionTone="ink"
            />
          </View>

          {problemLabel ? (
            <Text variant="small" tone="muted" numberOfLines={1}>
              {t('results.forProblem')} {problemLabel}
            </Text>
          ) : null}
        </View>

        {/*
          L'irréversibilité, en teinte primaire et non en rouge plein : c'est un
          avertissement à lire, pas un bouton à toucher. Un aplat rouge ici
          entrerait en concurrence avec l'action juste en dessous.
        */}
        <View style={{ flexDirection: 'row', backgroundColor: theme.colors.primaryTint }}>
          <View style={{ width: 3, backgroundColor: theme.colors.primary }} />
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              gap: theme.space.md,
              padding: theme.space.md,
            }}
          >
            <AlertIcon color={theme.colors.primary} size={18} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="bodyStrong" tone="primary">
                {t('confirm.irreversible')}
              </Text>
              <Text variant="small" tone="secondary">
                {t('confirm.irreversibleLead')}
              </Text>
            </View>
          </View>
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
        {/* L'erreur est dans le pied de page et non dans le contenu : c'est le
            seul endroit d'où elle ne peut pas défiler hors de l'écran, et un
            envoi refusé qu'on ne voit pas se termine en second appui. */}
        {error ? (
          <View style={{ backgroundColor: theme.colors.primary, padding: theme.space.md }}>
            <Text variant="small" tone="inverse">
              {error}
            </Text>
          </View>
        ) : null}

        <Button
          label={t('confirm.send')}
          fullWidth
          loading={submitting}
          onPress={() => onConfirm(garage)}
        />
        <Button
          label={t('confirm.keepComparing')}
          variant="outline"
          fullWidth
          disabled={submitting}
          onPress={onCancel}
        />
      </View>
    </Animated.View>
  );
}

/**
 * Une colonne de l'avant/après.
 *
 * Les deux cellules portent **les mêmes intitulés** dans le même ordre : c'est
 * la comparaison ligne à ligne qui fait le sens, et décaler d'un intitulé
 * suffirait à la casser.
 */
function VisibilityCell({
  title,
  icon,
  phone,
  phoneTone,
  position,
  positionTone,
}: {
  title: string;
  icon: React.ReactNode;
  phone: string;
  phoneTone: 'muted' | 'ink';
  position: string;
  positionTone: 'muted' | 'ink';
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={{ flex: 1, padding: theme.space.md, gap: theme.space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text
          variant="sectionLabel"
          numberOfLines={1}
          style={{ color: theme.colors.sectionLabel, flexShrink: 1 }}
        >
          {title}
        </Text>
      </View>

      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="muted">
          {t('confirm.phone')}
        </Text>
        <Text variant="mono" tone={phoneTone} numberOfLines={1}>
          {phone}
        </Text>
      </View>

      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="muted">
          {t('confirm.position')}
        </Text>
        <Text
          variant={positionTone === 'ink' ? 'bodyStrong' : 'body'}
          tone={positionTone === 'ink' ? 'ink' : 'muted'}
          numberOfLines={1}
        >
          {position}
        </Text>
      </View>
    </View>
  );
}

/**
 * Numéro masqué.
 *
 * On garde l'indicatif et le premier chiffre — de quoi reconnaître son propre
 * numéro — et on remplace le reste par des points. Le gabarit est conservé
 * groupe par groupe : masquer en une seule bouillie de points ne dirait pas
 * qu'il s'agit du même numéro que celui d'à côté.
 */
export function maskPhone(phone: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const national = digits.startsWith('237') ? digits.slice(3) : digits;
  const first = national.charAt(0) || '•';
  return `+237 ${first}•• •• •• ••`;
}

/** Le même numéro, en clair, groupé comme on l'écrit au Cameroun. */
export function formatPhone(phone: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const national = digits.startsWith('237') ? digits.slice(3) : digits;
  if (national.length !== 9) return phone ?? '+237 ••• •• •• ••';

  return `+237 ${national.slice(0, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7, 9)}`;
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
});
