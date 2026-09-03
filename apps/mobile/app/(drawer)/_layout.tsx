import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Drawer } from 'expo-router/drawer';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoyalty, useMyRequests } from '../../src/api/hooks';
import { registerDrawerCloser } from '../../src/navigation/drawerControl';
import { useAuth } from '../../src/auth/AuthProvider';
import { env } from '../../src/config/env';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { ChamferView } from '../../src/ui/ChamferView';
import {
  AccountGearIcon,
  CloseIcon,
  DrivingTabIcon,
  LoyaltyIcon,
  PhoneIcon,
  SettingsIcon,
  ShieldLockIcon,
  TrackHistoryIcon,
} from '../../src/ui/icons';
import { MenuRow } from '../../src/ui/MenuRow';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Text } from '../../src/ui/Text';

export default function DrawerLayout() {
  const theme = useTheme();

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          // Plein écran : le tiroir est l'unique accès au profil, à la
          // sécurité et aux réglages depuis que le bouton a rejoint la barre
          // de recherche.
          width: '100%',
          backgroundColor: theme.colors.background,
        },
        // Le geste d'ouverture est désactivé : sur l'écran Carte, un balayage
        // depuis le bord gauche doit déplacer la carte, pas ouvrir le menu.
        swipeEnabled: false,
      }}
    />
  );
}

/**
 * Menu du compte, en plein écran.
 *
 * Repris de la maquette 09. La liste à plat qui l'a précédé traitait
 * « Profil », « Sécurité » et « Assistance » comme équivalents ; ici la page
 * s'organise en trois strates :
 *
 *  1. **qui vous êtes** — avatar, nom, accès au compte ;
 *  2. **ce que l'app sait faire de plus** — le reste, sous un intitulé de
 *     section.
 *
 * Le véhicule par défaut avait sa carte entre les deux ; elle a été retirée.
 * Ce menu s'ouvre pour aller quelque part, et cette carte était la seule chose
 * qui s'y consultait sans y conduire — elle repoussait toutes les entrées d'un
 * écran vers le bas pour afficher une plaque qu'on ne relit pas. Les véhicules
 * restent à un appui, sous Paramètres, où ils se modifient vraiment.
 *
 * Le menu a **deux états**, et non un seul avec des lignes grisées :
 *
 *  - **connecté** — client comme garagiste, les deux strates au complet ;
 *  - **invité** — la première strate dit en toutes lettres qu'on navigue sans
 *    compte et propose la connexion, puis il ne reste que l'assistance. Les
 *    autres entrées mènent à des écrans qui n'existent que pour une session :
 *    y conduire un invité, c'est le renvoyer sur un formulaire de connexion
 *    qu'il n'a pas demandé. Mieux vaut ne pas les montrer.
 *
 * Les mentions légales, elles, ne dépendent pas de la session : elles closent
 * la page dans les deux états.
 *
 * Toutes les entrées mènent à des écrans qui existent. Les rubriques de la
 * maquette sans équivalent chez nous — « Mes trajets », « Garages hors
 * connexion », « Partager ma position » — ont été remplacées par ce que le
 * produit sait réellement faire aujourd'hui : interventions, fidélité,
 * sécurité. Une entrée qui mène à un écran vide coûte plus cher qu'une entrée
 * absente.
 *
 * « Profil » n'a plus de ligne à lui : le bouton « Gérer mon compte » ouvre le
 * même écran, et deux portes voisines vers la même pièce n'aidaient personne.
 */
