import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SERVICE_LABELS } from '@geocras/shared';
import { useDeleteMyGarage, useMyGarage, useSetGarageActive } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { formatOpeningRange, WEEK_DAYS } from '../../src/garage/hours';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Button } from '../../src/ui/Button';
import { Callout } from '../../src/ui/Callout';
import { Chip } from '../../src/ui/Chip';
import { AlertIcon, ClockIcon, ShieldCheckIcon, StarIcon, TrashIcon } from '../../src/ui/icons';
import { MenuRow } from '../../src/ui/MenuRow';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Text } from '../../src/ui/Text';
import { ToggleRow } from '../../src/ui/ToggleRow';

/**
 * Mon garage.
 *
 * L'écran a deux visages selon l'état du dossier :
 *
 *  - **en vérification** — le garage n'existe pour personne d'autre que son
 *    propriétaire. Pas d'interrupteur : il n'y a rien à ouvrir tant que le
 *    dossier n'a pas été contrôlé, et un interrupteur sans effet aurait fait
 *    croire à une détection active pendant des jours ;
 *  - **vérifié** — la page tient alors en un réglage, **la détection**. C'est
 *    le seul geste qu'un garagiste répète chaque semaine — il ferme le samedi
 *    soir, il rouvre le lundi matin — et il doit se faire d'un doigt.
 *
 * Fermer la détection ne supprime rien : le garage, ses avis, sa note et son
 * historique restent. Il cesse simplement d'être proposé aux SOS. La
 * distinction est dite à l'écran, parce que « fermer » se lit facilement comme
 * « supprimer » quand on ne l'a jamais fait.
 */
