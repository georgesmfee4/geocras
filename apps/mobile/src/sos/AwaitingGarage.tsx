import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RequestDetail } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import type { ConnectionState } from '../stores/tracking';
import { elapsedSecondsSince, formatElapsed, serverNow } from '../time/clock';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { BlinkingDot } from '../ui/BlinkingDot';
import { Button } from '../ui/Button';
import { ChamferView } from '../ui/ChamferView';
import { GarageThumb } from '../ui/GarageThumb';
import { CheckIcon, ShieldLockIcon } from '../ui/icons';
import { SectionLabel } from '../ui/SectionLabel';
import { Text } from '../ui/Text';
import { useReducedMotion } from '../ui/useReducedMotion';
import { WaitingRadar } from './WaitingRadar';

export type AwaitingGarageProps = {
  /** Garage retenu. `null` seulement le temps du premier chargement. */
  garage: RequestDetail['garage'];
  /**
   * Instant où **ce garage a été prévenu**, en ISO — l'origine du compteur.
   *
   * Jamais `createdAt` : entre l'ouverture de la demande et le choix du
   * garage, le client compare les propositions, et ces minutes-là ne sont pas
   * de l'attente. Les compter faisait démarrer le compteur à vingt minutes sur
   * un garage prévenu à la seconde.
   *
   * `null` quand l'instant est réellement inconnu — une demande retenue avant
   * la migration `0004`, rouverte depuis un autre appareil. On affiche alors un
   * tiret : un compteur qui part de la mauvaise origine est pire qu'un
   * compteur absent, puisque rien ne signale qu'il ment.
   */
  sentAt: string | null;
  connection: ConnectionState;
  cancelling: boolean;
  onCancel: () => void;
  onCallSupport: () => void;
};

/**
 * Attente de la réponse du garage.
 *
 * L'état `selected` est le seul du cycle de vie où **rien ne bouge côté
 * utilisateur** : la demande est partie, le garage ne l'a pas encore acceptée,
 * et il n'y a ni trajet à tracer ni ETA à afficher. Un écran de suivi vide
 * pendant ce temps-là se lit comme une demande perdue — d'où un écran à part
 * entière, dont le seul travail est de rendre l'attente lisible.
 *
 * Trois choses, dans cet ordre : ce qui se passe (le radar et le titre), où en
 * est la demande (la chronologie), et ce qu'on peut encore faire (appeler
 * l'assistance, annuler). Le rappel de confidentialité vient juste avant les
 * actions : c'est la réponse à la question qu'on se pose en attendant — « à
 * qui ai-je donné quoi ? ».
 */
