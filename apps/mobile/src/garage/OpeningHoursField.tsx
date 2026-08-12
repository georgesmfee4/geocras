import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import type { OpeningHours } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/SectionLabel';
import { Text } from '../ui/Text';
import { WEEK_DAYS, type WeekDay } from './hours';
import {
  copyToWeekdays,
  copyToWholeWeek,
  dayMode,
  dayRange,
  DAY_MODES,
  PICKER_HOURS,
  PICKER_MINUTES,
  setDayMode,
  setDayTime,
  type DayMode,
} from './openingHours';

export { areHoursValid, isValidTime } from './openingHours';

/** Horaires proposés par défaut — ceux d'un atelier de quartier à Yaoundé. */
export const DEFAULT_HOURS: OpeningHours = {
  mon: '08:00-18:00',
  tue: '08:00-18:00',
  wed: '08:00-18:00',
  thu: '08:00-18:00',
  fri: '08:00-18:00',
  sat: '08:00-14:00',
  sun: 'closed',
};

/** Jour et borne en cours de réglage, ou `null` quand le sélecteur est fermé. */
type Picking = { day: WeekDay; edge: 'open' | 'close' };

/**
 * Horaires de la semaine.
 *
 * Sept lignes, une par jour, et sur chacune les trois états possibles **écrits
 * côte à côte** : fermé, ouvert, 24 h. La version précédente les faisait
 * défiler en tapant sur le nom du jour — un geste que rien n'annonçait, et
 * qu'il fallait répéter deux fois pour atteindre « 24h ». Un garagiste qui
 * ferme le dimanche doit voir « Fermé » comme un bouton, pas le deviner.
 *
 * Les heures se choisissent dans une feuille, jamais au clavier. Un champ
 * texte qui attend `HH:MM` sur un pavé numérique produit des « 8 », des « 8h »
 * et des « 800 » ; une liste d'heures et de quarts ne produit que des horaires
 * valides, et se manœuvre au pouce.
 *
 * Les deux raccourcis du bas font le gros du travail : la plupart des ateliers
 * tiennent les mêmes heures du lundi au vendredi, et le samedi diffère du
 * reste. Recopier le lundi puis corriger une ligne est plus rapide que sept
 * réglages.
 *
 * Les heures sont en mono : ce sont des données mesurées, comme les distances
 * et les ETA.
 */
