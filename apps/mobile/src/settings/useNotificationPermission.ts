import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';

export type NotificationPermission = {
  /** `null` tant que la première lecture n'a pas abouti. */
  granted: boolean | null;
  /**
   * `false` quand le système ne reposera plus la question — refus définitif sur
   * iOS, second refus sur Android. Le seul chemin restant passe par les
   * réglages du téléphone.
   */
  canAskAgain: boolean;
  /** Demande l'autorisation, ou ouvre les réglages s'il est trop tard pour demander. */
  request: () => Promise<void>;
  openSettings: () => void;
};

/**
 * Autorisation de notifications, lue **sur le système** et pas sur un état
 * local.
 *
 * Trois relectures, et il en faut trois :
 *
 *  1. **au montage** — l'autorisation a pu être accordée lors d'une session
 *     précédente, ou retirée depuis les réglages entre-temps ;
 *  2. **au retour au premier plan** — c'est le cas qui manquait et qui rendait
 *     l'interrupteur faux : on part dans les réglages d'Android, on autorise, on
 *     revient, et l'écran affichait encore « refusé ». L'app ne reçoit aucun
 *     événement à ce changement-là, il faut aller le relire ;
 *  3. **à chaque prise de focus de l'écran** — retour depuis un autre écran de
 *     la pile, où l'utilisateur a pu passer par les réglages système.
 *
 * Rien n'est jamais déduit d'un appui : un appui **demande**, et c'est la
 * réponse du système qui met l'état à jour. Une bascule optimiste afficherait
 * « autorisé » sur un refus.
 *
 * Toutes les erreurs sont avalées : le module n'est pas disponible partout —
 * Expo Go sur certaines versions d'Android — et un écran de réglages ne doit
 * pas tomber parce qu'une permission est illisible. L'état reste `null`, et
 * l'interrupteur se comporte comme « non autorisé », ce qui est vrai.
 */
export function useNotificationPermission(): NotificationPermission {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const mounted = useRef(true);

  const read = useCallback(async () => {
    try {
      const result = await Notifications.getPermissionsAsync();
      if (!mounted.current) return;
      setGranted(result.granted);
      // `canAskAgain` est absent de certaines réponses natives : on ne bloque
      // pas la demande sur une valeur manquante.
      setCanAskAgain(result.canAskAgain !== false);
    } catch {
      if (mounted.current) setGranted(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void read();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void read();
    });

    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [read]);

  useFocusEffect(
    useCallback(() => {
      void read();
    }, [read]),
  );

  const request = useCallback(async () => {
    if (!canAskAgain) {
      await Linking.openSettings();
      return;
    }

    try {
      const result = await Notifications.requestPermissionsAsync();
      if (!mounted.current) return;
      setGranted(result.granted);
      setCanAskAgain(result.canAskAgain !== false);
    } catch {
      if (mounted.current) setGranted(false);
    }
  }, [canAskAgain]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { granted, canAskAgain, request, openSettings };
}
