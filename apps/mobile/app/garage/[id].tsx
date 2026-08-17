import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SERVICE_LABELS, type Service } from '@geocras/shared';
import {
  useGarageDetail,
  useGarageReviewPages,
  usePublishReview,
  useReviewEligibility,
} from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { OpeningHoursTable, StatStrip } from '../../src/garage/GarageStats';
import { PhotoCarousel } from '../../src/garage/PhotoCarousel';
import { ReviewCard } from '../../src/garage/ReviewCard';
import { ReviewSheet } from '../../src/garage/ReviewSheet';
import { RoutePreview } from '../../src/garage/RoutePreview';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useCoordinates } from '../../src/location/LocationProvider';
import { useStableOrigin } from '../../src/location/useStableOrigin';
import { ActiveRequestSearch } from '../../src/sos/ActiveRequestSearch';
import { useSosEntry } from '../../src/sos/useSosEntry';
import { useTheme } from '../../src/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { CheckIcon, ChevronLeftIcon, StarIcon } from '../../src/ui/icons';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Skeleton } from '../../src/ui/Skeleton';
import { Stars } from '../../src/ui/Stars';
import { Text } from '../../src/ui/Text';

/**
 * Fiche d'un garage.
 *
 * **Aucun moyen de contacter le garage depuis cet écran** — ni numéro, ni
 * bouton d'appel — alors que la fiche serveur porte bien un téléphone. C'est
 * une règle de produit, pas un oubli : un garagiste appelé directement ne sait
 * ni quel véhicule vient, ni quelle panne, ni où ; il n'a aucune trace de
 * l'intervention, et le client aucun recours. Le contact passe donc par une
 * demande d'assistance, qui porte tout ça et laisse une trace des deux côtés.
 *
 * L'écran répond dans l'ordre aux questions qu'on se pose devant un garage
 * inconnu : à quoi ressemble-t-il, qui est-il, est-il ouvert, où est-il, que
 * sait-il faire, quand travaille-t-il, et enfin ce qu'en disent les autres.
 */
