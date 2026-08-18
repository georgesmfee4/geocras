import { Pressable, View } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';
import { useI18n } from '../i18n/I18nProvider';
import type { SessionPhase } from '../stores/driving';
import { useTheme } from '../theme/ThemeProvider';
import { size } from '../theme/sizes';
import { BlinkingDot } from '../ui/BlinkingDot';
import { ChamferView } from '../ui/ChamferView';
import { Text } from '../ui/Text';

/**
 * Côté des deux boutons carrés.
 *
 * `size.btnSquare`, soit 56 : douze points au-dessus de la cible tactile
 * minimale, et ce n'est pas du luxe — ce sont les deux seules cibles de l'écran
 * qu'on vise **en conduisant**, du pouce, sans regarder.
 */
const BUTTON = size.btnSquare;

export type DrivingControlsProps = {
  phase: SessionPhase;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

/**
 * La barre de contrôle de la session.
 *
 * Trois zones, et leur ordre dit la hiérarchie : **Pause** à gauche, sous le
 * pouce ; l'**état** au milieu, qui ne se touche pas ; **Stop** à droite, seul
 * en rouge et seul chamfré.
 *
 * Le bloc central n'est pas un bouton et ne doit pas en avoir l'air — d'où le
 * contour sans remplissage, et l'absence de tout retour au toucher. C'est le
 * témoin d'enregistrement : sa pastille clignote tant que la session tourne,
 * elle se fige en pause. Un conducteur doit pouvoir vérifier d'un regard que
 * son trajet est bien en train d'être compté.
 *
 * Stop garde l'angle coupé alors que Pause ne l'a pas : c'est la seule action
 * irréversible de l'écran — elle clôt la session et l'envoie — et la charte
 * réserve précisément le chamfer aux boutons d'action rouges.
 *
 * Aucun état d'attente sur Stop, et ce n'est pas un oubli : la session est
 * close **localement** dès l'appui, l'envoi au serveur suit sans être attendu.
 * Toute la barre disparaît donc dans la frame suivante, et un indicateur de
 * chargement n'aurait fait que clignoter.
 */
export function DrivingControls({ phase, onPause, onResume, onStop }: DrivingControlsProps) {
  const theme = useTheme();
  const { t } = useI18n();

  const running = phase === 'running';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        paddingHorizontal: theme.space.lg,
      }}
    >
      <Pressable
        onPress={running ? onPause : onResume}
        accessibilityRole="button"
        accessibilityLabel={running ? t('driving.pause') : t('driving.resume')}
        style={({ pressed }) => ({
          width: BUTTON,
          height: BUTTON,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.rule,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {running ? (
          <Svg width={20} height={22} viewBox="0 0 20 22">
            <Rect x={1} y={0} width={6} height={22} fill={theme.colors.ink} />
            <Rect x={13} y={0} width={6} height={22} fill={theme.colors.ink} />
          </Svg>
        ) : (
          <Svg width={20} height={22} viewBox="0 0 20 22">
            <Polygon points="1,0 20,11 1,22" fill={theme.colors.ink} />
          </Svg>
        )}
      </Pressable>

      {/*
        Même matière que les deux boutons — surface et filet — et pas un cadre
        vide. Sur le noir, un contour seul se détachait du fond ; sur le blanc
        chaud, un filet à trois pour cent d'écart de luminance sur le fond de
        page ne se voit plus, et le bloc central se serait dissous entre deux
        tuiles bien posées.

        La barre se lit donc comme un seul objet de trois cases. Ce qui
        distingue celle du milieu n'est pas son matériau, c'est qu'elle ne
        bouge pas sous le doigt : aucun retour au toucher, aucun rôle de bouton.
      */}
      <View
        style={{
          flex: 1,
          height: BUTTON,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.md,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.rule,
        }}
        accessibilityRole="text"
      >
        {running ? (
          <BlinkingDot size={8} color={theme.colors.primary} />
        ) : (
          /*
            En pause, la pastille reste — mais elle ne clignote plus. Retirer le
            point aurait laissé le libellé seul et centré, c'est-à-dire une
            autre mise en page pour un même bloc ; l'éteindre dit exactement ce
            qui a changé.
          */
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.colors.muted,
            }}
          />
        )}

        <Text variant="h2b" numberOfLines={1} ellipsizeMode="tail">
          {running ? t('driving.recording') : t('driving.pause')}
        </Text>
      </View>

      <Pressable
        onPress={onStop}
        accessibilityRole="button"
        accessibilityLabel={t('driving.stop')}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <ChamferView
          fill={theme.colors.primary}
          style={{ width: BUTTON, height: BUTTON }}
          contentStyle={{
            width: BUTTON,
            height: BUTTON,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/*
            Le carré d'arrêt, blanc en dur : il est peint sur l'aplat primaire,
            qui est identique dans les deux thèmes. Le prendre dans `ink` le
            rendrait sombre en clair et blanc en sombre — donc invisible une
            fois sur deux sur ce rouge.

            Décalé de deux points vers le haut et la gauche : la coupe à 45°
            mange le coin inférieur droit, et un carré centré sur la boîte
            paraît glisser vers le vide qu'elle laisse.
          */}
          <View
            style={{
              width: 18,
              height: 18,
              backgroundColor: '#FFFFFF',
              marginRight: 2,
              marginBottom: 2,
            }}
          />
        </ChamferView>
      </Pressable>
    </View>
  );
}
