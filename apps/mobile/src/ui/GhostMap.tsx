import Svg, { G, Path, Rect } from 'react-native-svg';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

export type GhostMapProps = {
  /** Opacité globale : 10 % sur le splash, 12 % sur l'en-tête de profil. */
  opacity?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Fond de carte fantôme — rues et fleuve.
 *
 * Repris de l'écran Carte au sens du cahier des charges : c'est la **même
 * géométrie** qui sert de filigrane sur le splash et sur l'en-tête de profil.
 * Un composant plutôt qu'une image : il se recolore selon le thème, ne pèse
 * rien dans le bundle, et reste net sur tous les écrans.
 *
 * Tracé volontairement asymétrique. Une grille régulière lirait comme un motif
 * décoratif ; ici on veut suggérer un plan de ville — d'où les axes décalés,
 * l'avenue en diagonale et la courbe du fleuve.
 *
 * `preserveAspectRatio="none"` : le filigrane s'étire pour couvrir n'importe
 * quel format sans laisser de bande vide.
 */
export function GhostMap({ opacity = 0.1, color = '#FFFFFF', style }: GhostMapProps) {
  return (
    <Svg
      style={[StyleSheet.absoluteFill, style]}
      viewBox="0 0 100 180"
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <G opacity={opacity}>
        {/* Axes verticaux */}
        <Rect x={28} y={0} width={2.4} height={180} fill={color} />
        <Rect x={74} y={0} width={1.6} height={180} fill={color} />
        <Rect x={12} y={0} width={0.8} height={180} fill={color} opacity={0.6} />

        {/* Axes horizontaux — le plus large fait office de boulevard */}
        <Rect x={0} y={58} width={100} height={3.2} fill={color} />
        <Rect x={0} y={118} width={100} height={1.6} fill={color} />
        <Rect x={0} y={150} width={100} height={0.9} fill={color} opacity={0.6} />

        {/* Avenue en diagonale */}
        <Path
          d="M0 132 L100 108"
          stroke={color}
          strokeWidth={2}
          fill="none"
          opacity={0.7}
        />

        {/* Fleuve : large, sinueux, sans angle vif */}
        <Path
          d="M-6 180 C 10 150, 4 132, 20 118 C 34 106, 30 92, 18 78 L 0 66"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />

        {/* Îlots bâtis */}
        <Rect x={38} y={66} width={22} height={16} fill={color} opacity={0.35} />
        <Rect x={80} y={124} width={14} height={12} fill={color} opacity={0.3} />
      </G>
    </Svg>
  );
}
