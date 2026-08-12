import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { CameraIcon, TrashIcon } from '../ui/icons';
import { Text } from '../ui/Text';

export type PhotoFieldProps = {
  /** URI locale de la photo choisie, ou `null`. */
  uri: string | null;
  /**
   * Où en est le téléversement.
   *
   * Il démarre à la sélection, pas à l'envoi du SOS : c'est ici, pendant que
   * l'utilisateur remplit le reste du formulaire, que l'attente est gratuite.
   */
  state: 'idle' | 'uploading' | 'ready' | 'unavailable' | 'failed';
  onChange: (uri: string | null) => void;
};

/**
 * Compression appliquée avant l'envoi.
 *
 * 0,55 sur une photo redimensionnée par le sélecteur ramène une prise de vue
 * de téléphone autour de 150 à 300 Ko. C'est le seul réglage qui compte ici :
 * la photo part sur le réseau mobile de quelqu'un en panne, qui n'a ni le
 * temps ni forcément le forfait pour téléverser 4 Mo. La qualité restante
 * suffit largement à montrer un pneu éclaté ou un moteur qui fume.
 */
const QUALITY = 0.55;

/**
 * Photo de la panne.
 *
 * Facultative, et volontairement placée **après** le choix de la panne : c'est
 * un complément, jamais un préalable. Elle sert à deux choses concrètes —
 * permettre au garagiste de juger s'il a la pièce avant de se déplacer, et
 * servir de constat en cas de litige sur l'état du véhicule à l'arrivée.
 *
 * Deux sources sont proposées plutôt qu'une seule : on prend rarement une
 * photo au moment de la panne, et l'utilisateur peut avoir déjà photographié
 * le problème avant d'ouvrir l'app.
 */
export function PhotoField({ uri, state, onChange }: PhotoFieldProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const capture = async (source: 'camera' | 'library'): Promise<void> => {
    setBusy(true);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(t('sos.photo'), t('sos.photoPermission'));
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: QUALITY,
        // Pas de recadrage imposé : demander de cadrer une image à quelqu'un
        // au bord d'une route est une étape de plus pour aucun bénéfice.
        allowsEditing: false,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      const asset = result.canceled ? null : result.assets[0];
      if (asset) onChange(asset.uri);
    } catch {
      // Un sélecteur qui échoue ne doit pas interrompre la déclaration.
      Alert.alert(t('sos.photo'), t('sos.photoFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (uri) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <Image
          source={{ uri }}
          style={{ width: 72, height: 72, backgroundColor: theme.colors.rule }}
          accessibilityIgnoresInvertColors
        />

        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{t('sos.photoAttached')}</Text>

          {/*
            L'état est dit ici et nulle part ailleurs. Le signaler au moment
            de l'envoi, comme avant, revenait à annoncer « la demande part sans
            la photo » une seconde avant que la demande échoue elle aussi.
          */}
          {state === 'uploading' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              <ActivityIndicator size="small" color={theme.colors.inkSecondary} />
              <Text variant="small" tone="secondary">
                {t('sos.photoUploading')}
              </Text>
            </View>
          ) : state === 'unavailable' ? (
            // Rien à réessayer : c'est une clé absente sur le serveur.
            <Text variant="small" tone="warning">
              {t('sos.photoNotConfigured')}
            </Text>
          ) : state === 'failed' ? (
            <Text variant="small" tone="warning">
              {t('sos.photoUnavailable')}
            </Text>
          ) : state === 'ready' ? (
            <Text variant="small" tone="success">
              {t('sos.photoReady')}
            </Text>
          ) : (
            <Text variant="small" tone="muted">
              {t('sos.photoOptional')}
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => onChange(null)}
          accessibilityRole="button"
          accessibilityLabel={t('sos.photoRemove')}
          hitSlop={12}
          style={{ padding: theme.space.sm }}
        >
          <TrashIcon color={theme.colors.primary} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.md }}>
      <SourceButton
        label={t('sos.photoTake')}
        disabled={busy}
        onPress={() => void capture('camera')}
      />
      <SourceButton
        label={t('sos.photoChoose')}
        disabled={busy}
        onPress={() => void capture('library')}
      />
    </View>
  );
}

function SourceButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.sm,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <CameraIcon color={theme.colors.inkSecondary} size={19} />
      <Text variant="smallStrong" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
