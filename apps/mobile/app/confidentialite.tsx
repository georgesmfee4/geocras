import { useI18n } from '../src/i18n/I18nProvider';
import { LegalPage, LegalSection } from '../src/screens/LegalPage';

/**
 * Règles de confidentialité.
 *
 * Atteignable **sans compte** : c'est avant de s'inscrire qu'on veut savoir ce
 * qui est collecté. Chaque point décrit un comportement réel du produit —
 * position transmise au seul garage retenu et seulement pendant l'intervention,
 * contacts de confiance qui ne quittent pas l'appareil, suppression de compte
 * qui efface vraiment.
 */
export default function ConfidentialiteScreen() {
  const { t } = useI18n();

  return (
    <LegalPage title={t('privacy.title')} intro={t('privacy.intro')}>
      <LegalSection
        label={t('privacy.collect')}
        points={[
          t('privacy.collect1'),
          t('privacy.collect2'),
          t('privacy.collect3'),
          t('privacy.collect4'),
        ]}
      />
      <LegalSection
        label={t('privacy.position')}
        points={[t('privacy.position1'), t('privacy.position2')]}
      />
      <LegalSection
        label={t('privacy.garage')}
        points={[t('privacy.garage1'), t('privacy.garage2'), t('privacy.garage3')]}
      />
      <LegalSection label={t('privacy.device')} points={[t('privacy.device1')]} />
      <LegalSection
        label={t('privacy.rights')}
        points={[t('privacy.rights1'), t('privacy.rights2')]}
      />
    </LegalPage>
  );
}
