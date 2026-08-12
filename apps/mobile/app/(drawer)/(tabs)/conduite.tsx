import { useI18n } from '../../../src/i18n/I18nProvider';
import { ComingSoon } from '../../../src/screens/ComingSoon';

/**
 * Mode conduite.
 *
 * Le moteur d'alertes et le store de session existent déjà (`src/driving/`) ;
 * c'est l'écran qui manque. Tant qu'il manque, on l'annonce en une phrase
 * plutôt qu'en note d'atelier.
 */
export default function ConduiteScreen() {
  const { t } = useI18n();

  return <ComingSoon title={t('soon.drivingTitle')} lead={t('soon.drivingLead')} />;
}