export function OpeningHoursField({
  value,
  onChange,
}: {
  value: OpeningHours;
  onChange: (next: OpeningHours) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  const [picking, setPicking] = useState<Picking | null>(null);

  const modeLabels: Record<DayMode, string> = {
    closed: t('hours.modeClosed'),
    range: t('hours.modeOpen'),
    '24h': t('hours.mode24h'),
  };

  return (
    <View style={{ gap: theme.space.md }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: theme.colors.rule,
          backgroundColor: theme.colors.surface,
        }}
      >
        {WEEK_DAYS.map((day, index) => {
          const mode = dayMode(value[day]);
          const { open, close } = dayRange(value[day]);

          return (
            <View
              key={day}
              style={{
                gap: theme.space.sm,
                paddingHorizontal: theme.space.md,
                paddingVertical: theme.space.md,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: theme.colors.rule,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
                <Text variant="h2" numberOfLines={1} style={{ width: 80 }}>
                  {t(`day.${day}`)}
                </Text>

                <View style={{ flex: 1 }}>
                  <ModeSwitch
                    value={mode}
                    labels={modeLabels}
                    dayLabel={t(`day.${day}`)}
                    onChange={(next) => onChange(setDayMode(value, day, next))}
                  />
                </View>
              </View>

              {mode === 'range' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
                  <TimeButton
                    caption={t('hours.from')}
                    value={open}
                    onPress={() => setPicking({ day, edge: 'open' })}
                    accessibilityLabel={`${t(`day.${day}`)} ${t('hours.from')} ${open}`}
                  />

                  <Text variant="numSm" tone="muted">
                    –
                  </Text>

                  <TimeButton
                    caption={t('hours.to')}
                    value={close}
                    onPress={() => setPicking({ day, edge: 'close' })}
                    accessibilityLabel={`${t(`day.${day}`)} ${t('hours.to')} ${close}`}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/*
        Raccourcis de recopie. Le lundi sert de modèle parce que c'est la
        première ligne du tableau : on la règle, on la diffuse, on retouche le
        samedi. « Lundi–vendredi » existe à part parce qu'il préserve le
        week-end, qui est justement celui qui diffère.
      */}
      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <Button
          label={t('hours.copyWeekdays')}
          accessibilityLabel={t('hours.copyWeekdaysA11y')}
          variant="outline"
          onPress={() => onChange(copyToWeekdays(value))}
          style={{ flex: 1 }}
        />
        <Button
          label={t('hours.copyWeek')}
          accessibilityLabel={t('hours.copyWeekA11y')}
          variant="outline"
          onPress={() => onChange(copyToWholeWeek(value))}
          style={{ flex: 1 }}
        />
      </View>

      <TimeSheet
        picking={picking}
        value={picking ? dayRange(value[picking.day])[picking.edge] : '08:00'}
        onCancel={() => setPicking(null)}
        onConfirm={(time) => {
          if (picking) onChange(setDayTime(value, picking.day, picking.edge, time));
          setPicking(null);
        }}
      />
    </View>
  );
}

/**
 * Les trois états d'un jour, en un bloc.
 *
 * Rayon zéro et filets entre les cellules, comme le sélecteur segmenté des
 * paramètres : le bloc se lit comme une rangée de touches. Il est plus court
 * que celui-là — sept exemplaires empilés — d'où le rattrapage de zone tactile
 * en `hitSlop`, qui rend au doigt les pixels que l'œil n'a pas.
 */
function ModeSwitch({
  value,
  labels,
  dayLabel,
  onChange,
}: {
  value: DayMode;
  labels: Record<DayMode, string>;
  dayLabel: string;
  onChange: (next: DayMode) => void;
}) {
  const theme = useTheme();
  const height = 38;
  const slop = Math.max(0, (MIN_TOUCH_TARGET - height) / 2);

  return (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: theme.colors.rule,
        backgroundColor: theme.colors.background,
      }}
    >
      {DAY_MODES.map((mode, index) => {
        const active = mode === value;

        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${dayLabel} — ${labels[mode]}`}
            hitSlop={{ top: slop, bottom: slop }}
            style={({ pressed }) => ({
              flex: 1,
              height,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.space.xs,
              // Encre et non rouge : c'est un état, pas une action. Le rouge
              // reste au bouton d'envoi et au SOS.
              backgroundColor: active ? theme.colors.ink : 'transparent',
              borderLeftWidth: index === 0 ? 0 : 1,
              borderLeftColor: theme.colors.rule,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {/*
              Sur l'aplat d'encre, le libellé prend la couleur de surface et non
              la teinte « inverse » : en thème sombre l'encre EST blanche, et
              « inverse » y rendrait du blanc sur blanc.
            */}
            <Text
              variant="smallStrong"
              numberOfLines={1}
              style={{ color: active ? theme.colors.surface : theme.colors.inkSecondary }}
            >
              {labels[mode]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Une borne de la plage, ouverte au réglage d'une tape. */
function TimeButton({
  caption,
  value,
  onPress,
  accessibilityLabel,
}: {
  caption: string;
  value: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        // Rayon 2 px : c'est un champ de saisie, et le chamfer y est interdit.
        borderRadius: theme.radius.field,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="caption" tone="muted">
        {caption}
      </Text>
      <Text variant="monoStrong">{value}</Text>
    </Pressable>
  );
}

/**
 * Sélecteur d'heure.
 *
 * Deux colonnes — l'heure, puis le quart — plutôt qu'une liste de quatre-vingt-
 * seize lignes : on atteint « 17:30 » en deux tapes au lieu d'un long
 * défilement. Les quarts d'heure suffisent ; un atelier n'ouvre pas à 08:07.
 *
 * La feuille garde le choix en attente et ne le valide qu'au bouton : une tape
 * mal placée sur une liste qui défile ne doit pas refermer l'écran sur une
 * heure qu'on n'a pas voulue.
 */
function TimeSheet({
  picking,
  value,
  onCancel,
  onConfirm,
}: {
  picking: Picking | null;
  value: string;
  onCancel: () => void;
  onConfirm: (time: string) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');

  /**
   * Position de départ, resynchronisée à chaque ouverture.
   *
   * `useState` seul garderait l'heure du jour précédent ; un `useEffect`
   * demanderait un rendu de plus avant d'afficher la bonne valeur. On compare
   * donc la clé d'ouverture pendant le rendu — le cas que React prévoit
   * explicitement pour un état dérivé d'une propriété.
   */
  const key = picking ? `${picking.day}:${picking.edge}:${value}` : null;
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Fermeture : on oublie la clé pour que la prochaine ouverture reparte de
  // l'heure enregistrée, et non du dernier défilement abandonné.
  if (key === null && lastKey !== null) setLastKey(null);

  if (key !== null && key !== lastKey) {
    setLastKey(key);
    setHour(value.slice(0, 2));
    // Une heure venue d'ailleurs peut tomber hors des quarts : on la rabat sur
    // le quart précédent plutôt que d'afficher une colonne sans sélection.
    const minutes = Number(value.slice(3, 5));
    setMinute(PICKER_MINUTES[Math.floor(minutes / 15)] ?? '00');
  }

  const title = picking
    ? `${t(`day.${picking.day}`)} · ${picking.edge === 'open' ? t('hours.from') : t('hours.to')}`
    : '';

  return (
    <Modal visible={picking !== null} transparent animationType="slide" onRequestClose={onCancel}>
      {/* Le voile ferme la feuille : c'est le geste attendu, et il évite
          d'imposer une croix de plus en haut à droite. */}
      <Pressable
        onPress={onCancel}
        accessibilityLabel={t('common.close')}
        style={{ flex: 1, backgroundColor: theme.colors.overlay }}
      />

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.sheet,
          borderTopRightRadius: theme.radius.sheet,
          padding: theme.space.xl,
          gap: theme.space.lg,
        }}
      >
        <SectionLabel>{title}</SectionLabel>

        <View style={{ flexDirection: 'row', gap: theme.space.md, height: 216 }}>
          <Column
            caption={t('hours.hourColumn')}
            options={PICKER_HOURS}
            value={hour}
            onChange={setHour}
          />
          <Column
            caption={t('hours.minuteColumn')}
            options={PICKER_MINUTES}
            value={minute}
            onChange={setMinute}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: theme.space.md }}>
          <Button
            label={t('common.cancel')}
            variant="outline"
            onPress={onCancel}
            style={{ flex: 1 }}
          />
          <Button
            label={t('hours.confirm')}
            onPress={() => onConfirm(`${hour}:${minute}`)}
            style={{ flex: 1.4 }}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Une colonne du sélecteur : les heures, ou les quarts d'heure. */
function Column({
  caption,
  options,
  value,
  onChange,
}: {
  caption: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, gap: theme.space.sm }}>
      <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
        {caption}
      </Text>

      <ScrollView
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: theme.colors.rule,
          backgroundColor: theme.colors.background,
        }}
        contentContainerStyle={{ paddingVertical: theme.space.xs }}
        showsVerticalScrollIndicator={false}
      >
        {options.map((option) => {
          const active = option === value;

          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option}
              style={({ pressed }) => ({
                minHeight: MIN_TOUCH_TARGET,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? theme.colors.ink : 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                variant="monoStrong"
                style={{ color: active ? theme.colors.surface : theme.colors.ink }}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
