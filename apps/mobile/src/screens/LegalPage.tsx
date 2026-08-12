import type { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { env } from '../config/env';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { ScreenHeader } from '../ui/ScreenHeader';
import { SectionLabel } from '../ui/SectionLabel';
import { Text } from '../ui/Text';

/**
 * Page de texte légal.
 *
 * Elle décrit **ce que l'application fait réellement**, vérifiable ligne à ligne
 * dans le code : quelles données partent, à qui, à quel moment. Rien n'y est
 * promis qui ne soit déjà écrit dans le produit — pas de durée de conservation
 * inventée, pas de juridiction choisie à la place de l'exploitant.
 *
 * La mention de fin le dit sans détour : le texte contractuel complet est en
 * cours de finalisation. C'est la seule formulation honnête tant qu'un juriste
 * n'a pas tranché, et elle vaut mieux qu'un écran « à construire » — qui
 * n'informe personne — ou qu'un faux contrat, qui tromperait.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
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
          gap: theme.space.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="body" tone="secondary">
          {intro}
        </Text>

        {children}

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.colors.rule,
            paddingTop: theme.space.lg,
            gap: theme.space.md,
          }}
        >
          <Text variant="small" tone="muted">
            {t('legal.provisional')}
          </Text>

          <Pressable
            onPress={() => void Linking.openURL(`tel:${env.supportPhone}`)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text variant="bodyStrong" tone="primary">
              {t('legal.contact')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Un article : son intitulé au filet rouge, puis ses points. */
export function LegalSection({ label, points }: { label: string; points: readonly string[] }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md }}>
      <SectionLabel>{label}</SectionLabel>

      {points.map((point) => (
        <View key={point} style={{ flexDirection: 'row', gap: theme.space.md }}>
          {/*
            Puce carrée de 5 px, comme dans l'écran Sécurité : le produit ne
            réserve les formes rondes qu'aux états vivants.
          */}
          <View
            style={{
              width: 5,
              height: 5,
              marginTop: 8,
              backgroundColor: theme.colors.ink,
            }}
          />
          <Text variant="small" tone="secondary" style={{ flex: 1 }}>
            {point}
          </Text>
        </View>
      ))}
    </View>
  );
}
