import { Pressable, View } from 'react-native';
import { VEHICLE_LABELS, type Vehicle } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { ChamferView } from '../ui/ChamferView';
import { CarIcon, CheckIcon, MotoIcon, TruckIcon, VehicleOtherIcon } from '../ui/icons';
import { PlateTag } from '../ui/PlateTag';
import { Text } from '../ui/Text';

function iconFor(type: Vehicle['type']) {
  return type === 'moto' ? MotoIcon : type === 'truck' ? TruckIcon : CarIcon;
}

/** Nom lisible d'un véhicule : sa marque et son modèle, à défaut son genre. */
export function vehicleTitle(vehicle: Vehicle, locale: 'fr' | 'en'): string {
  return (
    [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || VEHICLE_LABELS[vehicle.type][locale]
  );
}

/**
 * Choix d'un véhicule déjà enregistré.
 *
 * Quelqu'un en panne au bord d'une route a déjà donné sa voiture une fois, à
 * l'inscription ou dans ses paramètres. Le lui refaire décrire — genre, puis
 * libellé — est du temps pris sur un écran d'urgence, et du temps pendant
 * lequel personne ne roule vers lui. Une tape suffit ici, et elle renseigne
 * aussi la plaque, ce que le formulaire libre ne fait pas : c'est elle que le
 * garagiste lit en arrivant sur place.
 *
 * La dernière ligne, **« un autre véhicule »**, n'est pas une échappatoire
 * polie : on emprunte, on dépanne un proche, on conduit le camion de
 * l'entreprise. Elle rend la main au choix manuel du genre, celui que le
 * formulaire proposait jusqu'ici, et reste toujours accessible même quand un
 * véhicule enregistré est déjà retenu.
 */
export function SavedVehiclePicker({
  vehicles,
  selectedId,
  onSelect,
  onSelectOther,
}: {
  vehicles: readonly Vehicle[];
  /** `null` quand l'utilisateur décrit un véhicule à la main. */
  selectedId: string | null;
  onSelect: (vehicle: Vehicle) => void;
  onSelectOther: () => void;
}) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  return (
    <View style={{ gap: theme.space.sm }}>
      {vehicles.map((vehicle) => {
        const active = vehicle.id === selectedId;
        const Icon = iconFor(vehicle.type);
        const title = vehicleTitle(vehicle, locale);

        return (
          <Row
            key={vehicle.id}
            active={active}
            label={title}
            onPress={() => onSelect(vehicle)}
            icon={
              <Icon color={active ? theme.colors.surface : theme.colors.inkSecondary} size={22} />
            }
          >
            <Text variant="h2" numberOfLines={1}>
              {title}
            </Text>
            <Text variant="numSm" tone="muted" numberOfLines={1}>
              {VEHICLE_LABELS[vehicle.type][locale]}
              {vehicle.year ? ` · ${vehicle.year}` : ''}
              {vehicle.isDefault ? ` · ${t('settings.vehicleDefault')}` : ''}
            </Text>
            {vehicle.plate ? (
              <View style={{ marginTop: theme.space.xs }}>
                <PlateTag plate={vehicle.plate} />
              </View>
            ) : null}
          </Row>
        );
      })}

      <Row
        active={selectedId === null}
        label={t('sos.otherVehicle')}
        onPress={onSelectOther}
        icon={
          <VehicleOtherIcon
            color={selectedId === null ? theme.colors.surface : theme.colors.inkSecondary}
            size={22}
          />
        }
      >
        <Text variant="h2" numberOfLines={1}>
          {t('sos.otherVehicle')}
        </Text>
        <Text variant="txt" tone="muted" numberOfLines={1}>
          {t('sos.otherVehicleHint')}
        </Text>
      </Row>
    </View>
  );
}

/**
 * Une ligne de choix.
 *
 * Le sélectionné se lit à trois signes redondants — bord encre épaissi,
 * vignette pleine, pastille cochée — parce qu'un seul d'entre eux disparaît en
 * plein soleil sur un écran de téléphone poussiéreux.
 *
 * La ligne elle-même n'est pas chamfrée : c'est un contrôle de formulaire, au
 * même titre que les tuiles de genre. Seule la vignette du pictogramme l'est,
 * comme tous les badges du produit.
 */
function Row({
  active,
  label,
  icon,
  onPress,
  children,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        minHeight: MIN_TOUCH_TARGET,
        padding: theme.space.md,
        backgroundColor: theme.colors.surface,
        borderWidth: active ? 2 : 1,
        borderColor: active ? theme.colors.ink : theme.colors.rule,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <ChamferView
        fill={active ? theme.colors.ink : theme.colors.background}
        style={{ width: 40, height: 40 }}
        contentStyle={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        {icon}
      </ChamferView>

      <View style={{ flex: 1 }}>{children}</View>

      {/* Pastille : 50 % de rayon, conformément à la règle des rayons. */}
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? theme.colors.ink : 'transparent',
          borderWidth: active ? 0 : 1.5,
          borderColor: theme.colors.rule,
        }}
      >
        {active ? <CheckIcon color={theme.colors.surface} size={13} /> : null}
      </View>
    </Pressable>
  );
}