function DrawerContent({ navigation }: DrawerContentComponentProps) {
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const router = useRouter();
  const { status, user, logout } = useAuth();

  const signedIn = user !== null;

  /** Version réelle du bundle : le numéro de build inventé n'a jamais rien voulu dire. */
  const version = Constants.expoConfig?.version ?? '1.0.0';

  // Ni l'une ni l'autre n'a de sens sans session — cf. `enabled` dans
  // `src/api/hooks.ts`.
  const loyalty = useLoyalty(signedIn);
  const history = useMyRequests(1, signedIn);

  /**
   * Fermeture par le `navigation` **que le tiroir passe à son contenu**.
   *
   * Un `useNavigation()` posé ici ne rend pas le tiroir : le contenu est monté
   * à côté des écrans, et l'objet obtenu est celui de la pile racine — au-dessus
   * du tiroir, donc incapable de traiter `CLOSE_DRAWER`. L'action remontait la
   * hiérarchie sans trouver preneur, d'où « The action CLOSE_DRAWER was not
   * handled by any navigator » à chaque ouverture du menu.
   */
  const close = (): void => {
    navigation.closeDrawer();
  };

  /**
   * Ouvrir un écran depuis le tiroir.
   *
   * **Le tiroir ne se referme pas.** L'écran demandé s'empile par-dessus lui,
   * et c'est tout : une seule animation, celle de la pile, jouée par la
   * plateforme au-dessus d'une couche immobile.
   *
   * Les deux versions précédentes fermaient le tiroir — avant la navigation,
   * puis après — et les deux avaient le même défaut de fond : refermer un
   * tiroir plein écran **découvre l'accueil**. On voyait donc la carte
   * apparaître une fraction de seconde entre le menu et l'écran demandé, avec
   * deux animations concurrentes pour la produire. Ne rien fermer supprime la
   * seconde animation et le passage par l'accueil du même coup.
   *
   * Conséquence voulue : revenir en arrière ramène au menu, là où l'on était.
   * C'est ce qu'on attend d'une pile, et ça épargne le geste de rouvrir le
   * tiroir pour aller voir l'entrée suivante.
   */
  const go = (route: string): void => {
    router.push(route as never);
  };

  /**
   * La déconnexion demande confirmation.
   *
   * Elle est réversible — le compte survit — mais elle coupe le suivi d'une
   * intervention en cours et vide le cache local. Surtout, elle vivait au pied
   * d'un tiroir plein écran, là où le pouce se pose pour refermer : c'est la
   * position la plus exposée de l'interface, pas celle qu'on réserve à une
   * action sans retour.
   *
   * `Alert` et non une feuille maison : c'est le motif déjà employé pour la
   * suppression d'un véhicule, d'un compte et le retrait de candidature. Une
   * quatrième forme de confirmation apprendrait à l'utilisateur qu'il y en a
   * plusieurs, ce qui est exactement ce qu'une confirmation ne doit pas faire.
   */
  const confirmLogout = (): void => {
    Alert.alert(t('drawer.logoutTitle'), t('drawer.logoutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('drawer.logoutConfirm'),
        style: 'destructive',
        onPress: () => {
          close();
          void logout();
        },
      },
    ]);
  };

  /**
   * La déconnexion et la suppression de compte se font depuis un écran posé
   * au-dessus du tiroir : elles ont besoin de le refermer, et n'ont aucun moyen
   * de l'atteindre. Cf. `src/navigation/drawerControl.ts`.
   */
  useEffect(() => registerDrawerCloser(close));

  const initials = user
    ? user.fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : null;

  /** Prénom seul dans la salutation : « Bonjour Jean Baptiste Djomo ! » sonne administratif. */
  const firstName = user?.fullName.trim().split(/\s+/)[0] ?? null;

  /**
   * L'assistance est la seule entrée commune aux deux états : elle compose un
   * numéro, elle ne consulte pas de compte. Quelqu'un en panne qui n'a jamais
   * créé de compte doit pouvoir appeler depuis ce menu.
   */
  const supportRow = (
    <MenuRow
      icon={PhoneIcon}
      label={t('drawer.support')}
      // Numéro en mono : c'est ce qu'on lit à voix haute pour le composer
      // depuis un autre téléphone quand la batterie lâche.
      trailing={
        <Text variant="numSm" tone="muted">
          {env.supportPhone}
        </Text>
      }
      onPress={() => void Linking.openURL(`tel:${env.supportPhone}`)}
      first={!signedIn}
    />
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      // Le bas est protégé lui aussi depuis que les mentions légales sont
      // collées au pied de page : sans ça, elles passent sous la barre de
      // navigation gestuelle.
      edges={['top', 'bottom']}
    >
      {/*
        L'adresse e-mail en tête, en mono et discrète : c'est l'identifiant du
        compte, pas un titre. Elle répond à la seule question qu'on se pose en
        ouvrant ce menu quand on a plusieurs comptes — « lequel suis-je ? ».
      */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.space.sm,
        }}
      >
        {/*
          Cale de la largeur du bouton de fermeture.
          Sans elle, « centré » voudrait dire centré dans la place qui reste à
          gauche de la croix — soit visiblement décalé sur la page.
        */}
        <View style={{ width: MIN_TOUCH_TARGET }} />

        <Text
          variant="numSm"
          tone="secondary"
          numberOfLines={1}
          style={{ flex: 1, textAlign: 'center' }}
        >
          {user?.email ?? user?.phone ?? t('drawer.notSignedIn')}
        </Text>

        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={12}
          style={{
            width: MIN_TOUCH_TARGET,
            height: MIN_TOUCH_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CloseIcon color={theme.colors.ink} />
        </Pressable>
      </View>

      {/*
        `flexGrow: 1` sur le contenu, `marginTop: 'auto'` sur le pied : en mode
        invité la page est courte, et les mentions légales doivent finir en bas
        d'écran plutôt que flotter juste sous le bouton de connexion.
      */}
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: theme.space.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            alignItems: 'center',
            gap: theme.space.md,
            paddingHorizontal: theme.space.xl,
            paddingBottom: theme.space.xl,
          }}
        >
          <ChamferView
            fill={theme.colors.primary}
            style={{ width: 76, height: 76 }}
            contentStyle={{
              width: 76,
              height: 76,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {initials ? (
              <Text variant="h1b" tone="inverse">
                {initials}
              </Text>
            ) : (
              <AccountGearIcon color="#FFFFFF" size={34} />
            )}
          </ChamferView>

          {/*
            Tant que la session n'est pas tranchée, ni salutation ni invitation
            à se connecter : annoncer « Invité » à quelqu'un dont le jeton est
            en cours de vérification serait faux une fraction de seconde, et
            c'est exactement le genre de clignotement qui se remarque.
          */}
          {status === 'loading' ? null : signedIn ? (
            <>
              {/*
                Plex Sans et non Bebas, contrairement à tous les autres titres
                du produit — c'est la règle de la famille, pas une exception :
                **si c'est une phrase, ce n'est pas Bebas.** « Bonjour Jean ! »
                en est une, et Bebas n'a pas de bas-de-casse : elle la
                rendrait « BONJOUR JEAN ! », c'est-à-dire criée, avec un prénom
                qui perd sa majuscule initiale au passage — un nom propre écrit
                tout en capitales n'est plus un nom propre.

                « Mode invité » juste en dessous reste en Bebas : c'est une
                étiquette d'état, pas une adresse à quelqu'un.
              */}
              <Text variant="h1">
                {firstName ? `${t('drawer.hello')} ${firstName} !` : t('drawer.account')}
              </Text>

              <Button
                label={t('drawer.manageAccount')}
                variant="outline"
                // Coupe réduite : ce bouton n'est ni court ni pleine largeur, et
                // `standard` y emportait un quart de sa longueur.
                chamfer="subtle"
                onPress={() => go('/compte')}
              />
            </>
          ) : (
            <>
              <Text variant="h1b">{t('drawer.guest')}</Text>

              {/*
                Dire ce que l'invité n'a pas, et non seulement qu'il est
                invité : la phrase justifie le bouton juste en dessous. Sans
                elle, « Se connecter » est une porte sans panneau.
              */}
              <Text variant="txt" tone="secondary" style={{ textAlign: 'center' }}>
                {t('drawer.guestLead')}
              </Text>

              <Button label={t('drawer.login')} onPress={() => go('/connexion')} fullWidth />
            </>
          )}
        </View>

        {signedIn ? (
          <>
            <View style={{ paddingHorizontal: theme.space.lg, paddingTop: theme.space.xl }}>
              <SectionLabel>{t('drawer.more')}</SectionLabel>
            </View>

            {/*
              Le mode conduite est mis en avant sur fond encre : c'est le seul
              élément de ce menu qui **active une fonctionnalité** au lieu
              d'ouvrir un écran de consultation. Le badge BÊTA est là parce que
              la détection d'alertes est encore simulée — le dire ici évite
              qu'on la prenne pour un système d'aide à la conduite éprouvé.
            */}
            {/*
              Seule entrée du menu qui referme le tiroir, et la seule qui le
              doive : elle ne pousse pas un écran par-dessus, elle bascule sur
              un onglet situé **dessous**. Sans fermeture, on resterait sur le
              menu à regarder un changement d'onglet invisible.
            */}
            <Pressable
              onPress={() => {
                close();
                router.push('/(drawer)/(tabs)/conduite' as never);
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginHorizontal: theme.space.lg,
                marginTop: theme.space.md,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <ChamferView
                variant="subtle"
                fill={theme.colors.ink}
                style={{ minHeight: 58 }}
                contentStyle={{
                  minHeight: 58,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.md,
                  paddingLeft: theme.space.lg,
                  paddingRight: theme.space.xxl,
                }}
              >
                <DrivingTabIcon color="#FFFFFF" size={22} />
                <Text variant="btn" tone="inverse" style={{ flex: 1 }}>
                  {t('drawer.startDriving')}
                </Text>
                <View
                  style={{
                    backgroundColor: theme.colors.warning,
                    paddingHorizontal: theme.space.sm,
                    paddingVertical: 3,
                  }}
                >
                  {/* Aplat ambre invariant : l'encre doit l'être aussi. */}
                  <Text variant="lblb" style={{ color: theme.colors.onHighlight }}>
                    {t('drawer.beta')}
                  </Text>
                </View>
              </ChamferView>
            </Pressable>

            <View style={{ marginTop: theme.space.md, marginHorizontal: theme.space.lg }}>
              <MenuRow
                icon={TrackHistoryIcon}
                label={t('drawer.history')}
                hint={t('drawer.historyHint')}
                // Le décompte vient du serveur ; tant qu'il n'est pas là, on
                // n'affiche rien plutôt qu'un zéro qui serait faux.
                trailing={
                  history.data ? (
                    <Text variant="numSm" tone="muted">
                      {history.data.total}
                    </Text>
                  ) : null
                }
                onPress={() => go('/historique')}
                first
              />
              <MenuRow
                icon={LoyaltyIcon}
                label={t('drawer.loyalty')}
                hint={t('drawer.loyaltyHint')}
                trailing={
                  loyalty.data ? (
                    <Text variant="numSm" tone="primary">
                      {formatNumber(loyalty.data.balance, 0)} pts
                    </Text>
                  ) : null
                }
                onPress={() => go('/fidelite')}
              />
              <MenuRow
                icon={ShieldLockIcon}
                label={t('drawer.security')}
                hint={t('drawer.securityHint')}
                onPress={() => go('/securite')}
              />
              <MenuRow
                icon={SettingsIcon}
                label={t('drawer.settings')}
                hint={t('drawer.settingsHint')}
                onPress={() => go('/parametres')}
              />
              {supportRow}
            </View>
          </>
        ) : (
          <View style={{ marginTop: theme.space.md, marginHorizontal: theme.space.lg }}>
            {supportRow}
          </View>
        )}

        <View style={{ marginTop: 'auto', paddingTop: theme.space.xxl }}>
          {signedIn ? (
            /*
              Bouton plein, et non plus le lien nu d'avant.

              Aligné sur la liste de menu ci-dessus, il ferme la colonne au lieu
              de flotter dans la marge. Le contour rouge le distingue des
              entrées de navigation sans lui donner l'aplat du SOS.
            */
            <View style={{ marginHorizontal: theme.space.lg }}>
              <Button
                label={t('drawer.logout')}
                variant="danger"
                fullWidth
                onPress={confirmLogout}
              />
            </View>
          ) : null}

          {/*
            Mentions légales : deux liens séparés d'un point, centrés, au pied
            de page. Ce ne sont pas des lignes de menu — les mettre dans la
            liste leur donnerait le poids de l'assistance ou de la fidélité,
            alors qu'on ne les ouvre qu'une fois. Ils restent accessibles sans
            compte : c'est justement avant d'en créer un qu'on veut lire ce
            qu'on accepte.
          */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.space.sm,
              paddingHorizontal: theme.space.xl,
              paddingTop: theme.space.lg,
            }}
          >
            <LegalLink label={t('drawer.privacy')} onPress={() => go('/confidentialite')} />
            <Text variant="caption" tone="muted">
              ·
            </Text>
            <LegalLink label={t('drawer.terms')} onPress={() => go('/conditions')} />
          </View>

          <Text variant="footnote" tone="muted" style={{ textAlign: 'center' }}>
            GEOCRAS V{version}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Lien de pied de page.
 *
 * En 11 px volontairement : les deux intitulés français tiennent alors sur une
 * seule ligne sur un écran de 360 px, alors qu'en 13 px le second passe à la
 * ligne et le point de séparation reste orphelin en fin de première ligne. La
 * cible tactile de 44 px est tenue par le rembourrage vertical et le
 * `hitSlop`, pas par la taille du texte.
 */
function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
      style={({ pressed }) => ({
        paddingVertical: theme.space.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );
}
