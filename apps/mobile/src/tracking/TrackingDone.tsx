import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RequestDetail } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../ui/Button';
import { CheckIcon } from '../ui/icons';
import { SectionLabel } from '../ui/SectionLabel';
import { Text } from '../ui/Text';

export type TrackingDoneProps = {
  detail: RequestDetail | null;
  onRate: (() => void) | null;
  onClose: () => void;
};

/**
 * L'intervention est terminée.
 *
 * L'écran existe parce que la clôture arrivait jusqu'ici **sans rien dire** :
 * les deux confirmations tombaient, le statut passait à `closed`, et le suivi
 * continuait d'afficher un dépanneur en route vers quelqu'un qu'il avait déjà
 * dépanné. Le client ne savait pas que c'était fini, ni que des points venaient
 * d'être crédités.
 *
 * Trois choses, dans cet ordre : **c'est terminé**, **combien de temps ça a
 * pris**, **il reste une chose à faire**. La note vient en dernier et n'est pas
 * imposée — mais elle est proposée ici plutôt que reléguée à l'historique,
 * parce que c'est maintenant qu'on a un avis, pas dans trois jours.
 */
export function TrackingDone({ detail, onRate, onClose }: TrackingDoneProps) {
  const theme = useTheme();
  const { t, formatDuration } = useI18n();

  /**
   * Durée réelle, comptée depuis le **choix du garage** et non depuis
   * l'ouverture du formulaire : entre les deux, le client compare les
   * propositions, et ces minutes-là ne sont pas du dépannage.
   */
  const minutes =
    detail?.closedAt && (detail.selectedAt ?? detail.createdAt)
      ? Math.max(
          1,
          Math.round(
            (Date.parse(detail.closedAt) - Date.parse(detail.selectedAt ?? detail.createdAt)) /
              60_000,
          ),
        )
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: theme.space.xl,
          gap: theme.space.xl,
          justifyContent: 'center',
        }}
      >
        <View style={{ alignItems: 'center', gap: theme.space.md }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.colors.success,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckIcon color={theme.colors.surface} size={26} />
          </View>

          <Text variant="d1b" style={{ textAlign: 'center' }}>
            {t('live.doneTitle')}
          </Text>
          <Text variant="txt" tone="secondary" style={{ textAlign: 'center' }}>
            {t('live.doneLead')}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.rule,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.success,
            padding: theme.space.lg,
            gap: theme.space.sm,
          }}
        >
          <SectionLabel>{t('live.doneSummary')}</SectionLabel>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <Text variant="h2b" numberOfLines={1} style={{ flex: 1 }}>
              {detail?.garage?.name ?? '—'}
            </Text>
            {/* Mono : c'est une durée mesurée, pas un mot. */}
            <Text variant="num">{minutes === null ? '—' : formatDuration(minutes)}</Text>
          </View>
        </View>

        <View style={{ gap: theme.space.md }}>
          {onRate ? (
            <Button label={t('live.rate')} fullWidth onPress={onRate} />
          ) : null}
          <Button label={t('live.backToMap')} variant="outline" fullWidth onPress={onClose} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