export default function MonGarageScreen() {
  const theme = useTheme();
  const { t, locale, formatNumber, plural, translateError } = useI18n();
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const garage = useMyGarage(user !== null);
  const setActive = useSetGarageActive();
  const removeGarage = useDeleteMyGarage();
  const [error, setError] = useState<string | null>(null);

  /**
   * Position affichée de l'interrupteur pendant l'aller-retour serveur.
   *
   * Sans elle, l'interrupteur ne bouge qu'à la réponse : sur un réseau lent, le
   * garagiste appuie, rien ne se passe, il rappuie — et il vient de rouvrir la
   * détection qu'il fermait. La valeur locale s'efface à la réponse, quelle
   * qu'elle soit : en cas d'échec, l'interrupteur revient donc de lui-même à
   * l'état réel du serveur, et le message dit pourquoi.
   */
  const [pendingActive, setPendingActive] = useState<boolean | null>(null);

  const data = garage.data?.garage ?? null;
  const isActive = pendingActive ?? data?.isActive ?? false;
  const verified = data !== null && data.verifiedAt !== null;

  /**
   * Retrait du dossier.
   *
   * Confirmation obligatoire : c'est irréversible, et le mot « retirer » ne dit
   * pas de lui-même que le compte redevient un compte client. L'alerte le dit.
   *
   * Après coup, `refreshUser` fait redescendre le rôle : sans lui, l'écran de
   * compte continuerait de proposer « Mon garage » sur un garage supprimé.
   * On repart sur `/compte` et non sur cet écran, qui n'a plus rien à montrer.
   */
  const confirmWithdraw = (): void => {
    Alert.alert(t('myGarage.withdrawTitle'), t('myGarage.withdrawBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('myGarage.withdrawConfirm'),
        style: 'destructive',
        onPress: () => {
          setError(null);
          removeGarage.mutate(undefined, {
            onSuccess: () => {
              void refreshUser();
              router.replace('/compte' as never);
            },
            onError: (cause) => setError(translateError(cause)),
          });
        },
      },
    ]);
  };

  const toggle = (next: boolean): void => {
    setError(null);
    setPendingActive(next);
    setActive.mutate(next, {
      onError: (cause) => setError(translateError(cause)),
      onSettled: () => setPendingActive(null),
    });
  };

  if (garage.isPending) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        <ScreenHeader title={t('myGarage.title')} />
        <View style={{ padding: theme.space.xl }}>
          <Text variant="txt" tone="muted">
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        <ScreenHeader title={t('myGarage.title')} />
        <View style={{ padding: theme.space.xl, gap: theme.space.lg }}>
          <Text variant="txt" tone="secondary">
            {t('myGarage.none')}
          </Text>
          <Button
            label={t('account.becomeGarage')}
            onPress={() => router.replace('/compte/devenir-garagiste' as never)}
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title={t('myGarage.title')} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.xl,
          paddingTop: theme.space.xl,
          paddingBottom: theme.space.xxxl,
          gap: theme.space.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: theme.space.sm }}>
          <Text variant="display">{data.name}</Text>

          <Text variant="txt" tone="secondary">
            {[data.quarter, data.city].filter(Boolean).join(' · ')}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.space.md,
            }}
          >
            {data.reviewCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
                <StarIcon color={theme.colors.warning} size={16} />
                {/* Note et décompte : deux données mesurées, donc en mono. */}
                <Text variant="monoStrong">{formatNumber(data.rating, 1)}</Text>
                <Text variant="numSm" tone="muted">
                  {data.reviewCount}{' '}
                  {t(plural(data.reviewCount) === 'one' ? 'garage.reviewOne' : 'garage.reviewMany')}
                </Text>
              </View>
            ) : (
              <Text variant="txt" tone="muted">
                {t('myGarage.noRating')}
              </Text>
            )}

            {data.certified ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
                <ShieldCheckIcon color={theme.colors.success} size={16} />
                <Text variant="smallStrong" tone="success">
                  {t('myGarage.certified')}
                </Text>
              </View>
            ) : null}

            {data.yearsInBusiness !== null ? (
              <Text variant="numSm" tone="muted">
                {data.yearsInBusiness}{' '}
                {t(plural(data.yearsInBusiness) === 'one' ? 'garage.yearsOne' : 'garage.years')}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ gap: theme.space.md }}>
          <SectionLabel>{t('myGarage.detection')}</SectionLabel>

          {!verified ? (
            /*
              Dossier à l'étude : on remplace l'interrupteur, on ne le grise
              pas. Un interrupteur désactivé invite à insister ; une phrase dit
              où en est la demande et par où la réponse arrivera.
            */
            <>
              <Callout icon={ClockIcon} title={t('myGarage.pendingTitle')}>
                {t('myGarage.pendingBody')}
              </Callout>

              {/*
                Corriger, tant que l'examen dure. Un numéro saisi de travers ou
                une position relevée depuis le salon se rattrapent ici — après
                vérification, ces champs ont été contrôlés un par un et ne se
                réécrivent plus depuis le téléphone.

                Le retrait, lui, n'est pas à côté : il est en bas de page, avec
                les autres actions irréversibles du produit. Deux boutons
                jumeaux « modifier » et « retirer » sous le même paragraphe,
                c'est une suppression à un doigt d'écart d'une correction.
              */}
              <Button
                label={t('myGarage.editDossier')}
                variant="outline"
                onPress={() => router.push('/compte/devenir-garagiste?edit=1' as never)}
                fullWidth
              />
            </>
          ) : (
            <>
              {/*
                Bandeau d'alerte quand la détection est fermée. Il est là pour
                l'oubli : un garage fermé un samedi et jamais rouvert ne reçoit
                plus un seul SOS, et rien d'autre ne viendrait le signaler.
              */}
              {!isActive ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space.md,
                    backgroundColor: theme.colors.highlightTint,
                    borderLeftWidth: 3,
                    borderLeftColor: theme.colors.highlight,
                    padding: theme.space.md,
                  }}
                >
                  <AlertIcon color={theme.colors.ink} size={20} />
                  <Text variant="h2" style={{ flex: 1 }}>
                    {t('myGarage.closedBanner')}
                  </Text>
                </View>
              ) : null}

              <ToggleRow
                label={t('myGarage.detectionLabel')}
                hint={t(isActive ? 'myGarage.detectionOnHint' : 'myGarage.detectionOffHint')}
                value={isActive}
                onChange={toggle}
              />
            </>
          )}

          {error ? <Callout tone="danger">{error}</Callout> : null}
        </View>

        <View style={{ gap: theme.space.md }}>
          <SectionLabel>{t('myGarage.contact')}</SectionLabel>

          <View style={{ gap: theme.space.sm }}>
            {/* Numéro et adresse en mono : on les relit pour les vérifier. */}
            <Text variant="monoStrong">{data.phone ?? '—'}</Text>
            <Text variant="mono" tone="secondary">
              {data.email ?? '—'}
            </Text>
            {data.addressLabel ? (
              <Text variant="txt" tone="secondary">
                {data.addressLabel}
              </Text>
            ) : null}
          </View>
        </View>

        {data.description ? (
          <View style={{ gap: theme.space.md }}>
            <SectionLabel>{t('garage.about')}</SectionLabel>
            <Text variant="txt" tone="secondary">
              {data.description}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: theme.space.md }}>
          <SectionLabel>{t('myGarage.services')}</SectionLabel>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
            {data.services.map((service) => (
              <Chip key={service} label={SERVICE_LABELS[service][locale]} />
            ))}
          </View>
        </View>

        {data.openingHours ? (
          <View style={{ gap: theme.space.md }}>
            <SectionLabel>{t('garage.hours')}</SectionLabel>

            <View
              style={{
                borderWidth: 1,
                borderColor: theme.colors.rule,
                backgroundColor: theme.colors.surface,
              }}
            >
              {WEEK_DAYS.map((day, index) => {
                const range = formatOpeningRange(data.openingHours?.[day], locale);
                return (
                  <View
                    key={day}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: theme.space.md,
                      paddingVertical: theme.space.sm,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: theme.colors.rule,
                    }}
                  >
                    <Text variant="txt">{t(`day.${day}`)}</Text>
                    <Text variant="mono" tone={range ? 'ink' : 'muted'}>
                      {range ?? t('garage.closed')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {data.photos.length > 0 ? (
          <View style={{ gap: theme.space.md }}>
            <SectionLabel>{t('garage.photos')}</SectionLabel>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
              {data.photos.map((url) => (
                <Image
                  key={url}
                  source={{ uri: url }}
                  style={{ width: 96, height: 96, backgroundColor: theme.colors.rule }}
                  accessibilityIgnoresInvertColors
                />
              ))}
            </View>
          </View>
        ) : null}

        {!data.certified && verified ? (
          <Text variant="txt" tone="muted">
            {t('myGarage.notCertifiedHint')}
          </Text>
        ) : null}

        {/*
          Le lien vers la fiche publique n'apparaît que détection ouverte : la
          fiche publique ne sert que les garages actifs, et l'ouvrir sur un
          garage fermé afficherait « ce garage est introuvable » à son propre
          propriétaire.
        */}
        {isActive ? (
          <Button
            label={t('myGarage.publicPage')}
            variant="outline"
            onPress={() => router.push(`/garage/${data.id}` as never)}
            fullWidth
          />
        ) : null}

        {/*
          Retrait du dossier, à la place que le produit réserve aux actions
          irréversibles : en bas, détaché par un filet, en rouge. C'est celle
          qu'occupe déjà la suppression de compte, et les deux se ressemblent
          assez pour mériter la même grammaire.

          Absent une fois le garage vérifié : à ce stade il ne se supprime plus,
          il se ferme à la détection — ce qui lui garde ses avis, sa note et son
          historique.
        */}
        {!verified ? (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: theme.colors.rule,
              paddingTop: theme.space.xl,
            }}
          >
            <MenuRow
              icon={TrashIcon}
              label={t('myGarage.withdrawDossier')}
              hint={t('myGarage.withdrawHint')}
              tone="danger"
              onPress={confirmWithdraw}
              first
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
