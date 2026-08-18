import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { currentGrade, useDrivingStore } from '../stores/driving';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';
import { Measure } from './Measure';

/** Gabarit fixe : deux lignes de texte et leurs marges, rien qui puisse grandir. */
const HEIGHT = 88;

/**
 * La rangée de compteurs : ALERTES · DISTANCE · SCORE.
 *
 * Trois colonnes de largeur égale séparées par un filet — la même grammaire que
 * les cartes de réglages, à ceci près qu'ici les filets sont verticaux. C'est
 * ce qui permet de lire la rangée sans la parcourir : chaque valeur a sa place
 * fixe, et on va chercher celle qu'on veut par sa position, pas par son
 * libellé.
 *
 * **La distance ne se rafraîchit pas à 4 Hz.** Le sélecteur arrondit à la
 * dizaine de mètres avant de comparer : le store avance à chaque tick, mais
 * l'affichage ne se réveille que lorsque le chiffre affiché change réellement.
 * Sans cet arrondi, cette rangée re-rendrait quatre fois par seconde pour
 * afficher la même chaîne.
 */
export function SessionStats() {
  const theme = useTheme();
  const { t, formatDistance } = useI18n();

  const alertCount = useDrivingStore((state) => state.alerts.length);
  const distanceM = useDrivingStore((state) => Math.round(state.distanceM / 10) * 10);
  const alerts = useDrivingStore((state) => state.alerts);

  const grade = currentGrade(alerts);

  /**
   * La couleur du grade porte l'information, le reste de la rangée est neutre.
   *
   * A et B en vert, C en ambre, D et E en rouge : c'est la seule valeur des
   * trois qui soit un **jugement** et non une mesure, et la lire d'un coup
   * d'œil suppose de ne pas avoir à se rappeler où tombe la barre.
   */
  const gradeColor =
    grade === 'A' || grade === 'B'
      ? theme.colors.success
      : grade === 'C'
        ? theme.colors.warning
        : theme.colors.primary;

  return (
    <View
      style={{
        flexDirection: 'row',
        height: HEIGHT,
        marginHorizontal: theme.space.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
      }}
    >
      <Cell label={t('driving.alerts')} announce={`${alertCount} ${t('driving.alerts')}`}>
        <Text variant="numLg" numberOfLines={1}>
          {alertCount}
        </Text>
      </Cell>

      <Divider />

      <Cell
        label={t('driving.distance')}
        announce={`${t('driving.distance')} ${formatDistance(distanceM)}`}
      >
        <Measure formatted={formatDistance(distanceM)} variant="numLg" color={theme.colors.ink} />
      </Cell>

      <Divider />

      <Cell label={t('driving.score')} announce={`${t('driving.score')} ${grade}`}>
        <Text variant="numLg" style={{ color: gradeColor }} numberOfLines={1}>
          {grade}
        </Text>
      </Cell>
    </View>
  );
}

function Cell({
  label,
  announce,
  children,
}: {
  label: string;
  /**
   * Ce que le lecteur d'écran énonce pour la colonne entière.
   *
   * La colonne est un seul élément d'accessibilité — sans quoi « 24 » et
   * « DISTANCE » seraient annoncés en deux arrêts séparés, dans un ordre qui
   * n'a de sens que pour l'œil.
   */
  announce: string;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.xs,
        paddingHorizontal: theme.space.sm,
      }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={announce}
    >
      {children}
      {/*
        Même raison qu'au compteur : l'intitulé passe en encre secondaire pour
        rester lisible sur la surface blanche du thème clair. La hiérarchie ne
        souffre pas — trente points de mono contre onze de Bebas, l'écart de
        taille dit déjà lequel des deux on lit en premier.
      */}
      <Text variant="lblb" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Le filet ne touche pas les bords de la carte.
 *
 * Il sépare deux colonnes, il ne découpe pas le cadre : posé du haut au bas, il
 * lirait comme trois cartes accolées au lieu d'une rangée.
 */
function Divider() {
  const theme = useTheme();

  return (
    <View
      style={{
        width: 1,
        marginVertical: theme.space.lg,
        backgroundColor: theme.colors.rule,
      }}
    />
  );
}
