import { View } from 'react-native';
import type { ServiceMode } from '@geocras/shared';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';
import { useTheme } from '../theme/ThemeProvider';
import { CarIcon, TowTruckIcon } from './icons';
import { Text } from './Text';

/**
 * Qui se déplace, dans la file du garagiste.
 *
 * **Ne s'affiche que sur `at_garage`**, et l'omission est le sujet du
 * composant. Le déplacement du dépanneur est le cas fondateur : le marquer sur
 * chaque ligne en ferait un ornement permanent qu'on cesse de voir — le même
 * raisonnement qui réserve le bandeau rouge au seul danger. Ce qui mérite un
 * signe, c'est l'exception : une demande où personne n'attend le camion.
 *
 * Le défaut silencieux est par ailleurs le défaut **sûr**. Un garagiste qui
 * ignore que ce marqueur existe lit une ligne nue et suppose qu'il doit y
 * aller — ce qui est exact. L'inverse, un marqueur manqué signifiant « restez
 * chez vous », aurait envoyé une dépanneuse pour rien.
 *
 * Ni rouge ni jaune : l'échelle de couleurs appartient à l'urgence, et lui
 * emprunter une teinte pour dire autre chose la viderait de son sens. C'est
 * l'icône qui porte l'information — une voiture au lieu d'une dépanneuse.
 */
export function ServiceModeTag({ mode }: { mode: ServiceMode }) {
  const theme = useTheme();
  const { t } = useI18n();

  if (mode === 'on_site') return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: theme.colors.ink,
        paddingHorizontal: theme.space.sm,
        paddingVertical: 3,
      }}
    >
      <CarIcon color={theme.colors.ink} size={12} />
      <Text variant="lblb">{t('jobs.modeAtGarage')}</Text>
    </View>
  );
}

/**
 * Le même fait, en clair, sur la fiche.
 *
 * Ici les **deux** modes s'affichent, et c'est l'exact opposé de la règle de la
 * liste. La différence tient à ce qu'on fait de l'écran : on parcourt une file,
 * on s'engage sur une fiche. Devant un bouton « Accepter », une information
 * absente n'est pas un défaut sûr — c'est une supposition, et elle porte sur la
 * seule chose que le garagiste doit préparer avant de répondre : sortir un
 * véhicule, ou ne pas le sortir.
 *
 * Titre **et** conséquence, comme les contraintes matérielles juste en dessous.
 * « À l'atelier » se comprend ; « le client conduit jusqu'à vous » se prépare.
 */
export function ServiceModeBand({ mode }: { mode: ServiceMode }) {
  const theme = useTheme();
  const { t } = useI18n();

  const copy: Record<ServiceMode, { title: TranslationKey; lead: TranslationKey }> = {
    on_site: { title: 'jobs.modeOnSite', lead: 'jobs.modeOnSiteLead' },
    at_garage: { title: 'jobs.modeAtGarage', lead: 'jobs.modeAtGarageLead' },
  };

  const Icon = mode === 'on_site' ? TowTruckIcon : CarIcon;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        // Filet d'encre à gauche : la même grammaire que le filet d'urgence du
        // tableau de bord juste en dessous, en neutre. L'œil comprend qu'il
        // s'agit d'un fait de la demande, et non d'un réglage de l'écran.
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.ink,
        padding: theme.space.md,
      }}
    >
      <Icon color={theme.colors.ink} size={22} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="lblb">{t(copy[mode].title)}</Text>
        <Text variant="txt" tone="secondary">
          {t(copy[mode].lead)}
        </Text>
      </View>
    </View>
  );
}
