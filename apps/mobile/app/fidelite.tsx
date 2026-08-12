import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LOYALTY_REASON_LABELS,
  POINTS,
  TIER_DEFINITIONS,
  type Badge,
  type LoyaltyEntry,
  type LoyaltySummary,
} from '@geocras/shared';
import { useLoyalty, useLoyaltyHistory } from '../src/api/hooks';
import { useAuth } from '../src/auth/AuthProvider';
import { LoyaltySkeleton } from '../src/loyalty/LoyaltySkeleton';
import { TierCarousel, tierColor } from '../src/loyalty/TierCarousel';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/theme/ThemeProvider';
import { Accordion } from '../src/ui/Accordion';
import { Button } from '../src/ui/Button';
import { ChamferView } from '../src/ui/ChamferView';
import { CheckIcon, LoyaltyIcon, StarIcon } from '../src/ui/icons';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { SectionLabel } from '../src/ui/SectionLabel';
import { Text } from '../src/ui/Text';
import { useScreenReady } from '../src/ui/useScreenReady';

/**
 * Ma fidélité.
 *
 * L'écran répond à trois questions, et à rien d'autre :
 *
 *  1. **combien j'ai** — le solde, en tête, en mono, dans le plus grand corps
 *     de la page ;
 *  2. **où j'en suis** — le grade occupé et ce qui reste avant le suivant, sur
 *     la carte encre reprise de la maquette 08 ;
 *  3. **comment ça marche** — et c'est là que tout se joue : un programme de
 *     fidélité s'explique en trois paragraphes que personne ne lit deux fois.
 *
 * D'où deux mécanismes distincts pour la partie explicative, chacun là où il
 * est le meilleur :
 *
 *  - les **grades** se comparent, donc carrousel : même gabarit, même
 *    emplacement pour le seuil et la remise, l'œil ne suit qu'un chiffre d'une
 *    carte à l'autre. Six blocs empilés auraient fait une page de texte
 *    parcourue en diagonale ;
 *  - les **règles** se consultent une fois, donc sections dépliables, fermées
 *    par défaut. Ouvertes, elles repousseraient le solde hors de l'écran.
 *
 * Rien ne défile tout seul, contrairement à un fil de statuts : un contenu qui
 * s'échappe au bout de trois secondes se relit trois fois, et une app qui doit
 * rester lisible en plein soleil n'a pas les moyens de faire relire.
 */
