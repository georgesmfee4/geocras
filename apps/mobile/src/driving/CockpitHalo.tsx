import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export type CockpitHaloProps = {
  /** Centre vertical, en fraction de la hauteur d'écran. */
  cy: number;
  /** Couleur du centre et son opacité — séparées, comme SVG les veut. */
  red: string;
  opacity: number;
  /** Couleur du bord, à alpha nul. Toujours le fond du thème. */
  edge: string;
};

/**
 * Le halo radial du poste de conduite.
 *
 * **React Native n'a pas de `radial-gradient`.** Ni aplat, ni
 * `expo-linear-gradient`, ni image : l'aplat détruit la composition, le
 * linéaire donne une direction que la maquette n'a pas, et un PNG ne suivrait
 * pas le thème. La seule implémentation correcte passe par `react-native-svg`,
 * qui est déjà au projet.
 *
 * L'ellipse est volontairement plus large que haute — `rx` 100 %, `ry` 60 % —
 * ce qui la fait épouser la dalle au lieu de dessiner un cercle au milieu.
 *
 * Deux détails qui décident du résultat :
 *
 *  - **Le bord vaut la couleur de fond du thème**, à alpha nul, jamais du noir.
 *    Un bord noir sur un fond clair pose un cerne gris autour du halo, et c'est
 *    exactement le défaut qui fait dire « le mode clair est cassé ».
 *  - **Un arrêt intermédiaire à 40 %**, à la moitié de l'opacité. Un dégradé de
 *    cette envergure se voit par paliers sur Android ; l'arrêt supplémentaire
 *    lisse la marche sans réduire la taille du halo.
 *
 * Purement décoratif : il n'intercepte aucun appui.
 */
export function CockpitHalo({ cy, red, opacity, edge }: CockpitHaloProps) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="cockpitHalo" cx="50%" cy={`${cy * 100}%`} rx="100%" ry="60%">
          <Stop offset="0" stopColor={red} stopOpacity={opacity} />
          <Stop offset="0.4" stopColor={red} stopOpacity={opacity / 2} />
          <Stop offset="0.68" stopColor={edge} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#cockpitHalo)" />
    </Svg>
  );
}
