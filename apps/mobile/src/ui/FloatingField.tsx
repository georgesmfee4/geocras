import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

/**
 * Hauteur du champ.
 *
 * Deux points de moins que `FIELD_HEIGHT` (52) ne suffiraient pas : le libellé
 * remonté vient se poser **sur** le filet du haut, il faut que le texte saisi
 * reste centré sans le frôler. 56 est le minimum qui tienne les deux, cible
 * tactile largement dépassée.
 */
export const FLOATING_FIELD_HEIGHT = 56;

/**
 * Réduction du libellé une fois remonté.
 *
 * 0,72 sur `h2b` (16 px) donne 11,5 px — la taille de `lblb`, celle de tous les
 * intitulés du produit. Le libellé ne change donc pas de niveau typographique
 * en montant : il rejoint celui qui lui revient.
 */
const RAISED_SCALE = 0.72;

/**
 * Rembourrage horizontal de la pastille qui porte le libellé.
 *
 * C'est lui qui creuse l'encoche dans le filet du haut. Posé à gauche à
 * `space.sm`, il replace le libellé à `space.md` du bord — exactement l'aplomb
 * du texte saisi.
 */
const CHIP_PADDING = 4;

/** Durée de la montée. Assez courte pour suivre le doigt, assez longue pour se voir. */
const RAISE_MS = 150;

export type FloatingFieldProps = Omit<TextInputProps, 'placeholder' | 'placeholderTextColor'> & {
  label: string;
  /**
   * Exemple de saisie, montré **seulement** une fois le libellé remonté.
   *
   * Jamais à sa place : un champ qui affiche « Jean Djomo » sans dire ce qu'il
   * attend oblige à deviner, et l'exemple disparaît dès la première frappe —
   * au moment précis où on voudrait le relire.
   */
  example?: string;
  hint?: string;
  error?: string | null;
  /** Saisie en mono : numéros, plaques, tout ce qui se lit chiffre par chiffre. */
  mono?: boolean;
  /** Préfixe figé, révélé avec le libellé — le « +237 » du numéro camerounais. */
  prefix?: string;
  /** Bouton de fin de ligne : l'œil du mot de passe. */
  trailing?: ReactNode;
};

/**
 * Champ de saisie à libellé flottant.
 *
 * Le libellé tient lieu d'invite tant que le champ est vide et au repos, puis
 * remonte se poser sur le filet du haut dès qu'on y touche ou qu'il porte une
 * valeur. C'est le geste des formulaires Google, et il règle un défaut réel du
 * champ classique : l'invite disparaît à la première frappe, et l'intitulé
 * posé au-dessus coûte une ligne à chaque champ. Ici les deux sont le même
 * objet, et rien ne se perd en route.
 *
 * ---
 *
 * **L'encoche dans le filet.**
 *
 * Le libellé remonté croise la bordure du haut. Plutôt que d'interrompre le
 * tracé — impossible sur une `borderWidth` — il porte une pastille opaque qui
 * la masque : `surface` sur toute sa hauteur, et une moitié haute peinte au
 * fond de page qui **apparaît en même temps que la montée**. Au repos, la
 * pastille est entièrement dans le champ et se confond avec lui ; remontée,
 * chaque moitié se confond avec ce qu'elle recouvre. L'opacité de cette moitié
 * est donc animée par la même valeur que le mouvement, sans quoi on verrait un
 * carré de fond de page traverser le champ.
 *
 * **Le décalage horizontal est calculé, pas décoré.** React Native met
 * l'origine d'une transformation au centre : réduire le libellé le ferait
 * glisser vers la droite d'une demi-largeur perdue. On mesure donc la pastille
 * et on translate de `largeur × (1 − échelle) / 2` vers la gauche, ce qui fixe
 * son bord gauche. `transformOrigin` ferait la même chose en une ligne, mais
 * son sort avec le pilote natif dépend de la plateforme — un calcul de
 * translation, lui, est du transform pur et reste sur le fil natif.
 *
 * ---
 *
 * Le champ classique (`<TextField>`) reste en place partout ailleurs : cette
 * variante est née pour l'authentification, où il n'y a que trois champs et où
 * ils sont tout l'écran. La généraliser est un autre passage, écran par écran,
 * comme celui des polices.
 */