export default function GarageDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale, formatNumber, formatDistance, translateError } = useI18n();
  /**
   * `review=1` arrive de l'historique : on y propose « Noter ce garage » sur
   * une intervention terminée, et le geste doit aboutir à la feuille de note,
   * pas à une fiche où il faut retrouver le bouton soi-même.
   */
  const { id, review } = useLocalSearchParams<{ id: string; review?: string }>();

  const { status: authStatus } = useAuth();
  const sosEntry = useSosEntry();

  /**
   * La distance vient du serveur, calculée depuis le point qu'on lui envoie.
   *
   * Ancrée plutôt que brute : sans ancrage, le tremblement du GPS relancerait
   * la requête toutes les quelques secondes pour un chiffre qui ne bouge pas.
   */
  const origin = useCoordinates();
  const anchored = useStableOrigin(origin);

  const detail = useGarageDetail(id ?? null, anchored ?? undefined);
  const reviews = useGarageReviewPages(id ?? null);

  // Route authentifiée : on ne la sollicite pas pour un invité, qui n'a de
  // toute façon aucune intervention à son nom.
  const eligibility = useReviewEligibility(id ?? null, authStatus === 'authenticated');
  const publish = usePublishReview(eligibility.data?.requestId ?? '', id ?? '');

  /** Feuille de notation ouverte. */
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  /**
   * Ouverture différée de la feuille, une seule fois.
   *
   * Le droit de noter vient du serveur : à l'arrivée sur l'écran, `eligibility`
   * n'a pas encore répondu et ouvrir tout de suite donnerait une feuille qui se
   * refuse une seconde plus tard. Le garde-fou empêche aussi la réouverture
   * après une fermeture volontaire, tant que le paramètre reste dans l'URL.
   */
  const autoReviewDone = useRef(false);

  const garage = detail.data ?? null;
  const pages = reviews.data?.pages ?? [];
  const allReviews = pages.flatMap((page) => page.results);

  const canReview = eligibility.data?.canReview === true;

  /**
   * Pourquoi la notation est fermée, dit en toutes lettres.
   *
   * Un bouton grisé sans explication laisse croire à une panne. Ici la raison
   * est toujours une règle du produit — il faut une intervention terminée avec
   * ce garage — et elle se dit en une ligne.
   */
  const blockedReason =
    authStatus !== 'authenticated'
      ? t('review.needsAccount')
      : eligibility.data?.reason === 'already_reviewed'
        ? t('review.alreadyDone')
        : eligibility.data?.reason === 'no_closed_request'
          ? t('review.needsClosed')
          : null;

  useEffect(() => {
    if (review !== '1' || autoReviewDone.current) return;
    if (eligibility.data?.canReview !== true) return;
    autoReviewDone.current = true;
    setReviewing(true);
  }, [review, eligibility.data?.canReview]);

  const submitReview = useCallback(
    async (stars: number, comment: string | null) => {
      if (!eligibility.data?.requestId) return;
      setReviewError(null);

      try {
        await publish.mutateAsync({ rating: stars, comment });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setReviewing(false);
      } catch (cause) {
        setReviewError(translateError(cause));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [publish, translateError, eligibility.data?.requestId],
  );

  if (detail.isLoading && !garage) return <DetailSkeleton />;

  if (!garage) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.space.xl,
          gap: theme.space.lg,
        }}
      >
        <Text variant="heading" style={{ textAlign: 'center' }}>
          {detail.isError ? translateError(detail.error) : t('garage.notFound')}
        </Text>
        <Button label={t('common.retry')} variant="outline" onPress={() => void detail.refetch()} />
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={10}>
          <Text variant="btn" tone="primary">
            {t('sos.back')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.space.xxxl }}
      >
        <PhotoCarousel photos={garage.photos} name={garage.name} />

        {/*
          Le panneau remonte sur la photo de vingt pixels, coins hauts arrondis :
          c'est ce chevauchement qui fait tenir les deux blocs ensemble. Sans
          lui, la fiche ressemble à une image posée au-dessus d'un formulaire.
        */}
        <View
          style={{
            marginTop: -theme.radius.sheet,
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.sheet,
            borderTopRightRadius: theme.radius.sheet,
            paddingHorizontal: theme.space.lg,
            paddingTop: theme.space.xl,
            gap: theme.space.xl,
          }}
        >
          <View style={{ gap: theme.space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.md }}>
              <Text variant="h1b" style={{ flex: 1 }}>
                {garage.name}
              </Text>

              {garage.certified ? (
                <View
                  style={{
                    backgroundColor: theme.colors.primary,
                    paddingHorizontal: theme.space.sm,
                    paddingVertical: 3,
                    marginTop: 2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                {/*
                  Le ✓ était un glyphe littéral. Bebas ne le contient pas — sa
                  table de caractères s'arrête aux lettres, chiffres et
                  ponctuation — et il serait tombé en tofu. Une icône vectorielle
                  plutôt qu'un repli de police : c'est ce que demande le cahier
                  des charges pour les pictogrammes.
                */}
                  <CheckIcon color={theme.colors.surface} size={11} />
                  <Text variant="lblb" tone="inverse">
                    {t('garage.certified')}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              <Stars value={garage.rating} size={14} />
              <Text variant="mono" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                {formatNumber(garage.rating)} · {garage.reviewCount}{' '}
                {t(garage.reviewCount === 1 ? 'garage.reviewOne' : 'garage.reviewMany')}
                {anchored ? ` · ${formatDistance(garage.distanceM)}` : ''}
              </Text>
            </View>
          </View>

          <StatStrip
            openNow={garage.openNow}
            openingHours={garage.openingHours}
            yearsInBusiness={garage.yearsInBusiness}
            towing={garage.services.includes('towing')}
          />

          {garage.description ? (
            <View style={{ gap: theme.space.md }}>
              <SectionLabel>{t('garage.about')}</SectionLabel>
              <Text variant="txt">{garage.description}</Text>
            </View>
          ) : null}

          <View style={{ gap: theme.space.md }}>
            <SectionLabel>{t('garage.route')}</SectionLabel>
            <RoutePreview garage={garage} origin={anchored} />
          </View>

          {garage.services.length > 0 ? (
            <View style={{ gap: theme.space.md }}>
              <SectionLabel>{t('garage.services')}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
                {garage.services.map((service) => (
                  <ServiceTag key={service} service={service} locale={locale} />
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ gap: theme.space.md }}>
            <SectionLabel>{t('garage.hours')}</SectionLabel>
            <OpeningHoursTable hours={garage.openingHours} />
          </View>

          <View style={{ gap: theme.space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
              <SectionLabel>{t('garage.reviews')}</SectionLabel>
              <View style={{ flex: 1 }} />
              <Text variant="num" tone="secondary">
                {garage.reviewCount}
              </Text>
            </View>

            {allReviews.length === 0 && !reviews.isLoading ? (
              <Text variant="txt" tone="muted">
                {t('garage.reviewsEmpty')}
              </Text>
            ) : null}

            {allReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}

            {reviews.isLoading ? <Skeleton width="100%" height={96} /> : null}

            {reviews.hasNextPage ? (
              <Button
                label={t('garage.reviewsAll')}
                variant="outline"
                fullWidth
                loading={reviews.isFetchingNextPage}
                onPress={() => void reviews.fetchNextPage()}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/*
        Retour posé sur la photo : voile encre translucide, jamais un rond blanc
        — sur une photo d'atelier claire, un bouton blanc disparaît.
      */}
      <SafeAreaView edges={['top']} style={styles.backLayer} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('sos.back')}
          hitSlop={8}
          style={({ pressed }) => ({
            marginLeft: theme.space.lg,
            marginTop: theme.space.sm,
            width: MIN_TOUCH_TARGET,
            height: MIN_TOUCH_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.overlay,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <ChevronLeftIcon color={theme.colors.surface} />
        </Pressable>
      </SafeAreaView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.colors.rule,
          backgroundColor: theme.colors.background,
          paddingHorizontal: theme.space.lg,
          paddingTop: theme.space.md,
          paddingBottom: theme.space.md + insets.bottom,
          gap: theme.space.sm,
        }}
      >
        {blockedReason ? (
          <Text variant="caption" tone="muted">
            {blockedReason}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: theme.space.md }}>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              setReviewError(null);
              setReviewing(true);
            }}
            disabled={!canReview}
            accessibilityRole="button"
            accessibilityLabel={t('garage.rate')}
            accessibilityState={{ disabled: !canReview }}
            style={({ pressed }) => ({
              width: 60,
              minHeight: MIN_TOUCH_TARGET + 4,
              borderWidth: 1.5,
              borderColor: canReview ? theme.colors.ink : theme.colors.rule,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !canReview ? 0.5 : pressed ? 0.7 : 1,
            })}
          >
            <StarIcon color={canReview ? theme.colors.warning : theme.colors.muted} size={22} />
          </Pressable>

          {/*
            La seule voie vers ce garage. Elle passe par le parcours SOS, qui
            décrit le véhicule et la panne avant d'engager qui que ce soit.
          */}
          <Button
            label={t('garage.requestAssistance')}
            fullWidth
            style={{ flex: 1 }}
            onPress={() => sosEntry.start(garage.id)}
          />
        </View>
      </View>

      <ActiveRequestSearch visible={sosEntry.checking} />

      <ReviewSheet
        visible={reviewing}
        garageName={garage.name}
        submitting={publish.isPending}
        error={reviewError}
        safeAreaBottom={insets.bottom}
        onClose={() => {
          setReviewing(false);
          setReviewError(null);
        }}
        onSubmit={(stars, comment) => void submitReview(stars, comment)}
      />
    </View>
  );
}

/** Compétence du garage : une étiquette, pas un bouton — il n'y a rien à filtrer ici. */
function ServiceTag({ service, locale }: { service: Service; locale: 'fr' | 'en' }) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        borderRadius: theme.radius.chip,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm,
      }}
    >
      <Text variant="btnSm" tone="secondary">
        {SERVICE_LABELS[service][locale]}
      </Text>
    </View>
  );
}

/**
 * Attente de la fiche.
 *
 * Elle reprend la **silhouette** de l'écran final — bandeau, titre, bandeau de
 * statistiques — plutôt qu'un indicateur centré : le contenu se pose alors à sa
 * place au lieu de la faire apparaître d'un coup.
 */
function DetailSkeleton() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Skeleton width="100%" height={216} />

      <View style={{ padding: theme.space.lg, gap: theme.space.lg }}>
        <Skeleton width="72%" height={26} />
        <Skeleton width="54%" height={16} />
        <Skeleton width="100%" height={64} />
        <Skeleton width="100%" height={72} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
});
