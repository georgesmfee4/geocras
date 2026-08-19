import { View } from 'react-native';
import {
  nextJobAction,
  PROBLEM_LABELS,
  VEHICLE_LABELS,
  type Job,
  type JobAction,
} from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { BlinkingDot } from '../ui/BlinkingDot';
import { ChevronRightSmallIcon, ClockIcon, MapPinIcon } from '../ui/icons';
import { PlateTag } from '../ui/PlateTag';
import { PressableScale } from '../ui/PressableScale';
import { Text } from '../ui/Text';
import { waitStartedAt } from './queue';
import { urgencyColor } from './UrgencyTag';
import { WaitingClock } from './WaitingClock';

/**
 * Le verbe attendu du garagiste, selon l'état de la demande.
 *
 * La table traduit la machine à états du contrat partagé — `nextJobAction` —
 * en mots à la première personne : « Je pars », « Je suis arrivé ». C'est
 * délibérément la formulation des boutons de l'écran de détail, pour que la
 * ligne annonce **exactement** ce qu'on trouvera en l'ouvrant.
 */
const ACTION_LABELS: Record<JobAction, TranslationKey> = {
  accept: 'jobs.accept',
  en_route: 'jobs.enRoute',
  confirm_arrival: 'jobs.confirmArrival',
};

export type CommitmentRowProps = {
  job: Job;
  onPress: () => void;
};

/**
 * Une intervention déjà engagée.
 *
 * Ce n'est pas une ligne de liste de plus : c'est un **engagement pris**, et
 * l'ancienne version le rendait en une ligne maigre à chevron, moins lisible
 * qu'une entrée de réglages. Un garagiste qui a promis à trois personnes de
 * venir a besoin de savoir, sans ouvrir, laquelle il doit bouger maintenant.
 *
 * D'où la composition en deux étages, séparés par un filet :
 *
 *  - **au-dessus, l'identité** — la panne, la personne, sa plaque. C'est ce
 *    qu'on lit pour reconnaître le dossier ;
 *  - **au-dessous, la bande d'action** — l'attente qui court, la distance, et
 *    le verbe de ce qu'il reste à faire. C'est ce qu'on lit pour décider.
 *
 * La boîte n'a **pas de fond** : un trait d'un pixel sur le fond de page, et
 * rien d'autre. C'est ce qui la range d'un cran derrière le panneau SOS, seule
 * surface pleine de l'écran — la hiérarchie se lit dans la matière des blocs,
 * pas dans leur poids d'encre. Un filet intérieur sépare les deux étages ; il
 * remplace l'aplat qui remplissait la bande d'action, lequel faisait deux
 * rectangles empilés là où il n'y a qu'un dossier.
 */
export function CommitmentRow({ job, onPress }: CommitmentRowProps) {
  const theme = useTheme();
  const { t, locale, formatDistance } = useI18n();

  const problem = PROBLEM_LABELS[job.problemType][locale];
  const vehicle =
    job.vehicleLabel ?? job.client.vehicleLabel ?? VEHICLE_LABELS[job.vehicleType][locale];
  const action = nextJobAction(job);

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${problem}, ${job.client.fullName}. ${
        action ? t(ACTION_LABELS[action]) : t('jobs.awaitingClientShort')
      }`}
    >
      <View
        style={{
          flexDirection: 'row',
          minHeight: MIN_TOUCH_TARGET,
          borderWidth: 1,
          borderColor: theme.colors.rule,
        }}
      >
        {/* L'urgence trie la colonne avant qu'un mot ait été lu. Trois points
            et non quatre : c'est un repère, pas une barre de couleur. */}
        <View style={{ width: 3, backgroundColor: urgencyColor(job.urgency, theme.colors) }} />

        <View style={{ flex: 1 }}>
          <View style={{ padding: theme.space.md, gap: theme.space.xs }}>
            <Text variant="h2b" numberOfLines={1}>
              {problem}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              <Text variant="txt" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                {`${job.client.fullName} · ${vehicle}`}
              </Text>

              {/*
                La plaque n'est pas un ornement : c'est ce que le garagiste lit
                à cinquante mètres en arrivant sur place. Elle n'apparaît que
                si le client en a saisi une — un cadre vide vaudrait moins que
                rien, il ferait douter de celle qu'on cherche.
              */}
              {job.client.plate ? <PlateTag plate={job.client.plate} /> : null}
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
              paddingHorizontal: theme.space.md,
              paddingVertical: theme.space.sm,
              borderTopWidth: 1,
              borderTopColor: theme.colors.rule,
            }}
          >
            <ClockIcon color={theme.colors.inkSecondary} size={13} />
            <WaitingClock since={waitStartedAt(job)} variant="num" />

            <MapPinIcon color={theme.colors.inkSecondary} size={13} />
            <Text variant="num" tone="secondary">
              {formatDistance(job.distanceM)}
            </Text>

            <View style={{ flex: 1 }} />

            {action ? (
              <>
                <Text variant="btnSm" tone="primary" numberOfLines={1}>
                  {t(ACTION_LABELS[action])}
                </Text>
                <ChevronRightSmallIcon color={theme.colors.primary} size={15} />
              </>
            ) : (
              /*
                Le garage a confirmé son arrivée, le client pas encore : il n'y
                a rien à faire qu'attendre. Reproposer un verbe laisserait croire
                que la confirmation n'est pas passée — d'où la pastille qui bat,
                qui dit que quelque chose tourne encore, et pas un bouton de
                plus.
              */
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
                <BlinkingDot size={6} color={theme.colors.success} />
                <Text variant="btnSm" tone="secondary" numberOfLines={1}>
                  {t('jobs.awaitingClientShort')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}
