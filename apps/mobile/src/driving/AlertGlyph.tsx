import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import type { AlertType } from '@geocras/shared';

export type AlertGlyphProps = {
  type: AlertType;
  color: string;
  size?: number;
};

/**
 * Le pictogramme d'une alerte, en formes simples.
 *
 * Cinq signes, cinq gestes de conduite — et aucun n'a besoin d'être appris :
 * le disque est un feu, le triangle un danger sur la voie, les flèches
 * désignent le côté d'où vient la menace. Le cahier des charges interdit les
 * pictogrammes décoratifs ; ceux-ci portent la seule information qu'on lit sans
 * lire, **de quel côté regarder**.
 *
 * Le trait est épais et les formes pleines : ce pictogramme est vu de biais, à
 * bout de bras, éventuellement en plein soleil. Un contour fin y disparaît.
 */
export function AlertGlyph({ type, color, size = 20 }: AlertGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {type === 'red_light' ? (
        // Le feu : sa lampe allumée, et le boîtier autour qui la désigne comme
        // un feu plutôt que comme une pastille d'état.
        <>
          <Rect
            x={6.5}
            y={2.5}
            width={11}
            height={19}
            rx={2}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
          <Circle cx={12} cy={8} r={2.6} fill={color} />
        </>
      ) : null}

      {type === 'obstacle' ? (
        /*
          Danger sur la voie : le triangle du bord des routes, barre comprise.

          Tracé en contour et non en aplat, pour une raison qui n'est pas
          esthétique — un aplat aurait obligé à peindre la barre dans une
          seconde couleur, donc à écrire une couleur en dur ici. Tout le
          pictogramme tient dans la seule teinte reçue.
        */
        <>
          <Polygon
            points="12,3.5 22,20.5 2,20.5"
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <Path d="M12 10v4.4" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx={12} cy={17.8} r={1.2} fill={color} />
        </>
      ) : null}

      {type === 'blind_spot_left' || type === 'blind_spot_right' ? (
        <Path
          d={
            type === 'blind_spot_left'
              ? 'M20 12H4.5M10.5 5.5L4 12l6.5 6.5'
              : 'M4 12h15.5M13.5 5.5L20 12l-6.5 6.5'
          }
          fill="none"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {type === 'side_impact' ? (
        // Deux forces qui se rejoignent sur le flanc : le choc, pas la
        // direction. D'où les flèches qui convergent au lieu de pointer.
        <>
          <Path
            d="M2 12h7M6 8.5L9.5 12 6 15.5M22 12h-7M18 8.5L14.5 12 18 15.5"
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Rect x={11} y={4} width={2} height={16} fill={color} />
        </>
      ) : null}
    </Svg>
  );
}
