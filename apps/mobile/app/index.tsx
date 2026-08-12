import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocation } from '../src/location/LocationProvider';
import { hideNativeSplashAfterPaint } from '../src/screens/nativeSplash';
import { Splash } from '../src/screens/Splash';

/**
 * Durée d'affichage **minimale** du splash.
 *
 * À ne pas confondre avec le `setTimeout` décoratif que le cahier des charges
 * interdit : celui-ci serait un *plafond* — disparaître au bout de N secondes
 * quoi qu'il arrive. Ici c'est un *plancher*. L'écran attend toujours le
 * résultat réel de l'acquisition GPS ; on empêche seulement qu'un fix obtenu
 * en 120 ms produise un clignotement illisible.
 *
 * Calé sur la première onde concentrique : en dessous, l'animation est coupée
 * avant d'avoir été perçue.
 */
const MIN_VISIBLE_MS = 1100;

export default function SplashRoute() {
  const { status } = useLocation();
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  // `unavailable` et `denied` sont des issues légitimes : l'app s'ouvre quand
  // même, et l'écran Carte affiche le bandeau de reprise. Rester bloqué ici
  // priverait de l'app quelqu'un qui a refusé la localisation.
  const locationResolved =
    status === 'ready' || status === 'unavailable' || status === 'denied';

  if (locationResolved && minimumElapsed) {
    return <Redirect href="/(drawer)/(tabs)/carte" />;
  }

  return (
    <>
      <StatusBar style="light" />
      {/*
        C'est ce `onLayout` qui efface le splash natif — pas un effet monté
        plus haut. Tant que ce rouge-ci n'est pas à l'écran, le splash natif
        reste : le fondu de l'un vers l'autre est alors invisible, les deux
        étant le même rouge.
      */}
      <View style={{ flex: 1 }} onLayout={hideNativeSplashAfterPaint}>
        <Splash />
      </View>
    </>
  );
}
