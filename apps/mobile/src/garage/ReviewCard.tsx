import { View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { ChamferView } from '../ui/ChamferView';
import { Stars } from '../ui/Stars';
import { Text } from '../ui/Text';

export type ReviewCardProps = {
  review: {
    id: string;
    rating: number;
    comment: string | null;
    authorName: string;
    authorInitials: string;
    createdAt: string;
  };
};

/**
 * Un avis client.
 *
 * Carte de contenu : **pas de chamfer sur le cadre**. L'avatar, lui, en porte
 * un — le cahier des charges réserve l'angle coupé aux logos, boutons d'action,
 * avatars et badges, et c'en est un.
 *
 * L'ancienneté est en mono et alignée à droite, comme sur la maquette : c'est
 * une donnée mesurée, et sa place fixe permet de balayer une pile d'avis en
 * lisant uniquement la colonne de droite pour repérer les récents.
 *
 * Un avis sans commentaire n'est pas un avis vide : la note est l'information
 * principale, le texte un complément. On n'affiche donc rien à la place — pas
 * de « (aucun commentaire) » qui ferait trois lignes de bruit dans la liste.
 */
export function ReviewCard({ review }: ReviewCardProps) {
  const theme = useTheme();
  const { formatAge } = useI18n();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.rule,
        padding: theme.space.md,
        gap: theme.space.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <ChamferView
          fill={theme.colors.primaryTint}
          style={{ width: 40, height: 40 }}
          contentStyle={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="monoStrong" tone="primary">
            {review.authorInitials}
          </Text>
        </ChamferView>

        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {review.authorName}
          </Text>
          <Stars value={review.rating} size={12} />
        </View>

        <Text variant="monoSmall" tone="muted">
          {formatAge(review.createdAt)}
        </Text>
      </View>

      {review.comment ? <Text variant="body">{review.comment}</Text> : null}
    </View>
  );
}
