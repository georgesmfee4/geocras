import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PROBLEM_LABELS, type Job } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../ui/Button';
import { CheckIcon } from '../ui/icons';
import { SectionLabel } from '../ui/SectionLabel';
import { Text } from '../ui/Text';

export type JobDoneProps = {
  /** La demande telle qu'on l'a vue juste avant la clôture. */
  job: Job | null;
  onClose: () => void;
};

/**
 * L'intervention est terminée — **vue du garagiste**.
 *
 * L'écran corrige un défaut qui faisait passer une réussite pour une panne.
 *
 * La file de travail ne contient que les demandes vivantes : `closed` en est
 * exclu, à raison — une intervention terminée relève de l'historique. Mais les
 * deux écrans du garagiste lisent **uniquement** cette file. Au moment précis
 * où il confirmait son arrivée après le client, les deux confirmations se
 * réunissaient, la demande passait à `closed`, sortait de la file… et l'écran,
 * ne la trouvant plus, annonçait « cette demande n'est plus dans votre file, le
 * client l'a peut-être annulée ».
 *
 * Autrement dit : le geste réussissait, et l'application accusait le client de
 * l'avoir annulé. C'est le pire message possible — il est faux, il est
 * inquiétant, et il arrive juste après un travail accompli.
 *
 * ---
 *
 * **Ce qu'on affirme ici, on le sait.** L'écran n'est montré que lorsque le
 * serveur a répondu `closed` à notre propre confirmation : c'est la seule source
 * certaine. Une disparition de la file pour toute autre raison continue de
 * mener au message d'absence — reformulé, lui, pour ne plus désigner un
 * coupable qu'on ne connaît pas.
 */
export function JobDone({ job, onClose }: JobDoneProps) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: theme.space.xl,
          gap: theme.space.xl,
          justifyContent: 'center',
        }}
      >
        <View style={{ alignItems: 'center', gap: theme.space.md }}>
          {/*
            Vert et non rouge, comme du côté client : le rouge appartient au SOS
            et aux échecs. Une intervention menée à son terme est exactement le
            contraire des deux.
          */}
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
            <CheckIcon color={theme.colors.onFill} size={26} />
          </View>

          <Text variant="d1b" style={{ textAlign: 'center' }}>
            {t('jobs.doneTitle')}
          </Text>
          <Text variant="txt" tone="secondary" style={{ textAlign: 'center' }}>
            {t('jobs.doneLead')}
          </Text>
        </View>

        {/*
          De quel dossier il s'agissait.

          On la tient de la file **avant** qu'elle n'en sorte : sans ce rappel,
          un garagiste qui enchaîne trois interventions ne sait pas laquelle
          vient de se clore.
        */}
        {job ? (
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
            <SectionLabel>{t('jobs.doneSummary')}</SectionLabel>

            <Text variant="h2b" numberOfLines={1}>
              {PROBLEM_LABELS[job.problemType][locale]}
            </Text>
            <Text variant="txt" tone="secondary" numberOfLines={1}>
              {job.client.fullName}
            </Text>
          </View>
        ) : null}

        <Button label={t('jobs.backToDesk')} fullWidth onPress={onClose} />
      </ScrollView>
    </SafeAreaView>
  );
}
