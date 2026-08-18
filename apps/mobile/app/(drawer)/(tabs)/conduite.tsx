import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertStack } from '../../../src/driving/AlertStack';
import { CockpitHalo } from '../../../src/driving/CockpitHalo';
import { DrivingControls } from '../../../src/driving/DrivingControls';
import { IdleCockpit } from '../../../src/driving/IdleCockpit';
import { KeepScreenAwake } from '../../../src/driving/KeepScreenAwake';
import { cockpitPalette } from '../../../src/driving/palette';
import { SessionBanner } from '../../../src/driving/SessionBanner';
import { SessionStats } from '../../../src/driving/SessionStats';
import { SpeedReadout } from '../../../src/driving/SpeedReadout';
import { useDrivingEngine } from '../../../src/driving/useDrivingEngine';
import { useDrivingStore } from '../../../src/stores/driving';
import { useTheme } from '../../../src/theme/ThemeProvider';

/**
 * Mode conduite.
 *
 * Deux états sur une seule route, et c'est voulu : au repos on prépare, en
 * session on lit. Un écran poussé par-dessus aurait mis une transition entre le
 * doigt et le compteur, et surtout un chemin de retour — or on ne revient pas
 * d'une session de conduite, on l'arrête.
 *
 * **L'écran suit le thème de l'app, comme tous les autres.** Une première
 * version le forçait en sombre au motif qu'un aplat crème plein écran éblouit
 * la nuit — c'était confondre deux choses : le mode conduite ne sait pas s'il
 * fait nuit, il sait seulement quel thème l'utilisateur a choisi, et quelqu'un
 * qui roule à midi en thème clair n'avait aucune raison de recevoir un écran
 * noir. Le réglage d'apparence lui appartient, ici comme ailleurs.
 *
 * Les deux thèmes ne sont pas la même image recolorée, et l'état de repos le
 * pousse plus loin que les jetons ne le permettaient : il a sa propre table de
 * couleurs, `cockpitPalette`, dont les deux moitiés portent exactement les
 * mêmes clés. Voir `<IdleCockpit>` — c'est là que vit la composition de
 * référence, sa géométrie et sa palette.
 *
 * Aucune couleur n'est écrite ici : tout passe par les jetons ou par cette
 * table, et c'est ce qui rend la bascule complète sans qu'un bloc ait à la
 * connaître.
 */
export default function ConduiteScreen() {
  const theme = useTheme();
  const phase = useDrivingStore((state) => state.phase);
  const engine = useDrivingEngine();

  const c = cockpitPalette[theme.scheme];

  if (phase === 'idle') return <IdleCockpit onStart={engine.start} />;

  return (
    /*
      Le halo est peint **sous** la zone sûre et non dedans : un enfant absolu
      se cale sur la boîte intérieure de son parent, et posé dans le
      `<SafeAreaView>` il se serait arrêté au bas de l'encoche — laissant la
      bande d'état en aplat au-dessus d'un écran qui rougeoie.
    */
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/*
        Le centre du halo remonte derrière le compteur : au repos il tombait sur
        le disque, en session c'est la vitesse qu'il éclaire. La lueur suit ce
        qu'on regarde.
      */}
      <CockpitHalo cy={0.3} red={c.haloRed} opacity={c.haloOpacity} edge={c.haloEdge} />

      {/* Monté seulement pendant la session : le verrou de veille suit le
          montage de ce composant, il n'a aucun effet à piloter. */}
      <KeepScreenAwake />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <SessionBanner paused={phase === 'paused'} />

        {/*
          Le compteur absorbe toute la place disponible et s'y centre : c'est
          lui qui doit tomber au milieu du champ de vision, quel que soit le
          nombre d'alertes en dessous.
        */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <SpeedReadout paused={phase === 'paused'} />
        </View>

        <SessionStats />

        {/*
          La pile rétrécit avant tout le reste. Sur un petit écran, c'est la
          plus ancienne des trois alertes qui est rognée par le bas — jamais la
          barre de contrôle, qui porte les deux seules cibles tactiles de
          l'écran.
        */}
        <View
          style={{
            flexShrink: 1,
            overflow: 'hidden',
            paddingTop: theme.space.lg,
            paddingBottom: theme.space.lg,
          }}
        >
          <AlertStack />
        </View>

        <View style={{ paddingBottom: theme.space.md }}>
          <DrivingControls
            phase={phase}
            onPause={engine.pause}
            onResume={engine.resume}
            // La session est close localement dès l'appui ; la synchronisation
            // suit et tolère l'échec — le mode conduite sert précisément là où
            // le réseau n'est pas.
            onStop={() => void engine.stop()}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
