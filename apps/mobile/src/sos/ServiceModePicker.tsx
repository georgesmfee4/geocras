import { Pressable, View } from 'react-native';
import { SERVICE_MODE_LABELS, SERVICE_MODES, type Locale, type ServiceMode } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';
import { CarIcon, TowTruckIcon } from '../ui/icons';
import { Text } from '../ui/Text';

/**
 * Comment la rencontre va se faire.
 *
 * Le champ le plus conséquent du formulaire, et pourtant le plus simple à
 * répondre : *est-ce que votre véhicule peut encore rouler jusqu'à un garage ?*
 * De cette seule réponse découlent le téléphone qui trace, l'écran de suivi,
 * l'itinéraire, les libellés d'état et la preuve d'arrivée.
 *
 * ---
 *
 * **Deux lignes empilées, et non deux touches côte à côte.**
 *
 * L'urgence juste au-dessus se choisit en trois touches d'un mot, parce qu'un
 * mot suffit : « danger » se comprend seul. Ici non — « je vais au garage »
 * n'apprend rien à quelqu'un qui n'a pas encore compris qu'il y a deux
 * scénarios possibles. Chaque option porte donc sa conséquence en clair, ce qui
 * demande une ligne entière, ce qui impose l'empilement.
 *
 * L'icône fait le reste du travail : une dépanneuse contre une voiture, et le
 * sens du déplacement se lit avant le texte.
 *
 * ---
 *
 * **Les deux options restent toujours touchables.**
 *
 * Une version antérieure masquait le sélecteur derrière une phrase dès que le
 * véhicule était déclaré immobilisé — c'est-à-dire **par défaut**, puisque
 * c'est la valeur initiale du formulaire. La section s'affichait donc, avec son
 * intitulé, mais sans rien à toucher : on y lisait un réglage figé là où il
 * fallait lire un choix, et la fonction paraissait cassée.
 *
 * La cohérence avec « véhicule immobilisé » est tenue par l'appelant, qui
 * ajuste l'autre champ dans les deux sens — choisir l'atelier lève
 * l'immobilisation, la cocher ramène le mode sur place. Aucune combinaison
 * impossible ne peut donc être composée, et aucune option n'a besoin d'être
 * éteinte pour l'empêcher. La règle reste par ailleurs tenue côté serveur et
 * en base — cf. `isServiceModeAllowed`.
 */
export function ServiceModePicker({
  value,
  locale,
  onChange,
}: {
  value: ServiceMode;
  locale: Locale;
  onChange: (next: ServiceMode) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  const leads: Record<ServiceMode, string> = {
    on_site: t('sos.modeOnSiteLead'),
    at_garage: t('sos.modeAtGarageLead'),
  };

  const icons = { on_site: TowTruckIcon, at_garage: CarIcon };

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.rule,
        backgroundColor: theme.colors.surface,
      }}
    >
      {SERVICE_MODES.map((mode, index) => {
        const active = value === mode;
        const Icon = icons[mode];

        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${SERVICE_MODE_LABELS[mode][locale]}. ${leads[mode]}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
              minHeight: MIN_TOUCH_TARGET + 12,
              paddingHorizontal: theme.space.md,
              paddingVertical: theme.space.md,
              // Le filet est posé par la ligne du dessous, jamais par la
              // première : même règle que `SettingsCard`, pour la même raison.
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: theme.colors.rule,
              // L'encre et non le rouge : le rouge de ce formulaire appartient
              // au danger et au bouton d'envoi. L'étendre à une sélection
              // ordinaire le viderait au moment où il doit alerter.
              backgroundColor: active ? theme.colors.ink : 'transparent',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Icon color={active ? theme.colors.surface : theme.colors.ink} size={22} />

            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h2b" tone={active ? 'inverse' : 'ink'}>
                {SERVICE_MODE_LABELS[mode][locale]}
              </Text>
              <Text
                variant="txt"
                tone={active ? 'inverse' : 'muted'}
                style={active ? { opacity: 0.75 } : undefined}
              >
                {leads[mode]}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
