import { View } from 'react-native';
import type { RequestStatus } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { CheckIcon } from '../ui/icons';
import { Text } from '../ui/Text';

/** Diamètre d'un jalon. */
const NODE = 18;

export type TrackingProgressProps = {
  status: RequestStatus;
  /** Le client a déjà confirmé l'arrivée de son côté. */
  clientArrived: boolean;
};

/**
 * Où en est l'intervention, en trois jalons.
 *
 * Trois et pas sept : les sept états de la machine décrivent un cycle de vie
 * pour le serveur, pas une attente pour quelqu'un assis dans une voiture en
 * panne. `awaiting_confirmation` et `closed` sont le même jalon vu du client —
 * le dépanneur est là.
 *
 * Le repère est **posé sur un rail horizontal** plutôt qu'en liste verticale :
 * il vit dans un panneau qui doit laisser la place à la carte, et un rail se
 * lit d'un coup d'œil sans occuper trois lignes.
 *
 * Le jalon franchi porte une coche, jamais une couleur seule : sous le soleil,
 * un point vert et un point gris se ressemblent, une coche non.
 */
export function TrackingProgress({ status, clientArrived }: TrackingProgressProps) {
  const theme = useTheme();
  const { t } = useI18n();

  const reached = stepOf(status);

  const steps = [
    { key: 'accepted', label: t('live.stepAccepted') },
    { key: 'enRoute', label: t('live.stepEnRoute') },
    { key: 'arrived', label: clientArrived ? t('live.stepConfirmed') : t('live.stepArrived') },
  ];

  return (
    <View style={{ flexDirection: 'row' }}>
      {steps.map((step, index) => {
        const done = index <= reached;
        const active = index === reached;

        return (
          <View key={step.key} style={{ flex: 1, gap: theme.space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: NODE,
                  height: NODE,
                  borderRadius: NODE / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? theme.colors.primary : 'transparent',
                  borderWidth: done ? 0 : 1.5,
                  borderColor: 'rgba(255,255,255,0.35)',
                }}
              >
                {done ? <CheckIcon color={theme.colors.surface} size={10} /> : null}
              </View>

              {/* Pas de rail après le dernier jalon : un trait qui pend au bord
                  du panneau se lit comme une étape manquante. */}
              {index < steps.length - 1 ? (
                <View
                  style={{
                    flex: 1,
                    height: 1.5,
                    backgroundColor:
                      index < reached ? theme.colors.primary : 'rgba(255,255,255,0.22)',
                  }}
                />
              ) : null}
            </View>

            <Text
              variant="lblb"
              numberOfLines={2}
              style={{
                color: active ? theme.colors.surface : 'rgba(255,255,255,0.5)',
                paddingRight: theme.space.sm,
              }}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Index du dernier jalon atteint. */
function stepOf(status: RequestStatus): number {
  switch (status) {
    case 'accepted':
      return 0;
    case 'en_route':
      return 1;
    case 'awaiting_confirmation':
    case 'closed':
      return 2;
    default:
      return 0;
  }
}