export function FloatingField({
  label,
  example,
  hint,
  error,
  mono = false,
  prefix,
  trailing,
  value,
  onFocus,
  onBlur,
  style,
  ...rest
}: FloatingFieldProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const input = useRef<TextInput>(null);

  const [focused, setFocused] = useState(false);
  const [chipWidth, setChipWidth] = useState(0);

  const raised = focused || (value ?? '').length > 0;

  // Valeur initiale et non zéro : un champ pré-rempli — le numéro qu'on
  // reconnecte — doit s'ouvrir libellé déjà en haut, sans animation d'entrée.
  const raise = useRef(new Animated.Value(raised ? 1 : 0)).current;

  useEffect(() => {
    const move = Animated.timing(raise, {
      toValue: raised ? 1 : 0,
      duration: reducedMotion ? 0 : RAISE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    move.start();
    return () => move.stop();
  }, [raised, raise, reducedMotion]);

  /**
   * Trois états de filet, dans cet ordre de priorité : l'erreur l'emporte sur
   * la sélection, qui l'emporte sur le repos. Épaisseur constante — la faire
   * grossir à la sélection décalerait le texte saisi d'un demi-point à chaque
   * appui.
   */
  const border = error ? theme.colors.primary : focused ? theme.colors.ink : theme.colors.rule;

  const labelColor = error
    ? theme.colors.primary
    : focused
      ? theme.colors.ink
      : raised
        ? theme.colors.inkSecondary
        : theme.colors.muted;

  const translateY = raise.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -FLOATING_FIELD_HEIGHT / 2],
  });
  const translateX = raise.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(chipWidth * (1 - RAISED_SCALE)) / 2],
  });
  const scale = raise.interpolate({ inputRange: [0, 1], outputRange: [1, RAISED_SCALE] });

  const measureChip = (event: LayoutChangeEvent): void => {
    const measured = event.nativeEvent.layout.width;
    setChipWidth((current) => (Math.abs(current - measured) < 0.5 ? current : measured));
  };

  return (
    <View style={{ gap: theme.space.sm }}>
      {/*
        Toute la boîte donne le focus, pas seulement les quelques points où le
        `<TextInput>` tombe sous le doigt. Le rembourrage, la zone du préfixe et
        la marge autour du libellé en font partie — au bord d'une route, viser
        un rectangle de texte est un luxe.
      */}
      <Pressable
        onPress={() => input.current?.focus()}
        accessible={false}
        style={{ overflow: 'visible' }}
      >
        <View
          style={{
            height: FLOATING_FIELD_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: border,
            borderRadius: theme.radius.field,
          }}
        >
          {prefix ? (
            /*
              Le préfixe n'existe que libellé remonté : au repos, « +237 » et
              « NUMÉRO DE TÉLÉPHONE » se disputeraient la même place. Il garde
              sa largeur en permanence — on anime l'opacité, pas la mise en
              page — pour que rien ne saute au moment où le champ prend le
              focus.
            */
            <Animated.View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: theme.space.md,
                opacity: raise,
              }}
              pointerEvents="none"
            >
              <Text variant="monoStrong" tone="secondary">
                {prefix}
              </Text>
              <View
                style={{
                  width: 1,
                  height: 20,
                  marginLeft: theme.space.md,
                  backgroundColor: theme.colors.rule,
                }}
              />
            </Animated.View>
          ) : null}

          {/*
            Même règle que partout : la saisie ne suit pas la taille de police
            du système. La boîte a une hauteur fixe, un texte agrandi y serait
            rogné.

            Les chiffres passent en `num` — mono, 16 px — et non à la taille du
            texte courant : un numéro se relit chiffre par chiffre quand on le
            dicte au garagiste, et c'est le seul endroit du champ où deux points
            de plus se justifient.
          */}
          <TextInput
            ref={input}
            allowFontScaling={false}
            value={value}
            placeholder={raised ? example : undefined}
            placeholderTextColor={theme.colors.muted}
            accessibilityLabel={label}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            style={[
              {
                flex: 1,
                height: '100%',
                paddingHorizontal: theme.space.md,
                fontFamily: mono ? theme.type.num.fontFamily : theme.type.txt.fontFamily,
                fontSize: mono ? theme.type.num.fontSize : theme.type.txt.fontSize,
                letterSpacing: mono ? 1 : 0,
                color: theme.colors.ink,
              },
              style,
            ]}
            {...rest}
          />

          {trailing ? <View style={{ paddingRight: theme.space.xs }}>{trailing}</View> : null}
        </View>

        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: theme.space.sm,
            top: 0,
            height: FLOATING_FIELD_HEIGHT,
            justifyContent: 'center',
            transform: [{ translateX }, { translateY }, { scale }],
          }}
        >
          <View
            onLayout={measureChip}
            style={{ paddingHorizontal: CHIP_PADDING, backgroundColor: theme.colors.surface }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: '50%',
                backgroundColor: theme.colors.background,
                opacity: raise,
              }}
            />
            <Text variant="h2b" numberOfLines={1} style={{ color: labelColor }}>
              {label}
            </Text>
          </View>
        </Animated.View>
      </Pressable>

      {/*
        L'erreur remplace l'aide au lieu de s'y ajouter — même règle que
        `<TextField>` : deux lignes sous un champ, dont une qui ne s'applique
        plus, se lisent mal debout au soleil.

        L'aide est en `footnote`, l'erreur en `txt`. Ce n'est pas une
        inconséquence : l'aide est une consigne qu'on relit d'un coup d'œil et
        qui doit s'effacer, l'erreur est une phrase qui vient du serveur, peut
        être longue, et doit se lire.
      */}
      {error ? (
        <Text variant="txt" tone="primary">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
