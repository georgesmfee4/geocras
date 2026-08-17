import { Pressable, View } from 'react-native';
import type { RequestVehicleType } from '@geocras/shared';
import { useTheme } from '../theme/ThemeProvider';
import { CarIcon, MotoIcon, TruckIcon, VehicleOtherIcon, type IconProps } from '../ui/icons';
import { Text } from '../ui/Text';

const ICONS: Record<RequestVehicleType, (props: IconProps) => React.ReactNode> = {
  car: CarIcon,
  moto: MotoIcon,
  truck: TruckIcon,
  other: VehicleOtherIcon,
};

export type VehicleTileProps = {
  type: RequestVehicleType;
  label: string;
  active: boolean;
  onPress: () => void;
};

/**
 * Tuile de choix du véhicule.
 *
 * Reprend la maquette : tuile active en encre `#1C1A17`, pictogramme rouge,
 * libellé blanc en majuscules. Deux écarts assumés :
 *
 * - **Quatre tuiles au lieu de trois.** « Autre » s'ajoute aux trois types de
 *   la maquette, ce qui resserre chaque tuile. À quatre, l'icône passe de 32 à
 *   26 px et le libellé de 10 à 9 px — en dessous, « REMORQUAGE » ne tiendrait
 *   plus, mais les libellés véhicule sont courts.
 * - **Pas de chamfer.** C'est un contrôle de formulaire, pas un bouton
 *   d'action ; le cahier des charges réserve l'angle coupé aux seconds.
 */
export function VehicleTile({ type, label, active, onPress }: VehicleTileProps) {
  const theme = useTheme();
  const Icon = ICONS[type];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: 72,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: active ? theme.colors.ink : theme.colors.surface,
        borderWidth: active ? 0 : 1,
        borderColor: theme.colors.rule,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon color={active ? theme.colors.primary : theme.colors.inkSecondary} size={26} />

      {/*
        La surcharge à 9 px tombe avec le passage à Bebas : le jeton `tab` en
        donne 10, et Bebas rend plus petit qu'Inter à taille égale — les deux
        se compensent. Mesuré à 27,9 px pour « Voiture » dans une tuile de 76,
        le plus long libellé du lot ; il reste de la marge en anglais.
      */}
      <Text
        variant="tab"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{ color: active ? theme.colors.surface : theme.colors.inkSecondary }}
      >
        {label}
      </Text>

      {/*
        Filet rouge sous la tuile active. Sans lui, deux tuiles voisines en
        encre et en blanc se distinguent au contraste mais pas au coup d'œil —
        et c'est le seul repère dont on dispose en plein soleil.
      */}
      {active ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 2.5,
            backgroundColor: theme.colors.primary,
          }}
        />
      ) : null}
    </Pressable>
  );
}
