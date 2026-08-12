import { View } from 'react-native';
import type { OpeningHours } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';
import { useTheme } from '../theme/ThemeProvider';
import { Text, type TextTone } from '../ui/Text';
import { currentWeekDay, formatOpeningRange, todayRange, WEEK_DAYS, type WeekDay } from './hours';

const DAY_LABELS: Readonly<Record<WeekDay, TranslationKey>> = {
  mon: 'day.mon',
  tue: 'day.tue',
  wed: 'day.wed',
  thu: 'day.thu',
  fri: 'day.fri',
  sat: 'day.sat',
  sun: 'day.sun',
};

export type StatStripProps = {
  openNow: boolean;
  openingHours: OpeningHours | null;
  yearsInBusiness: number | null;
  towing: boolean;
};

/**
 * Les trois chiffres de la maquette 05, séparés par des filets d'un pixel.
 *
 * Trois questions qu'on se pose avant toute autre devant un garage inconnu :
 * est-il ouvert, depuis combien de temps existe-t-il, peut-il remorquer. Toutes
 * les valeurs sont en mono — ce sont des mesures — et les intitulés en Inter.
 *
 * Le remorquage a droit au vert : c'est la seule des trois cellules dont la
 * réponse change une décision. Un véhicule immobilisé devant un garage qui ne
 * remorque pas, c'est un déplacement pour rien.
 */
export function StatStrip({ openNow, openingHours, yearsInBusiness, towing }: StatStripProps) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  const today = todayRange(openingHours, locale);

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
      }}
    >
      <StatCell
        value={today ?? '—'}
        label={openNow ? t('garage.open') : t('garage.closed')}
        labelTone={openNow ? 'success' : 'warning'}
      />
      <View style={{ width: 1, backgroundColor: theme.colors.rule }} />
      <StatCell
        value={
          yearsInBusiness === null
            ? '—'
            : `${yearsInBusiness} ${t(yearsInBusiness > 1 ? 'garage.years' : 'garage.yearsOne')}`
        }
        label={t('garage.trade')}
      />
      <View style={{ width: 1, backgroundColor: theme.colors.rule }} />
      <StatCell
        value={towing ? t('garage.yes') : t('garage.no')}
        valueTone={towing ? 'success' : 'muted'}
        label={t('garage.towing')}
      />
    </View>
  );
}

function StatCell({
  value,
  label,
  valueTone = 'ink',
  labelTone = 'secondary',
}: {
  value: string;
  label: string;
  valueTone?: TextTone;
  labelTone?: TextTone;
}) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, paddingVertical: theme.space.md, alignItems: 'center', gap: 2 }}>
      <Text variant="monoStrong" tone={valueTone} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" tone={labelTone} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * La semaine entière, jour courant mis en avant.
 *
 * Sept lignes plutôt qu'un dépliant : elles tiennent en un écran, et quelqu'un
 * qui prévoit de passer demain matin n'a pas à toucher quoi que ce soit pour le
 * savoir. Le jour courant est en encre, les autres en secondaire — la
 * hiérarchie porte l'information, sans surligneur ni pastille.
 */
export function OpeningHoursTable({ hours }: { hours: OpeningHours | null }) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  const today = currentWeekDay();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
      }}
    >
      {WEEK_DAYS.map((day, index) => {
        const range = hours ? formatOpeningRange(hours[day], locale) : null;
        const isToday = day === today;

        return (
          <View
            key={day}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: theme.space.md,
              paddingVertical: theme.space.sm + 2,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: theme.colors.rule,
            }}
          >
            <Text
              variant={isToday ? 'bodyStrong' : 'body'}
              tone={isToday ? 'ink' : 'secondary'}
              style={{ flex: 1 }}
            >
              {t(DAY_LABELS[day])}
            </Text>

            {/* Fermé n'est pas une heure : ça reste en Inter, quand une plage
                horaire passe en mono comme toute donnée mesurée. */}
            {range ? (
              <Text variant={isToday ? 'monoStrong' : 'mono'} tone={isToday ? 'ink' : 'secondary'}>
                {range}
              </Text>
            ) : (
              <Text variant="small" tone="muted">
                {t('garage.closed')}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
