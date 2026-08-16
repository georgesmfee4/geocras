import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '../src/api/queryClient';
import { usePreferences } from '../src/settings/preferences';
import { hideNativeSplash } from '../src/screens/nativeSplash';
import { AuthProvider } from '../src/auth/AuthProvider';
import { I18nProvider } from '../src/i18n/I18nProvider';
import { LocationProvider } from '../src/location/LocationProvider';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { useAppFonts } from '../src/theme/useAppFonts';

/**
 * Le splash natif reste affiché jusqu'à ce que nos polices soient prêtes.
 *
 * Sans ça, la séquence est : splash natif rouge → **frame blanche** → splash
 * GeoCras. Cette frame blanche d'un ou deux dixièmes de seconde est exactement
 * ce qui distingue une app soignée d'une app assemblée.
 */
void SplashScreen.preventAutoHideAsync();

/**
 * Délai du garde-fou d'effacement du splash natif.
 *
 * Assez long pour que l'écran de lancement ait toujours le temps de s'en
 * charger lui-même dans le cas nominal — sinon on retomberait sur l'effacement
 * prématuré qu'on cherche justement à éviter.
 */
const SPLASH_FALLBACK_MS = 2500;

/**
 * Racine de l'application.
 *
 * L'ordre des fournisseurs n'est pas arbitraire :
 *  - `GestureHandlerRootView` doit envelopper tout le reste, sinon le tiroir
 *    latéral ne reçoit aucun geste ;
 *  - `QueryClientProvider` précède `AuthProvider`, qui vide le cache à la
 *    déconnexion ;
 *  - `LocationProvider` vient en dernier : il déclenche l'acquisition GPS dès
 *    le montage, et rien au-dessus ne doit la retarder.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <I18nProvider>
              <AuthProvider>
                <LocationProvider>
                  <RootNavigator />
                </LocationProvider>
              </AuthProvider>
            </I18nProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const fontsReady = useAppFonts();

  /**
   * Relecture des réglages d'appareil, une fois pour toute la session.
   *
   * Ici et non dans l'écran Carte : le rayon décide de la première recherche,
   * et le lire depuis l'écran qui s'en sert ferait partir une requête à 15 km
   * avant de la relancer à 40 une frame plus tard.
   */
  useEffect(() => {
    void usePreferences.getState().hydrate();
  }, []);

  /**
   * Garde-fou, et non le chemin normal.
   *
   * L'effacement du splash natif appartient à l'écran de lancement, qui sait
   * quand il est réellement peint (`app/index.tsx`). Ici on ne fait que
   * couvrir le cas où cet écran n'est jamais monté — un lien profond qui ouvre
   * directement le suivi d'une intervention, par exemple. Sans ce filet, le
   * splash natif resterait indéfiniment.
   */
  useEffect(() => {
    if (!fontsReady) return;
    const timer = setTimeout(hideNativeSplash, SPLASH_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [fontsReady]);

  if (!fontsReady) {
    // Fond rouge et non fond de thème : c'est la couleur du splash natif, donc
    // la transition est invisible. Aucun indicateur de chargement — le splash
    // natif est encore par-dessus.
    return <View style={{ flex: 1, backgroundColor: '#E53935' }} />;
  }

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          // Le geste retour d'iOS et le bouton matériel d'Android suivent la
          // même pile : rien de spécifique à gérer par écran.
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        {/*
          Fondu et non glissement. Le splash cède la place à l'accueil une
          seule fois dans la vie de l'app, et un glissement latéral découvre
          par la droite une bande de fond nu avant que l'écran n'arrive — le
          « blanc » qu'on voyait entre les deux. Un fondu passe du rouge au
          squelette de carte sans jamais montrer le vide.
        */}
        <Stack.Screen name="(drawer)" options={{ animation: 'fade' }} />
        <Stack.Screen name="connexion" />
        <Stack.Screen name="sos/declarer" />
        {/*
          Geste de retour coupé : sur cet écran, revenir en arrière annule la
          demande, et un balayage ne peut pas être confirmé — il aurait fermé
          le SOS sans rien demander. La touche retour d’Android, elle, est
          interceptée dans l’écran.
        */}
        <Stack.Screen name="sos/resultats" options={{ gestureEnabled: false }} />
        <Stack.Screen name="garage/[id]" />
        <Stack.Screen name="suivi/[requestId]" options={{ gestureEnabled: false }} />
        {/*
          Poste garagiste : la liste des SOS, le dossier d'une demande, et
          l'itinéraire vers la panne.

          Hors de l'onglet et non dedans : la barre d'onglets n'a rien à faire
          sous un dossier qu'on lit pour décider, ni sous une carte de
          navigation. L'onglet reste le point d'entrée, ces trois écrans
          s'empilent par-dessus.
        */}
        <Stack.Screen name="interventions/sos" />
        <Stack.Screen name="interventions/[requestId]" />
        <Stack.Screen name="interventions/route/[requestId]" />
        <Stack.Screen name="parametres/index" />
        <Stack.Screen name="parametres/vehicules" />
        {/* Compte : la fiche, le garage qu'on gère, l'inscription qui y mène. */}
        <Stack.Screen name="compte/index" />
        <Stack.Screen name="compte/garage" />
        <Stack.Screen name="compte/devenir-garagiste" />
        <Stack.Screen name="historique" />
        <Stack.Screen name="fidelite" />
        <Stack.Screen name="securite/index" />
        <Stack.Screen name="securite/mot-de-passe" />
        {/* Mentions légales : ouvertes depuis le pied du tiroir, sans session. */}
        <Stack.Screen name="confidentialite" />
        <Stack.Screen name="conditions" />
      </Stack>
    </>
  );
}
