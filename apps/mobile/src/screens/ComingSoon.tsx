import type { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { env } from '../config/env';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';

/**
 * Écran dont la fonction n'est pas encore ouverte.
 *
 * Remplace l'ancien `Placeholder`, qui affichait « À CONSTRUIRE » suivi du **nom
 * de fichier de la maquette** — `04-itineraire-suivi.png`. C'était une note
 * d'atelier laissée dans l'interface : elle ne disait rien à l'utilisateur, et
 * elle disait tout à celui qui se demandait s'il tenait un produit ou une
 * démonstration. Or l'un de ces écrans s'ouvre juste après l'envoi d'un SOS.
 *
 * Ce qui reste : le titre de l'écran, une phrase qui annonce ce qui arrive, et
 * le numéro de l'assistance — parce que quelqu'un qui atterrit ici pendant une
 * panne a besoin d'un humain, pas d'une explication.
 *
 * `children` reçoit ce que l'écran sait déjà faire. Le suivi d'intervention, par
 * exemple, affiche de vraies données temps réel sous ce bandeau.
 */
export function ComingSoon({
  title,
  lead,
  children,
}: {
  title: string;
  /** Une phrase, propre à l'écran, sur ce qui s'y trouvera. */
  lead: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title={title} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.xl,
          paddingTop: theme.space.xl,
          paddingBottom: theme.space.xxxl,
          gap: theme.space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="body" tone="secondary">
          {lead}
        </Text>

        {children}

        <Pressable
          onPress={() => void Linking.openURL(`tel:${env.supportPhone}`)}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{ gap: 2 }}>
            <Text variant="bodyStrong" tone="primary">
              {t('common.callSupport')}
            </Text>
            {/* Le numéro en mono : c'est ce qu'on lit à voix haute pour le composer. */}
            <Text variant="monoSmall" tone="muted">
              {env.supportPhone}
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
