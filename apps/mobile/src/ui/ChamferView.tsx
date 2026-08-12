import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { chamferPath, type ChamferRatios } from './shapes';

export type ChamferVariant = 'standard' | 'wide';

export type ChamferViewProps = ViewProps & {
  /** `wide` adoucit la coupe — à utiliser sur les boutons pleine largeur. */
  variant?: ChamferVariant;
  /** Remplissage. Par défaut : la surface du thème. */
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
  style?: StyleProp<ViewStyle>;
  /** Style du conteneur des enfants — utile pour centrer un contenu. */
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Conteneur au coin inférieur droit coupé à 45°.
 *
 * C'est la brique de l'identité visuelle : logo, boutons d'action rouges,
 * avatars, badges de fidélité. Le cahier des charges l'interdit explicitement
 * sur les cartes de contenu et les champs de saisie — ne pas l'y appliquer.
 *
 * Le tracé est peint en fond, les enfants sont posés par-dessus dans le flux
 * normal : la mise en page reste rectangulaire, seul le rendu est chamfré.
 * Conséquence à connaître : un contenu qui vient au ras du coin coupé sera
 * visuellement rogné — prévoir le rembourrage en conséquence.
 */
export function ChamferView({
  variant = 'standard',
  fill,
  borderColor,
  borderWidth = 0,
  style,
  contentStyle,
  children,
  ...rest
}: ChamferViewProps) {
  const theme = useTheme();
  const ratios: ChamferRatios = theme.chamfer[variant];
  const backgroundColor = fill ?? theme.colors.surface;

  return (
    <View style={style} {...rest}>
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        pointerEvents="none"
      >
        <Path
          d={chamferPath(ratios)}
          fill={backgroundColor}
          stroke={borderWidth > 0 ? (borderColor ?? theme.colors.ink) : 'none'}
          strokeWidth={borderWidth > 0 ? borderWidth : 0}
          // Sans cet effet, l'étirement non uniforme du viewBox déformerait le
          // trait : plus épais en haut qu'à droite sur un bouton large.
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
      <View style={contentStyle}>{children}</View>
    </View>
  );
}
