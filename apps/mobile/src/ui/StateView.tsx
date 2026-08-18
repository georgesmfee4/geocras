import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { BrokenArt, EmptyArt, OfflineArt } from './art/StateArt';
import { Button } from './Button';
import { isTerminal, type LoadState } from './loadState';
import { Text } from './Text';

/**
 * Quel dessin pour quel état — et surtout, quel état n'en reçoit aucun.
 *
 * Trois seulement en portent un. Ce n'est pas une économie de moyens : une
 * illustration est un **arrêt**, elle occupe l'écran entier et demande une
 * décision. La poser sur un état passager apprendrait à l'utilisateur à
 * l'ignorer, et elle ne serait plus lue le jour où elle compte.
 *
 * - `offline`, `error`, `not_found` → un dessin. Ce sont des impasses : rien
 *   n'arrivera de plus sans une action.
 * - `empty` → un dessin, mais **calme**. Un vide n'est pas une panne.
 * - `permission_denied` → **pas de dessin**. Ce n'est pas une impasse, c'est
 *   une porte : la seule chose qui compte est le bouton qui l'ouvre, et une
 *   grande image posée au-dessus ne ferait que le repousser plus bas.
 * - tous les autres → squelette ou une ligne de texte.
 */
const ART: Partial<Record<LoadState, (props: { size?: number }) => ReactNode>> = {
  offline: OfflineArt,
  error: BrokenArt,
  not_found: BrokenArt,
  empty: EmptyArt,
};

export type StateViewProps = {
  state: LoadState;
  /**
   * Titre et texte de l'état terminal.
   *
   * Fournis par l'écran et non déduits ici : « Historique indisponible » et
   * « Ce garage n'existe plus » sont deux `not_found`, et un composant générique
   * qui écrirait le même mot pour les deux ramènerait exactement le problème
   * qu'on cherche à corriger.
   */
  title?: string;
  body?: string;
  /** Bouton principal — « Réessayer », « Se connecter », « Élargir le rayon ». */
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Forme de ce qui arrive, montrée pendant `loading` et `initializing`.
   *
   * Toujours préférable à une roue quand on connaît déjà la mise en page : la
   * page ne saute pas au moment où les données arrivent.
   */
  skeleton?: ReactNode;
  /** Le contenu, rendu dès qu'il y a quelque chose à montrer. */
  children?: ReactNode;
};

/**
 * Le rendu d'un état de chargement.
 *
 * Un seul composant pour les douze états, et c'est le point : tant que chaque
 * écran décidait lui-même quoi peindre pendant une attente, chacun le faisait
 * un peu différemment — l'un un squelette, l'autre une roue, le troisième rien
 * du tout — et aucun ne distinguait « pas de réseau » de « pas de droits ».
 *
 * L'écran ne fournit plus que ce qu'il est seul à savoir : les mots, l'action,
 * et la forme de son squelette.
 */
export function StateView({
  state,
  title,
  body,
  actionLabel,
  onAction,
  skeleton,
  children,
}: StateViewProps) {
  const theme = useTheme();
  const { t } = useI18n();

  // Rien n'est lancé : on ne peint pas une attente pour une requête qui n'a
  // même pas de raison de partir.
  if (state === 'idle') return <>{children}</>;

  if (state === 'initializing' || state === 'loading') {
    if (skeleton) return <>{skeleton}</>;
    return <Line label={state === 'loading' ? t('state.loading') : t('state.initializing')} spinner />;
  }

  /**
   * Une nouvelle tentative se dit, et se dit **en une ligne**.
   *
   * Sans elle, l'attente double sans explication et l'utilisateur conclut au
   * blocage — puis quitte l'écran une seconde avant que la réponse arrive.
   */
  if (state === 'retrying') {
    if (skeleton) {
      return (
        <>
          <Line label={t('state.retrying')} spinner />
          {skeleton}
        </>
      );
    }
    return <Line label={t('state.retrying')} spinner />;
  }

  // Il y a déjà quelque chose à l'écran : on ne le remplace pas. La
  // revalidation et l'action en cours se signalent ailleurs — bandeau de
  // joignabilité, état occupé du bouton qui a lancé l'action.
  if (!isTerminal(state)) return <>{children}</>;

  const Art = ART[state];

  /**
   * Repli générique, jamais un vide.
   *
   * L'écran dit ce qu'il sait — « Historique indisponible » vaut mieux que
   * « Quelque chose a cassé ». Quand il n'a rien de plus précis à dire, ces
   * mots-là valent toujours mieux qu'une illustration muette, qui laisserait
   * l'utilisateur deviner s'il doit attendre, se connecter ou renoncer.
   */
  const fallback = {
    offline: { title: t('state.offlineTitle'), body: t('state.offlineBody') },
    error: { title: t('state.errorTitle'), body: t('state.errorBody') },
    not_found: { title: t('state.notFoundTitle'), body: t('state.notFoundBody') },
    permission_denied: { title: t('state.deniedTitle'), body: t('state.deniedBody') },
    empty: { title: undefined, body: undefined },
  }[state];

  const shownTitle = title ?? fallback?.title;
  const shownBody = body ?? fallback?.body;

  return (
    <View
      style={{
        alignItems: 'center',
        paddingHorizontal: theme.space.xxxl,
        paddingVertical: theme.space.xxxl,
        gap: theme.space.lg,
      }}
    >
      {Art ? <Art /> : null}

      <View style={{ alignItems: 'center', gap: theme.space.sm }}>
        {shownTitle ? (
          <Text variant="h1b" style={{ textAlign: 'center' }}>
            {shownTitle}
          </Text>
        ) : null}

        {shownBody ? (
          <Text variant="txt" tone="secondary" style={{ textAlign: 'center' }}>
            {shownBody}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          variant={state === 'permission_denied' ? 'primary' : 'outline'}
          onPress={onAction}
          style={{ marginTop: theme.space.xs }}
        />
      ) : null}
    </View>
  );
}

/**
 * L'attente sans squelette : une ligne, centrée, discrète.
 *
 * Elle existe pour les endroits où la forme de ce qui arrive n'est pas connue
 * — une action, un décompte. Partout où elle l'est, le squelette vaut mieux :
 * il tient la place et évite le saut de page.
 */
function Line({ label, spinner = false }: { label: string; spinner?: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.sm,
        paddingVertical: theme.space.lg,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      {spinner ? <ActivityIndicator size="small" color={theme.colors.muted} /> : null}
      <Text variant="txt" tone="secondary">
        {label}
      </Text>
    </View>
  );
}
