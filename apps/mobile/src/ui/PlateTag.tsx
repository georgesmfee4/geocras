import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type PlateTagProps = {
  /** Numéro tel qu'il est peint sur le véhicule. */
  plate: string;
  size?: 'small' | 'large';
};

/**
 * Plaque d'immatriculation, dessinée comme une plaque.
 *
 * Pour un garagiste qui cherche un véhicule au bord d'une route, **le véhicule
 * est sa plaque** : c'est ce qu'il lit à cinquante mètres, avant la marque et
 * avant la couleur. La rendre sous forme d'objet — bande pays, cadre, chiffres
 * espacés — la rend reconnaissable d'un coup d'œil là où une ligne de texte de
 * plus se serait fondue dans la fiche.
 *
 * Deux détails qui font qu'elle se lit comme une plaque et pas comme une puce :
 *
 * - la **bande « CM »** à gauche, à la place du losange européen. C'est le
 *   format qu'on a sous les yeux au Cameroun, et il ancre l'objet ;
 * - ses couleurs **ne suivent pas le thème**. Une plaque est blanche à lettres
 *   noires de jour comme de nuit ; l'assombrir en mode sombre reviendrait à
 *   repeindre la voiture. D'où les jetons `plateFace` et `plateInk`, identiques
 *   dans les deux thèmes.
 *
 * Mono et interlettrage large, évidemment : c'est une donnée qu'on relit
 * caractère par caractère pour la comparer à ce qu'on a devant soi.
 */
export function PlateTag({ plate, size = 'small' }: PlateTagProps) {
  const theme = useTheme();

  const large = size === 'large';
  const height = large ? 40 : 30;
  const bandWidth = large ? 22 : 17;

  return (
    <View
      accessibilityLabel={plate}
      style={{
        height,
        flexDirection: 'row',
        alignSelf: 'flex-start',
        alignItems: 'stretch',
        backgroundColor: theme.colors.plateFace,
        borderWidth: 1.5,
        borderColor: theme.colors.plateInk,
        borderRadius: theme.radius.field,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: bandWidth,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.plateInk,
        }}
      >
        <Text
          variant="footnote"
          style={{
            color: theme.colors.plateFace,
            fontSize: large ? 10 : 8,
            letterSpacing: 0,
          }}
        >
          CM
        </Text>
      </View>

      <View
        style={{
          justifyContent: 'center',
          paddingHorizontal: large ? theme.space.md : theme.space.sm,
        }}
      >
        <Text
          variant="monoStrong"
          numberOfLines={1}
          style={{
            color: theme.colors.plateInk,
            fontSize: large ? 19 : 14,
            letterSpacing: large ? 2.5 : 1.6,
          }}
        >
          {plate.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}