export function AwaitingGarage({
  garage,
  sentAt,
  connection,
  cancelling,
  onCancel,
  onCallSupport,
}: AwaitingGarageProps) {
  const theme = useTheme();
  const { t, formatDistance, formatDuration, formatTime } = useI18n();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.md,
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.md,
            paddingBottom: theme.space.sm,
          }}
        >
          <SectionLabel>{t('awaiting.label')}</SectionLabel>
          <View style={{ flex: 1 }} />

          {/*
            L'état de la liaison, et seulement quand il s'écarte du nominal.
            Un bandeau « connexion vivante » permanent serait du bruit ; sa
            perte, elle, explique pourquoi la réponse peut tarder à s'afficher.
          */}
          {connection !== 'live' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.sm,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.rule,
                paddingHorizontal: theme.space.sm,
                paddingVertical: 4,
              }}
            >
              <BlinkingDot size={7} color={theme.colors.warning} />
              <Text variant="caption" tone="secondary">
                {t('tracking.degraded')}
              </Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: theme.space.xxl + insets.bottom,
          gap: theme.space.xl,
        }}
      >
        <View style={{ alignItems: 'center', gap: theme.space.lg, paddingTop: theme.space.sm }}>
          <WaitingRadar certified={garage?.certified ?? false} animated={!reducedMotion} />

          <View style={{ alignItems: 'center', gap: theme.space.sm }}>
            <Text variant="display" style={{ textAlign: 'center' }}>
              {t('awaiting.title')}
            </Text>
            <Text variant="txt" tone="secondary" style={{ textAlign: 'center' }}>
              {t('awaiting.lead')}
            </Text>
          </View>
        </View>

        {garage ? (
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
            <GarageThumb uri={garage.photos[0]} name={garage.name} size={52} />

            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h2" numberOfLines={1}>
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
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {/* Bebas ne contient pas ✓ : icône vectorielle plutôt que tofu. */}
                <CheckIcon color={theme.colors.surface} size={11} />
                <Text variant="lblb" tone="inverse">
                  {t('garage.certified')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: theme.space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
            <SectionLabel>{t('awaiting.waitingFor')}</SectionLabel>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.rule }} />
            <ElapsedClock since={sentAt} />
          </View>

          <View>
            <Step
              state="done"
              label={t('awaiting.step1')}
              {...(sentAt ? { detail: formatTime(sentAt) } : {})}
            />
            <Step state="current" label={t('awaiting.step2')} detail={t('awaiting.pending')} />
            <Step state="pending" label={t('awaiting.step3')} last />
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: theme.space.md,
            backgroundColor: theme.colors.primaryTint,
            padding: theme.space.md,
          }}
        >
          <ShieldLockIcon color={theme.colors.primary} size={18} />
          <Text variant="txt" tone="secondary" style={{ flex: 1 }}>
            {t('awaiting.masked')}
          </Text>
        </View>

        <View style={{ gap: theme.space.md }}>
          <Text variant="txt" tone="muted" style={{ textAlign: 'center' }}>
            {t('awaiting.noAnswer')}
          </Text>

          <Button label={t('results.callSupport')} variant="outline" fullWidth onPress={onCallSupport} />

          {/*
            L'abandon reste un simple libellé : il doit être atteignable — une
            demande `pending` ou `selected` bloque toute nouvelle création —
            sans jamais rivaliser avec l'attente elle-même, qui est l'issue
            normale de cet écran.
          */}
          <Pressable
            onPress={onCancel}
            disabled={cancelling}
            accessibilityRole="button"
            accessibilityLabel={t('results.cancelRequest')}
            accessibilityState={{ disabled: cancelling }}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH_TARGET,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: cancelling ? 0.5 : pressed ? 0.6 : 1,
            })}
          >
            <Text variant="h2" tone="primary">
              {t('results.cancelRequest')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Chronologie de la demande.
 *
 * Trois étapes, jamais plus : c'est ce que le client peut constater lui-même.
 * Les transitions internes du serveur n'ont rien à faire ici.
 */
function Step({
  state,
  label,
  detail,
  last = false,
}: {
  state: 'done' | 'current' | 'pending';
  label: string;
  detail?: string;
  last?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.md }}>
      <View style={{ width: 18, alignItems: 'center' }}>
        {state === 'done' ? (
          <ChamferView
            fill={theme.colors.primary}
            style={{ width: 18, height: 18 }}
            contentStyle={{
              width: 18,
              height: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckIcon color={theme.colors.surface} size={11} />
          </ChamferView>
        ) : state === 'current' ? (
          <View style={{ height: 18, justifyContent: 'center' }}>
            <BlinkingDot size={10} color={theme.colors.primary} />
          </View>
        ) : (
          <View
            style={{
              width: 10,
              height: 10,
              marginTop: 4,
              borderWidth: 1.5,
              borderColor: theme.colors.rule,
            }}
          />
        )}

        {/* Le filet qui relie deux étapes : sans lui, trois pastilles alignées
            ne racontent pas une progression. */}
        {!last ? (
          <View
            style={{ flex: 1, width: 1, backgroundColor: theme.colors.rule, marginTop: 4 }}
          />
        ) : null}
      </View>

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          paddingBottom: last ? 0 : theme.space.lg,
        }}
      >
        <Text
          variant={state === 'pending' ? 'body' : 'bodyStrong'}
          tone={state === 'pending' ? 'muted' : 'ink'}
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {label}
        </Text>

        {detail ? (
          <Text variant="numSm" tone={state === 'current' ? 'primary' : 'muted'}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Compteur d'attente.
 *
 * Isolé dans son propre composant parce qu'il se re-rend chaque seconde : posé
 * dans l'écran, il ferait repartir le radar et toute la chronologie à chaque
 * battement.
 *
 * Il compte dans le **temps du serveur** et non celui de l'appareil. La
 * différence n'est pas théorique : sur un téléphone dont l'horloge dérive de
 * trois minutes — courant sans synchronisation réseau, systématique sur un
 * émulateur — le compteur démarrait à `03:00` sur une demande partie à
 * l'instant. Voir `src/time/clock.ts`.
 */
function ElapsedClock({ since }: { since: string | null }) {
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(timer);
  }, [since]);

  const seconds = since === null ? null : elapsedSecondsSince(since, now);

  return <Text variant="num">{seconds === null ? '—' : formatElapsed(seconds)}</Text>;
}
