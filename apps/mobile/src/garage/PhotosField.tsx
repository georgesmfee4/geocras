import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, View } from 'react-native';
import { uploadPhoto } from '../api/uploadPhoto';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { CameraIcon, TrashIcon } from '../ui/icons';
import { Text } from '../ui/Text';

/** Même compression que la photo de panne : au-delà, on téléverse du poids pour rien. */
const QUALITY = 0.55;

/** Plafond aligné sur `createMyGarageBodySchema` — le serveur refuserait la septième. */
export const MAX_PHOTOS = 6;

const TILE = 96;

/**
 * Photos du garage.
 *
 * Elles sont facultatives et le restent : un atelier qui a trois clients en
 * attente ne s'arrête pas pour photographier sa devanture. Mais elles pèsent
 * lourd dans la décision d'un client qui compare deux garages inconnus, d'où
 * leur place dans le formulaire d'inscription plutôt qu'un ajout ultérieur
 * qu'on ne fait jamais.
 *
 * Chaque photo part vers Cloudinary **dès sa sélection**, comme celle d'un SOS :
 * le formulaire est long, et l'attente se paie pendant qu'on remplit le reste
 * plutôt qu'au moment d'appuyer sur « Envoyer ».
 */
export function PhotosField({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const remaining = MAX_PHOTOS - urls.length;
  const full = remaining <= 0;

  const add = async (source: 'camera' | 'library'): Promise<void> => {
    setBusy(true);
    setFailed(false);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(t('becomeGarage.photos'), t('account.photoPermission'));
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: QUALITY,
              allowsEditing: false,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: QUALITY,
              // Une devanture, la fosse, l'atelier, l'enseigne : les photos
              // d'un garage se prennent en série et se choisissent en série.
              // Les demander une par une, c'est rouvrir la galerie six fois —
              // et n'en poser qu'une.
              //
              // `allowsEditing` est volontairement absent : la documentation
              // Expo le donne exclusif de la sélection multiple.
              allowsMultipleSelection: true,
              selectionLimit: remaining,
            });

      if (result.canceled) return;

      // `selectionLimit` n'est pas honoré partout — le web l'ignore. On
      // retaille donc nous-mêmes plutôt que d'envoyer une septième photo que
      // `createMyGarageBodySchema` refuserait.
      const assets = result.assets.slice(0, remaining);

      /**
       * Téléversement un par un, et affichage au fil de l'eau.
       *
       * En série et non en parallèle : six requêtes simultanées sur une 3G de
       * quartier se gênent entre elles et échouent ensemble. Chaque photo
       * aboutie s'affiche aussitôt — le formulaire montre donc son avancement
       * au lieu d'un rond qui tourne pendant une minute.
       *
       * `urls` reste la liste du rendu en cours : la vignette ajoutée à
       * l'instant y manque, d'où l'accumulateur local.
       */
      const added: string[] = [];
      let anyFailed = false;

      for (const asset of assets) {
        const uploaded = await uploadPhoto(asset.uri, 'garages');
        if (uploaded.skipped) {
          anyFailed = true;
          continue;
        }
        added.push(uploaded.url);
        onChange([...urls, ...added].slice(0, MAX_PHOTOS));
      }

      // Un échec partiel se dit : cinq photos sur six passées, sans un mot,
      // laisserait croire que la sixième n'a jamais été choisie.
      if (anyFailed) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const choose = (): void => {
    Alert.alert(t('becomeGarage.photos'), undefined, [
      { text: t('account.photoTake'), onPress: () => void add('camera') },
      { text: t('account.photoChooseMany'), onPress: () => void add('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <View style={{ gap: theme.space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        {urls.map((url) => (
          <View key={url} style={{ width: TILE, height: TILE }}>
            <Image
              source={{ uri: url }}
              style={{ width: TILE, height: TILE, backgroundColor: theme.colors.rule }}
              accessibilityIgnoresInvertColors
            />

            <Pressable
              onPress={() => onChange(urls.filter((each) => each !== url))}
              accessibilityRole="button"
              accessibilityLabel={t('account.photoRemove')}
              hitSlop={8}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 28,
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.overlay,
              }}
            >
              <TrashIcon color="#FFFFFF" size={14} />
            </Pressable>
          </View>
        ))}

        {!full ? (
          <Pressable
            onPress={choose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('becomeGarage.photoAdd')}
            style={({ pressed }) => ({
              width: TILE,
              height: TILE,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.space.xs,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.rule,
              // Le pointillé distingue l'emplacement vide de la photo posée,
              // sans avoir à écrire « ajouter » sept fois.
              borderStyle: 'dashed',
              opacity: busy ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            {busy ? (
              <ActivityIndicator size="small" color={theme.colors.inkSecondary} />
            ) : (
              <>
                <CameraIcon color={theme.colors.inkSecondary} size={20} />
                <Text variant="caption" tone="secondary">
                  {t('becomeGarage.photoAdd')}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {failed ? (
        <Text variant="small" tone="warning">
          {t('account.photoFailed')}
        </Text>
      ) : (
        <Text variant="small" tone="muted">
          {t('becomeGarage.photosHint')}
        </Text>
      )}
    </View>
  );
}
