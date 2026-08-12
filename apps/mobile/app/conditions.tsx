import { useI18n } from '../src/i18n/I18nProvider';
import { LegalPage, LegalSection } from '../src/screens/LegalPage';

/**
 * Conditions d'utilisation.
 *
 * Le point le plus important est celui du paiement : aucun garagiste inscrit
 * n'est autorisé à réclamer un acompte pour se déplacer. C'est la règle qui
 * protège d'une arnaque courante, et elle a sa place dans les conditions comme
 * dans l'écran Sécurité.
 */
export default function ConditionsScreen() {
  const { t } = useI18n();

  return (
    <LegalPage title={t('terms.title')} intro={t('terms.intro')}>
      <LegalSection label={t('terms.role')} points={[t('terms.role1'), t('terms.role2')]} />
      <LegalSection
        label={t('terms.payment')}
        points={[t('terms.payment1'), t('terms.payment2')]}
      />
      <LegalSection
        label={t('terms.requests')}
        points={[t('terms.requests1'), t('terms.requests2'), t('terms.requests3')]}
      />
      <LegalSection
        label={t('terms.loyalty')}
        points={[t('terms.loyalty1'), t('terms.loyalty2')]}
      />
      <LegalSection
        label={t('terms.account')}
        points={[t('terms.account1'), t('terms.account2')]}
      />
    </LegalPage>
  );
}
