import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VEHICLE_LABELS, VEHICLE_TYPES, type Vehicle, type VehicleType } from '@geocras/shared';
import {
  useAddVehicle,
  useDeleteVehicle,
  useSetDefaultVehicle,
  useUpdateVehicle,
  useVehicles,
} from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { VehicleTile } from '../../src/sos/VehicleTile';
import { useTheme } from '../../src/theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Callout } from '../../src/ui/Callout';
import { ChamferView } from '../../src/ui/ChamferView';
import { CarIcon, MotoIcon, TruckIcon } from '../../src/ui/icons';
import { PlateTag } from '../../src/ui/PlateTag';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionLabel } from '../../src/ui/SectionLabel';
import { Skeleton } from '../../src/ui/Skeleton';
import { Text } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

/**
 * Plafond volontaire.
 *
 * Au-delà de cinq, la liste devient un parc et le choix du véhicule par défaut
 * perd son sens — c'est le cas d'un garagiste ou d'un transporteur, qui aura
 * son propre écran le jour venu.
 */
const MAX_VEHICLES = 5;

const CURRENT_YEAR = new Date().getFullYear();

function iconFor(type: VehicleType) {
  return type === 'moto' ? MotoIcon : type === 'truck' ? TruckIcon : CarIcon;
}

/**
 * Mes véhicules.
 *
 * Deux partis pris portent l'écran :
 *
 * **Le véhicule est sa plaque.** Elle est dessinée comme une plaque — bande
 * « CM », cadre, caractères espacés — et non écrite comme une ligne de plus.
 * C'est ce qu'un garagiste lit à cinquante mètres, et ce qui distingue deux
 * Corolla grises dans une liste.
 *
 * **Le jaune marque le véhicule par défaut.** Bande latérale, tuile d'icône et
 * pastille : c'est celui qui part avec le SOS, la seule information de cet
 * écran qui ait une conséquence. Le rouge reste aux actions — supprimer,
 * enregistrer — et ne se dispute donc pas avec un état.
 *
 * La carte entière ouvre l'édition, dépliée sur place. Ouvrir un écran pour
 * corriger une plaque, puis le refermer, ce serait deux transitions pour trois
 * caractères.
 */
