import { useI18n } from '../../../src/i18n/I18nProvider';
import { ComingSoon } from '../../../src/screens/ComingSoon';

/**
 * Onglet garagiste : accepter une demande, se déclarer en route, confirmer
 * l'arrivée. Les routes serveur existent, l'écran reste à faire — et il vaut
 * mieux le dire au garagiste que de lui montrer une page d'atelier.
 */
export default function InterventionsScreen() {
  const { t } = useI18n();

  return <ComingSoon title={t('soon.jobsTitle')} lead={t('soon.jobsLead')} />;
}
