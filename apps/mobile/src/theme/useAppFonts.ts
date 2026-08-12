import { useFonts } from 'expo-font';

/**
 * Import **par graisse**, pas depuis l'index du paquet.
 *
 * `import { Inter_400Regular } from '@expo-google-fonts/inter'` traverse un
 * index qui réexporte les 18 fichiers de la famille : Metro les embarque tous,
 * italiques et graisses inutilisées comprises, soit ~6 Mo d'APK pour neuf
 * fichiers réellement utilisés. Les sous-chemins ne tirent que le nécessaire.
 */
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono/700Bold';

/**
 * Rien ne doit s'afficher avant que les polices soient prêtes : l'identité
 * repose sur la distinction Inter / IBM Plex Mono, et un rendu en police
 * système donnerait une première impression qui n'est pas le produit.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
  });

  // Un échec de chargement ne doit pas figer l'app sur un écran vide : on
  // dégrade sur la police système plutôt que de bloquer un utilisateur en panne.
  return loaded || error !== null;
}