export default function VehiculesScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();

  const vehicles = useVehicles(user !== null);
  const addVehicle = useAddVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const setDefault = useSetDefaultVehicle();

  /** `null` = fermé, `'new'` = ajout, sinon l'identifiant en cours d'édition. */
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = vehicles.data ?? [];
  const full = list.length >= MAX_VEHICLES;

  const confirmDelete = (vehicle: Vehicle): void => {
    Alert.alert(t('settings.vehicleRemoveTitle'), t('settings.vehicleRemoveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.vehicleRemove'),
        style: 'destructive',
        onPress: () =>
          deleteVehicle.mutate(vehicle.id, {
            onSuccess: () => setEditing(null),
            onError: () => setError(t('settings.vehicleRemoveFailed')),
          }),
      },
    ]);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title={t('settings.vehiclesTitle')} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.space.xl,
            paddingTop: theme.space.xl,
            paddingBottom: theme.space.xxxl,
            gap: theme.space.lg,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="small" tone="secondary">
            {t('settings.vehiclesLead')}
          </Text>

          {vehicles.isPending ? (
            <>
              <Skeleton width="100%" height={116} />
              <Skeleton width="100%" height={116} />
            </>
          ) : null}

          {list.map((vehicle) =>
            editing === vehicle.id ? (
              <VehicleForm
                key={vehicle.id}
                initial={vehicle}
                busy={updateVehicle.isPending}
                onCancel={() => setEditing(null)}
                onDelete={() => confirmDelete(vehicle)}
                onSave={(input) => {
                  setError(null);
                  updateVehicle.mutate(
                    { id: vehicle.id, body: input },
                    { onSuccess: () => setEditing(null) },
                  );
                }}
              />
            ) : (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onEdit={() => setEditing(vehicle.id)}
                onSetDefault={() => setDefault.mutate(vehicle.id)}
              />
            ),
          )}

          {!vehicles.isPending && list.length === 0 && editing !== 'new' ? (
            <EmptyGarage />
          ) : null}

          {error ? <Callout tone="danger">{error}</Callout> : null}

          {editing === 'new' ? (
            <VehicleForm
              busy={addVehicle.isPending}
              onCancel={() => setEditing(null)}
              onSave={(input) => {
                setError(null);
                addVehicle.mutate(input, { onSuccess: () => setEditing(null) });
              }}
            />
          ) : full ? (
            <Text variant="small" tone="muted">
              {t('settings.vehicleMax')}
            </Text>
          ) : editing === null ? (
            <Button
              label={t('settings.vehicleAdd')}
              variant="outline"
              onPress={() => setEditing('new')}
              fullWidth
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Une fiche véhicule.
 *
 * Trois strates, de la plus lointaine à la plus proche : la **tuile** dit le
 * genre de véhicule d'un coup d'œil, le **titre** le nomme, la **plaque**
 * l'identifie. Le véhicule par défaut porte le jaune sur les trois — bande,
 * tuile, pastille — parce que c'est lui qui partira avec le prochain SOS.
 */
function VehicleCard({
  vehicle,
  onEdit,
  onSetDefault,
}: {
  vehicle: Vehicle;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const Icon = iconFor(vehicle.type);

  const title =
    [vehicle.brand, vehicle.model].filter(Boolean).join(' ') ||
    VEHICLE_LABELS[vehicle.type][locale];

  const accent = vehicle.isDefault ? theme.colors.highlight : theme.colors.ink;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        borderLeftWidth: 3,
        borderLeftColor: vehicle.isDefault ? theme.colors.highlight : theme.colors.rule,
      }}
    >
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${t('settings.vehicleEdit')}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          gap: theme.space.lg,
          padding: theme.space.lg,
          backgroundColor: pressed ? theme.colors.primaryTint : 'transparent',
        })}
      >
        {/*
          L'angle coupé appartient aux badges : celui-ci en est un — il porte le
          genre du véhicule, pas une action.
        */}
        <ChamferView
          fill={accent}
          style={{ width: 46, height: 46 }}
          contentStyle={{
            width: 46,
            height: 46,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            color={vehicle.isDefault ? theme.colors.onHighlight : '#FFFFFF'}
            size={24}
          />
        </ChamferView>

        <View style={{ flex: 1, gap: theme.space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="heading" numberOfLines={1}>
                {title}
              </Text>
              <Text variant="monoSmall" tone="muted">
                {VEHICLE_LABELS[vehicle.type][locale]}
                {vehicle.year ? ` · ${vehicle.year}` : ''}
              </Text>
            </View>

            {vehicle.isDefault ? <DefaultBadge /> : null}
          </View>

          {vehicle.plate ? (
            <PlateTag plate={vehicle.plate} />
          ) : (
            <Text variant="small" tone="muted">
              {t('settings.vehicleNoPlate')}
            </Text>
          )}
        </View>
      </Pressable>

      {/*
        Une seule action au pied de la carte, et seulement quand elle a un sens.
        Modifier passe par la carte elle-même, supprimer par le formulaire :
        trois boutons alignés sous chaque véhicule transformaient la liste en
        tableau de bord.
      */}
      {!vehicle.isDefault ? (
        <Pressable
          onPress={onSetDefault}
          accessibilityRole="button"
          style={({ pressed }) => ({
            minHeight: MIN_TOUCH_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
            borderTopWidth: 1,
            borderTopColor: theme.colors.rule,
            backgroundColor: pressed ? theme.colors.highlightTint : 'transparent',
          })}
        >
          <Text variant="smallStrong">{t('settings.vehicleSetDefault')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pastille du véhicule par défaut — chamfrée, comme tous les badges du produit. */
function DefaultBadge() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <ChamferView
      fill={theme.colors.highlight}
      style={{ minHeight: 20 }}
      contentStyle={{
        minHeight: 20,
        justifyContent: 'center',
        paddingLeft: theme.space.sm,
        paddingRight: theme.space.md,
      }}
    >
      <Text variant="sectionLabel" style={{ color: theme.colors.onHighlight }}>
        {t('settings.vehicleDefault')}
      </Text>
    </ChamferView>
  );
}

/**
 * Aucun véhicule.
 *
 * Une plaque vide plutôt qu'une phrase seule : elle montre ce qu'on obtiendra,
 * et c'est plus parlant que « aucun véhicule enregistré ».
 */
function EmptyGarage() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.space.md,
        paddingVertical: theme.space.xl,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        borderStyle: 'dashed',
      }}
    >
      <PlateTag plate="— — —" />
      <Text variant="small" tone="muted">
        {t('settings.vehiclesNone')}
      </Text>
    </View>
  );
}

/**
 * Saisie d'un véhicule, dépliée à la place de sa carte.
 *
 * La plaque s'affiche **pendant la frappe**, en grand format, sous les champs :
 * on vérifie ce qu'on vient de taper sur l'objet lui-même plutôt que sur une
 * ligne de saisie. C'est aussi ce qui rend le formulaire moins administratif
 * qu'une pile de champs.
 */
function VehicleForm({
  initial,
  busy,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Vehicle;
  busy: boolean;
  onSave: (input: {
    type: VehicleType;
    brand: string | null;
    model: string | null;
    year: number | null;
    plate: string | null;
  }) => void;
  onCancel: () => void;
  /** Fourni seulement en modification : on ne supprime pas ce qui n'existe pas. */
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  const [type, setType] = useState<VehicleType>(initial?.type ?? 'car');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');
  const [plate, setPlate] = useState(initial?.plate ?? '');

  const parsedYear = Number.parseInt(year, 10);
  const yearInvalid =
    year.length > 0 &&
    (Number.isNaN(parsedYear) || parsedYear < 1950 || parsedYear > CURRENT_YEAR + 1);

  // Rien d'autre que le type n'est obligatoire : une moto sans marque connue
  // reste un véhicule que le garagiste doit pouvoir préparer.
  const canSave = !yearInvalid && !busy;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.ink,
        padding: theme.space.lg,
        gap: theme.space.lg,
      }}
    >
      <SectionLabel>
        {initial ? t('settings.vehicleEditing') : t('settings.vehicleNew')}
      </SectionLabel>

      {/*
        Les mêmes tuiles que le formulaire de panne : on choisit un véhicule de
        la même façon qu'on l'a choisi en déclarant sa panne, et le geste appris
        d'un côté sert de l'autre.
      */}
      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        {VEHICLE_TYPES.map((option) => (
          <VehicleTile
            key={option}
            type={option}
            label={VEHICLE_LABELS[option][locale]}
            active={type === option}
            onPress={() => setType(option)}
          />
        ))}
      </View>

      <TextField
        label={t('settings.vehicleBrand')}
        value={brand}
        onChangeText={setBrand}
        placeholder={t('settings.vehicleBrandPlaceholder')}
        autoCapitalize="words"
      />

      <TextField
        label={t('settings.vehicleModel')}
        value={model}
        onChangeText={setModel}
        placeholder={t('settings.vehicleModelPlaceholder')}
        autoCapitalize="words"
      />

      {/*
        Année et plaque sur la même ligne : l'année tient en quatre chiffres, et
        lui donner toute la largeur creusait le formulaire pour rien.
      */}
      <View style={{ flexDirection: 'row', gap: theme.space.md }}>
        <View style={{ width: 106 }}>
          <TextField
            label={t('settings.vehicleYear')}
            value={year}
            onChangeText={(value) => setYear(value.replace(/\D/g, '').slice(0, 4))}
            placeholder={String(CURRENT_YEAR - 6)}
            keyboardType="number-pad"
            mono
            error={yearInvalid ? `1950 – ${CURRENT_YEAR + 1}` : null}
          />
        </View>

        <View style={{ flex: 1 }}>
          <TextField
            label={t('settings.vehiclePlate')}
            value={plate}
            // La plaque se saisit en capitales : c'est ainsi qu'elle est peinte,
            // et le garagiste la compare telle quelle.
            onChangeText={(value) => setPlate(value.toUpperCase())}
            placeholder={t('settings.vehiclePlatePlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            mono
          />
        </View>
      </View>

      {/* Aperçu vivant : ce qu'on tape, tel qu'il sera lu sur la route. */}
      {plate.trim().length > 0 ? (
        <View style={{ alignItems: 'center', gap: theme.space.sm }}>
          <PlateTag plate={plate.trim()} size="large" />
          <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
            {t('settings.vehiclePlateHint')}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.space.md }}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({
            justifyContent: 'center',
            paddingHorizontal: theme.space.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text variant="bodyStrong" tone="secondary">
            {t('common.cancel')}
          </Text>
        </Pressable>

        <Button
          label={t('settings.vehicleSave')}
          onPress={() =>
            onSave({
              type,
              brand: brand.trim() === '' ? null : brand.trim(),
              model: model.trim() === '' ? null : model.trim(),
              year: year === '' || yearInvalid ? null : parsedYear,
              plate: plate.trim() === '' ? null : plate.trim(),
            })
          }
          disabled={!canSave}
          loading={busy}
          style={{ flex: 1 }}
        />
      </View>

      {/*
        La suppression vit ici et non sur la carte : on ne supprime pas un
        véhicule en passant, on ouvre sa fiche d'abord. Elle est séparée par un
        filet, seule, en bas — comme la suppression de compte.
      */}
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({
            borderTopWidth: 1,
            borderTopColor: theme.colors.rule,
            paddingTop: theme.space.lg,
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text variant="bodyStrong" tone="primary">
            {t('settings.vehicleRemove')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