export default function FideliteScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { user, status } = useAuth();

  const loyalty = useLoyalty(user !== null);

  /**
   * Rien de la page n'est monté avant la fin de l'animation d'ouverture.
   *
   * React Navigation ne commence à animer qu'une fois l'écran poussé rendu :
   * **tout** ce que contient ce premier rendu s'ajoute au délai entre l'appui
   * et le début de la transition, puis lui dispute le fil JavaScript pendant
   * qu'elle joue. Différer les seules cartes de grade n'a pas suffi — restaient
   * le solde et son chamfer, les tuiles de badges, quatre intitulés dépliables,
   * et surtout une douzaine de boucles d'ondulation à démarrer.
   *
   * L'écran s'ouvre donc sur son squelette **figé**, qui ne coûte que des vues
   * pleines, et le contenu réel se monte une fois la transition terminée.
   */
  const ready = useScreenReady();

  /** L'historique n'est chargé qu'à l'ouverture de sa section. */
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useLoyaltyHistory(1, historyOpen && user !== null);

  const summary = loyalty.data ?? null;

  if (status !== 'loading' && !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        <ScreenHeader title={t('loyalty.title')} />
        <View style={{ padding: theme.space.xl, gap: theme.space.lg }}>
          <Text variant="txt" tone="secondary">
            {t('drawer.guestLead')}
          </Text>
          <Button
            label={t('drawer.login')}
            onPress={() => router.replace('/connexion' as never)}
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
      <ScreenHeader title={t('loyalty.title')} />

      {!ready ? (
        /*
          Pendant la transition : le squelette, immobile, et rien d'autre. Pas
          même un `ScrollView` — il n'y a rien à faire défiler en trois cents
          millisecondes, et son montage est du travail de moins à faire au pire
          moment.
        */
        <LoyaltySkeleton animated={false} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: theme.space.xxxl }}
          showsVerticalScrollIndicator={false}
        >
          {/* La transition est passée : l'ondulation peut reprendre son rôle. */}
          {loyalty.isPending ? <LoyaltySkeleton /> : null}

          {loyalty.isError ? (
            <View style={{ padding: theme.space.xl, gap: theme.space.md }}>
              <Text variant="h2" tone="primary">
                {t('loyalty.failed')}
              </Text>
              <Button
                label={t('common.retry')}
                variant="outline"
                onPress={() => void loyalty.refetch()}
              />
            </View>
          ) : null}

          {summary ? (
            <LoyaltyContent
              summary={summary}
              history={history}
              onHistoryToggle={setHistoryOpen}
            />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/**
 * Le contenu chargé.
 *
 * Extrait de l'écran pour une raison de rendu et non de rangement : ce
 * sous-arbre est le seul qui coûte cher, et le tenir à part rend visible ce que
 * l'on diffère pendant la transition d'ouverture.
 */
function LoyaltyContent({
  summary,
  history,
  onHistoryToggle,
}: {
  summary: LoyaltySummary;
  history: { isPending: boolean; data?: { results: LoyaltyEntry[] } | undefined };
  onHistoryToggle: (open: boolean) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={{ gap: theme.space.xxl, paddingTop: theme.space.xl }}>
      <Balance summary={summary} />
      <NextTierCard summary={summary} />

      <View style={{ gap: theme.space.md }}>
        <View style={{ paddingHorizontal: theme.space.xl, gap: theme.space.sm }}>
          <SectionLabel>{t('loyalty.grades')}</SectionLabel>
          <Text variant="txt" tone="secondary">
            {t('loyalty.gradesLead')}
          </Text>
        </View>

        <TierCarousel current={summary.tier} />
      </View>

      {summary.badges.length > 0 ? (
        <View style={{ gap: theme.space.md }}>
          <View style={{ paddingHorizontal: theme.space.xl }}>
            <SectionLabel>{t('loyalty.badges')}</SectionLabel>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: theme.space.xl,
              gap: theme.space.md,
            }}
          >
            {summary.badges.map((badge) => (
              <BadgeTile key={badge.id} badge={badge} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Les règles, repliées. Elles existent, elles n'encombrent pas. */}
      <View style={{ paddingHorizontal: theme.space.xl }}>
        <Accordion title={t('loyalty.earn')}>
          <View style={{ gap: theme.space.sm }}>
            <EarnRow reason="assistance_completed" points={POINTS.assistance_completed} />
            <EarnRow reason="review_published" points={POINTS.review_published} />
            <EarnRow reason="referral_completed" points={POINTS.referral_completed} />
            <EarnRow reason="referred_signup" points={POINTS.referred_signup} />
          </View>
        </Accordion>

        <Accordion title={t('loyalty.checks')}>
          <Text variant="txt" tone="secondary">
            {t('loyalty.checksBody')}
          </Text>
        </Accordion>

        <Accordion title={t('loyalty.referral')} summary={summary.referralCode}>
          <ReferralBlock code={summary.referralCode} />
        </Accordion>

        <Accordion title={t('loyalty.history')} onToggle={onHistoryToggle}>
          <View style={{ gap: theme.space.sm }}>
            {history.isPending ? (
              <Text variant="txt" tone="muted">
                {t('common.loading')}
              </Text>
            ) : (history.data?.results.length ?? 0) === 0 ? (
              <Text variant="txt" tone="muted">
                {t('loyalty.historyEmpty')}
              </Text>
            ) : (
              history.data?.results.map((entry) => <EntryRow key={entry.id} entry={entry} />)
            )}
          </View>
        </Accordion>
      </View>
    </View>
  );
}

/**
 * Groupe les milliers — 1240 devient « 1 240 ».
 *
 * Espace fine insécable (U+202F), la convention typographique française et
 * celle de la maquette 08. `formatNumber` n'en met pas, et à raison : il sert
 * surtout aux distances, où « 1 200 m » se lirait comme deux nombres. Ici c'est
 * l'inverse — un solde à quatre chiffres collés se compte sur les doigts.
 */
function groupThousands(value: number): string {
  // Écrit en séquence d'échappement et non en caractère brut : une espace fine
  // posée telle quelle dans le code est indiscernable d'une espace ordinaire.
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
}

/** Solde et grade, en tête d'écran. */
function Balance({ summary }: { summary: LoyaltySummary }) {
  const theme = useTheme();
  const { t, locale, plural } = useI18n();

  const definition =
    TIER_DEFINITIONS.find((tier) => tier.id === summary.tier) ?? (TIER_DEFINITIONS[0] as (typeof TIER_DEFINITIONS)[number]);
  const color = tierColor(summary.tier, theme.colors);

  return (
    <View style={{ paddingHorizontal: theme.space.xl, gap: theme.space.md }}>
      <SectionLabel>{t('loyalty.balanceLabel')}</SectionLabel>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.sm }}>
        {/* Le solde est la donnée mesurée par excellence : mono, et grand. */}
        <Text variant="mono" style={{ fontSize: 40, lineHeight: 46 }}>
          {groupThousands(summary.balance)}
        </Text>
        <Text variant="monoStrong" tone="secondary" style={{ paddingBottom: 8 }}>
          {t('loyalty.points')}
        </Text>
      </View>

      {/*
        Les points en attente sont annoncés en jaune et jamais additionnés au
        solde : ils ne sont pas dépensables, et les mélanger reviendrait à
        afficher un solde faux pendant vingt-quatre heures.
      */}
      {summary.pending > 0 ? (
        <Text variant="numSm" tone="warning">
          +{groupThousands(summary.pending)} {t('loyalty.pending')}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <ChamferView
          fill={color}
          style={{ width: 40, height: 40 }}
          contentStyle={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <StarIcon
            color={summary.tier === 'gold' ? theme.colors.onHighlight : '#FFFFFF'}
            size={18}
          />
        </ChamferView>

        <View style={{ flex: 1 }}>
          <Text variant="h2">{definition.label[locale]}</Text>
          {/* Le compteur qui décide du grade, dit en toutes lettres. */}
          <Text variant="numSm" tone="muted">
            {summary.completedRepairs}{' '}
            {t(
              plural(summary.completedRepairs) === 'one'
                ? 'loyalty.repairsDoneOne'
                : 'loyalty.repairsDone',
            )}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Prochain grade, sur fond encre.
 *
 * Repris de la maquette 08 : c'est le seul aplat sombre de l'écran, et il porte
 * la seule chose qu'on vient y chercher en revenant — combien il reste.
 */
function NextTierCard({ summary }: { summary: LoyaltySummary }) {
  const theme = useTheme();
  const { t, locale, plural } = useI18n();

  const next = TIER_DEFINITIONS.find((tier) => tier.id === summary.nextTier) ?? null;

  return (
    <View style={{ paddingHorizontal: theme.space.xl }}>
      <View
        style={{ backgroundColor: theme.colors.ink, padding: theme.space.lg, gap: theme.space.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          <Text variant="heading" tone="inverse" style={{ flex: 1 }}>
            {next ? t('loyalty.nextTier') : t('loyalty.maxTier')}
          </Text>

          {next ? (
            <Text variant="monoStrong" style={{ color: tierColor(next.id, theme.colors) }}>
              −{next.discountPct} %
            </Text>
          ) : null}
        </View>

        {next ? (
          <>
            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.16)' }}>
              <View
                style={{
                  width: `${Math.round(summary.ratio * 100)}%`,
                  height: '100%',
                  backgroundColor: theme.colors.primary,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              <Text variant="numSm" style={{ color: theme.colors.muted }}>
                {summary.repairsToNext}{' '}
                {t(
                  plural(summary.repairsToNext) === 'one'
                    ? 'loyalty.repairsLeftOne'
                    : 'loyalty.repairsLeftMany',
                )}
              </Text>
              <Text variant="numSm" style={{ color: theme.colors.muted }}>
                ·
              </Text>
              <Text
                variant="numSm"
                numberOfLines={1}
                style={{ color: theme.colors.muted, flexShrink: 1 }}
              >
                {next.label[locale]}
              </Text>
            </View>
          </>
        ) : (
          <Text variant="txt" style={{ color: theme.colors.muted }}>
            {t('loyalty.maxTierLead')}
          </Text>
        )}
      </View>
    </View>
  );
}

function ReferralBlock({ code }: { code: string }) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={{ gap: theme.space.md }}>
      <Text variant="txt" tone="secondary">
        {t('loyalty.referralLead')}
      </Text>

      {/*
        Le code est un identifiant qu'on dicte ou qu'on recopie : mono, espacé,
        sur l'aplat jaune qui le détache de la page.
      */}
      <View
        style={{
          backgroundColor: theme.colors.highlightTint,
          borderLeftWidth: 3,
          borderLeftColor: theme.colors.highlight,
          paddingVertical: theme.space.md,
          paddingHorizontal: theme.space.lg,
        }}
      >
        <Text variant="mono" style={{ fontSize: 22, lineHeight: 28, letterSpacing: 3 }}>
          {code}
        </Text>
      </View>

      <Button
        label={t('loyalty.referralShare')}
        variant="outline"
        onPress={() => {
          void Share.share({ message: `${t('loyalty.referralMessage')} : ${code}` });
        }}
      />
    </View>
  );
}

function EarnRow({
  reason,
  points,
}: {
  reason: keyof typeof LOYALTY_REASON_LABELS;
  points: number;
}) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space.md,
        paddingVertical: 3,
      }}
    >
      <Text variant="txt" tone="secondary" style={{ flexShrink: 1 }}>
        {LOYALTY_REASON_LABELS[reason][locale]}
      </Text>
      <Text variant="monoStrong" tone="primary">
        +{points} {t('loyalty.points')}
      </Text>
    </View>
  );
}

function EntryRow({ entry }: { entry: LoyaltyEntry }) {
  const theme = useTheme();
  const { t, locale, formatDate } = useI18n();

  const stateLabel =
    entry.state === 'confirmed'
      ? t('loyalty.stateConfirmedLabel')
      : entry.state === 'pending'
        ? t('loyalty.statePendingLabel')
        : t('loyalty.stateReversedLabel');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        paddingVertical: theme.space.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.rule,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="txt">{LOYALTY_REASON_LABELS[entry.reason][locale]}</Text>
        <Text variant="numSm" tone="muted">
          {formatDate(entry.createdAt)} · {stateLabel}
        </Text>
      </View>

      <Text
        variant="monoStrong"
        tone={entry.state === 'reversed' ? 'muted' : entry.deltaPoints >= 0 ? 'success' : 'primary'}
      >
        {entry.deltaPoints >= 0 ? '+' : ''}
        {entry.deltaPoints}
      </Text>
    </View>
  );
}

/**
 * Tuile de badge, reprise de la maquette 08 : carré chamfré, libellé dessous.
 * Verrouillé, le badge garde sa place et perd sa couleur — c'est ce qui donne
 * envie de le décrocher, alors que le masquer laisserait croire qu'il n'existe
 * pas.
 */
function BadgeTile({ badge }: { badge: Badge }) {
  const theme = useTheme();
  const { t } = useI18n();

  const fill = !badge.unlocked
    ? theme.colors.rule
    : badge.tone === 'primary'
      ? theme.colors.primary
      : badge.tone === 'warning'
        ? theme.colors.highlight
        : theme.colors.inkSecondary;

  const glyph = !badge.unlocked
    ? theme.colors.muted
    : badge.tone === 'warning'
      ? theme.colors.onHighlight
      : '#FFFFFF';

  return (
    <View style={{ width: 104, gap: theme.space.sm, alignItems: 'center' }}>
      <ChamferView
        fill={fill}
        style={{ width: 56, height: 56 }}
        contentStyle={{
          width: 56,
          height: 56,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {badge.unlocked ? (
          <CheckIcon color={glyph} size={22} />
        ) : (
          <LoyaltyIcon color={glyph} size={22} />
        )}
      </ChamferView>

      <Text
        variant="smallStrong"
        tone={badge.unlocked ? 'ink' : 'muted'}
        numberOfLines={2}
        style={{ textAlign: 'center' }}
      >
        {badge.label}
      </Text>

      {!badge.unlocked ? (
        <Text variant="caption" tone="muted">
          {t('loyalty.badgeLocked')}
        </Text>
      ) : null}
    </View>
  );
}
