import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { STAR_PATH } from './Stars';

/**
 * Icônes de l'interface.
 *
 * Tracées à la main plutôt que tirées d'une bibliothèque : le cahier des
 * charges autorise `lucide-react-native` **ou** des formes simples, et il n'y
 * en a qu'une dizaine. Les importer coûterait une dépendance de plus pour un
 * jeu qu'on maîtrise entièrement.
 *
 * Deux règles communes, qui font que le lot se tient :
 *  - grille de 24, trait de 2 (1,8 sur les plus denses), extrémités rondes ;
 *  - **le trait porte la couleur, jamais le remplissage**, pour qu'une même
 *    icône passe du blanc sur fond encre à l'encre sur fond blanc sans être
 *    redessinée.
 */

export type IconProps = {
  color: string;
  size?: number;
};

export function MagnifierIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={11} cy={11} r={7} fill="none" stroke={color} strokeWidth={2} />
      <Line
        x1={16.5}
        y1={16.5}
        x2={21}
        y2={21}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ClearIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 5l14 14M19 5L5 19" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CrosshairIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={6} fill="none" stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={2} fill={color} />
      <Path
        d="M12 1v4M12 19v4M1 12h4M19 12h4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Bascule 2D/3D : deux plans empilés. À plat ils sont rectangulaires, inclinés
 * ils prennent la perspective — l'icône montre l'état courant plutôt qu'un
 * pictogramme figé.
 */
export function TiltIcon({ color, size = 22, tilted }: IconProps & { tilted: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {tilted ? (
        <>
          <Path d="M3 9l9-4 9 4-9 4z" fill={color} />
          <Path
            d="M3 15l9 4 9-4"
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <Path d="M4 8h16" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M4 14h16" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

/**
 * Compte et réglages : un buste surmonté d'un engrenage.
 *
 * L'engrenage est réduit à un moyeu et six dents. À 20 px, une denture
 * réaliste se referme en tache ; six traits radiaux restent lisibles et se
 * lisent quand même comme un réglage.
 */
export function AccountGearIcon({ color, size = 22 }: IconProps) {
  const teeth = [0, 60, 120, 180, 240, 300].map((degrees) => {
    const radians = (degrees * Math.PI) / 180;
    const cx = 17;
    const cy = 17;
    return {
      degrees,
      x1: cx + Math.cos(radians) * 3.4,
      y1: cy + Math.sin(radians) * 3.4,
      x2: cx + Math.cos(radians) * 5.6,
      y2: cy + Math.sin(radians) * 5.6,
    };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Buste, tronqué à droite pour laisser l'engrenage se poser dessus. */}
      <Circle cx={9.5} cy={7} r={3.6} fill="none" stroke={color} strokeWidth={1.9} />
      <Path
        d="M3 19.5a6.5 6.5 0 0 1 10.2-5.3"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />

      <Circle cx={17} cy={17} r={3.4} fill="none" stroke={color} strokeWidth={1.9} />
      {teeth.map((tooth) => (
        <Line
          key={tooth.degrees}
          x1={tooth.x1}
          y1={tooth.y1}
          x2={tooth.x2}
          y2={tooth.y2}
          stroke={color}
          strokeWidth={1.9}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

/** Certification : écusson et coche. */
export function ShieldCheckIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.5l7.5 3v5.8c0 4.6-3.1 8.3-7.5 10.2-4.4-1.9-7.5-5.6-7.5-10.2V5.5z"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M8.6 11.9l2.4 2.4 4.4-4.6"
        fill="none"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Ouverture : horloge. Aiguilles à 10 h 10, la position la plus lisible. */
export function ClockIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={1.9} />
      <Path
        d="M12 6.8V12l3.6 2.2"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Remorquage : cabine, flèche de levage et crochet.
 *
 * Le crochet est ce qui distingue l'icône d'un simple camion — sans lui, le
 * filtre « Remorquage » serait illisible à côté d'un pictogramme de véhicule.
 */
export function TowTruckIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/*
        Silhouette du camion en **un seul tracé** : cabine haute à gauche,
        plateau bas à droite. Deux rectangles séparés, comme dans une première
        version, se refermaient en une tache indistincte une fois réduits à
        15 px — la puce de filtre les affiche à cette taille.
      */}
      <Path
        d="M3 16.4V11h5l2 3h9v2.4z"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      {/* Flèche de levage, puis le crochet qui pend — c'est lui qui distingue
          l'icône d'un simple camion. */}
      <Path d="M11.5 13.6L18.2 7.4" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M18.2 7.4v2.9" stroke={color} strokeWidth={1.9} strokeLinecap="round" />

      <Circle cx={6.6} cy={18.9} r={1.6} fill="none" stroke={color} strokeWidth={1.8} />
      <Circle cx={15.4} cy={18.9} r={1.6} fill="none" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function ChevronLeftIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M15 5l-7 7 7 7"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ----------------------------- Véhicules ----------------------------- */
/*
 * Les quatre pictogrammes partagent leur ligne de sol et le même diamètre de
 * roue : posés côte à côte dans les tuiles de l'étape 2, ils se lisent comme
 * une série et non comme quatre dessins rapportés.
 */

export function CarIcon({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 16.5v-3.2l1.9-4.1A2 2 0 0 1 6.7 8h10.6a2 2 0 0 1 1.8 1.2L21 13.3v3.2z"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path d="M4.2 13.3h15.6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Circle cx={7.4} cy={18.4} r={1.7} fill="none" stroke={color} strokeWidth={1.8} />
      <Circle cx={16.6} cy={18.4} r={1.7} fill="none" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function MotoIcon({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={5} cy={16.6} r={3.4} fill="none" stroke={color} strokeWidth={1.8} />
      <Circle cx={19} cy={16.6} r={3.4} fill="none" stroke={color} strokeWidth={1.8} />
      <Path
        d="M5 16.6l4-5h5l2.4 5"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.6 11.6L8 8.4h3.4"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TruckIcon({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2.5 16.6V7.6h11.2v9z"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M13.7 16.6v-5.4h3.6l3.2 3.1v2.3z"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Circle cx={7} cy={18.4} r={1.7} fill="none" stroke={color} strokeWidth={1.8} />
      <Circle cx={17} cy={18.4} r={1.7} fill="none" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

/**
 * Véhicule hors catégorie : un tricycle, la silhouette la plus courante du
 * parc camerounais qui n'entre ni dans « voiture », ni dans « moto », ni dans
 * « camion ». Un point d'interrogation aurait dit « inconnu » là où il faut
 * dire « autre chose qui roule ».
 */
export function VehicleOtherIcon({ color, size = 26 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={4.6} cy={17.4} r={2.6} fill="none" stroke={color} strokeWidth={1.8} />
      <Circle cx={19.4} cy={17.4} r={2.6} fill="none" stroke={color} strokeWidth={1.8} />
      <Circle cx={12.6} cy={17.4} r={2.6} fill="none" stroke={color} strokeWidth={1.8} />
      <Path
        d="M4.6 17.4l3.6-5.6h4.4"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.6 11.8L7.4 8.6h3.2"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12.6 14.8V9.8h8v5"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ------------------------------ Formulaire ---------------------------- */

export function CameraIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 8.6h3.6L8.2 6h7.6l1.6 2.6H21v10.4H3z"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13.4} r={3.4} fill="none" stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}

export function TrashIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13h9l1-13"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 12.5l4.5 4.5L19 7"
        fill="none"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Œil du mot de passe.
 *
 * **Sans la barre qui le raye** : elle n'est pas dessinée ici parce qu'elle
 * s'anime — elle se trace d'un bord à l'autre au moment où l'on révèle la
 * saisie, et un tracé SVG ne se transforme pas sur le fil natif. Elle vit donc
 * dans `<RevealToggle>`, posée par-dessus cette icône, qui ne bouge jamais :
 * l'amande et la pupille restent exactement où elles étaient d'un état à
 * l'autre, seule la barre apparaît.
 *
 * Le trait est plus fin que la moyenne du jeu (1,7) : l'icône vit dans un
 * champ de saisie, à côté d'un texte de 14 px, et un 2 y pèserait plus lourd
 * que la valeur qu'elle protège.
 *
 * Le rapport entre la barre et la boîte est figé par `EYE_STRIKE_RATIO`, que
 * `<RevealToggle>` lit pour dimensionner la sienne : les deux tracés doivent
 * rester d'aplomb quelle que soit la taille demandée.
 */
export const EYE_STRIKE_RATIO = 21.2 / 24;

export function EyeIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2.5 12S6.4 5.8 12 5.8 21.5 12 21.5 12 17.6 18.2 12 18.2 2.5 12 2.5 12z"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3.1} fill="none" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

/** Confidentialité : cadenas sur écusson. */
export function ShieldLockIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.5l7.5 3v5.8c0 4.6-3.1 8.3-7.5 10.2-4.4-1.9-7.5-5.6-7.5-10.2V5.5z"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path d="M9.6 12.4v-1.6a2.4 2.4 0 0 1 4.8 0v1.6" fill="none" stroke={color} strokeWidth={1.7} />
      <Rect x={9} y={12.4} width={6} height={4.6} rx={1} fill="none" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

/** Repère de position — épingle, pas la goutte des marqueurs de garage. */
export function MapPinIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 21.5s7-6.1 7-11.2a7 7 0 1 0-14 0c0 5.1 7 11.2 7 11.2z"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10.2} r={2.6} fill="none" stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}

export function AlertIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.4l9.2 16H2.8z"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path d="M12 9.4v4.6" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
      <Circle cx={12} cy={16.8} r={1.1} fill={color} />
    </Svg>
  );
}

/* ------------------------------ Onglets ------------------------------ */
/*
 * Les trois pictogrammes de la barre du bas partagent une même épaisseur de
 * trait (2) et remplissent la même boîte optique : posés côte à côte, aucun ne
 * doit paraître plus lourd que ses voisins.
 */

export type TabIconProps = IconProps & {
  /**
   * Onglet actif.
   *
   * Il ne change pas seulement la couleur : l'icône passe du **contour au
   * plein**. C'est la convention d'iOS comme d'Android, et c'est ce qui fait
   * qu'un onglet sélectionné se repère à la forme, pas seulement à la teinte —
   * donc aussi en plein soleil, où l'écart rouge/gris s'écrase.
   */
  active?: boolean;
};

/**
 * Carte : le repère de position de GeoCras.
 *
 * **Pas la goutte par défaut.** Le cahier des charges l'interdit explicitement
 * pour les marqueurs, et l'onglet doit annoncer ce qu'on va trouver sur
 * l'écran : le même écusson pentagonal
 * `polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)` que les garages plantés sur
 * la carte. Une goutte générique aurait été l'icône de n'importe quelle app de
 * cartographie ; celle-ci n'appartient qu'à GeoCras.
 *
 * L'ombre au sol reprend celle des vrais marqueurs : c'est elle qui fait lire
 * un objet **planté** plutôt qu'un pictogramme flottant.
 */
export function MapTabIcon({ color, size = 22, active = false }: TabIconProps) {
  // Écusson : épaules à 62 % de la hauteur, pointe centrée en bas.
  const badge = 'M4.6 2.6h14.8v10.2L12 20.4 4.6 12.8z';

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Ombre elliptique, comme sous les écussons de la carte. */}
      <Ellipse cx={12} cy={21.4} rx={4.2} ry={1.15} fill={color} opacity={0.28} />

      <Path
        d={badge}
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth={active ? 1 : 2}
        strokeLinejoin="round"
      />

      {/* L'œilleton. Évidé sur l'écusson plein, tracé sur l'écusson creux :
          dans les deux cas c'est lui qui dit « point de repère ». */}
      <Circle
        cx={12}
        cy={9.4}
        r={2.9}
        fill={active ? '#FFFFFF' : 'none'}
        stroke={active ? 'none' : color}
        strokeWidth={2}
      />
    </Svg>
  );
}

/**
 * Conduite : un conducteur au volant.
 *
 * Le volant seul se confondait avec une cible ou un viseur — le même
 * vocabulaire circulaire que le bouton de recentrage et que la marque. Y
 * adjoindre le buste lève l'ambiguïté d'un coup : ce n'est plus un objet, c'est
 * quelqu'un qui conduit.
 *
 * **Deux niveaux de ton.** Le volant porte la couleur pleine, le conducteur la
 * même couleur à 45 %. La nuance vient d'une opacité et non d'une seconde
 * teinte : elle suit donc automatiquement l'état actif (rouge), l'état inactif
 * (gris) et le thème sombre, sans qu'aucune couleur soit codée en dur.
 */
export function DrivingTabIcon({ color, size = 22, active = false }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Conducteur, en retrait. Dessiné en premier : le volant passe devant,
          comme dans la réalité. */}
      <G opacity={0.45}>
        <Circle
          cx={12}
          cy={4.9}
          r={3}
          fill={active ? color : 'none'}
          stroke={color}
          strokeWidth={active ? 0 : 1.9}
        />
        <Path
          d="M6.4 13.6a5.9 5.9 0 0 1 11.2 0"
          fill="none"
          stroke={color}
          strokeWidth={1.9}
          strokeLinecap="round"
        />
      </G>

      {/* Volant, au premier plan. */}
      <Circle
        cx={12}
        cy={15.6}
        r={6.6}
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth={active ? 0 : 2}
      />

      {active ? (
        <>
          {/* En plein, le moyeu et les branches sont évidés : la forme se lit
              en négatif, ce qui garde le volant reconnaissable sans surcharger. */}
          <Circle cx={12} cy={15.6} r={2.1} fill="#FFFFFF" />
          <Path
            d="M12 17.7v4.5M9.9 14.6L3.9 12.9M14.1 14.6l6-1.7"
            stroke="#FFFFFF"
            strokeWidth={1.9}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <Circle cx={12} cy={15.6} r={2.1} fill="none" stroke={color} strokeWidth={1.9} />
          <Path
            d="M12 17.7v4.5M9.9 14.6L5.6 13.4M14.1 14.6l4.3-1.2"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}

/** Interventions, côté garagiste : une clé plate. */
export function JobsTabIcon({ color, size = 22, active = false }: TabIconProps) {
  const wrench =
    'M15.6 3.4a5.6 5.6 0 0 0-5.2 7.7L3.4 18.1l2.5 2.5 7-7a5.6 5.6 0 0 0 7.7-5.2 5.6 5.6 0 0 0-.4-1.9l-3.2 3.2-2.7-2.7 3.2-3.2a5.6 5.6 0 0 0-1.9-.4z';

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={wrench}
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth={active ? 1 : 2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* --------------------------- Menu du compte --------------------------- */

/** Buste seul — « Mon profil », par opposition à l'engrenage du menu. */
export function PersonIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={7.6} r={3.8} fill="none" stroke={color} strokeWidth={2} />
      <Path
        d="M4.6 20.4a7.4 7.4 0 0 1 14.8 0"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Historique d'interventions : une courbe de trajets. */
export function TrackHistoryIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 15.4c2.6 0 3.1-6.8 5.7-6.8s3.1 6.8 5.7 6.8 3.1-6.8 6.6-6.8"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Fidélité : médaille à ruban. */
export function LoyaltyIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={9} r={5.8} fill="none" stroke={color} strokeWidth={2} />
      <Path
        d="M8.6 13.8L7 21.4l5-2.6 5 2.6-1.6-7.6"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Assistance : combiné téléphonique. */
export function PhoneIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7.4 3.6l2.6 4-2 2.1a13 13 0 0 0 6.3 6.3l2.1-2 4 2.6-1 3a1.8 1.8 0 0 1-1.9 1.2C10.4 20 4 13.6 3.2 5.5A1.8 1.8 0 0 1 4.4 3.6z"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Réglages : engrenage seul. */
export function SettingsIcon({ color, size = 22 }: IconProps) {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315].map((degrees) => {
    const radians = (degrees * Math.PI) / 180;
    return {
      degrees,
      x1: 12 + Math.cos(radians) * 6.2,
      y1: 12 + Math.sin(radians) * 6.2,
      x2: 12 + Math.cos(radians) * 9,
      y2: 12 + Math.sin(radians) * 9,
    };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={6.2} fill="none" stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={2.3} fill="none" stroke={color} strokeWidth={1.8} />
      {teeth.map((tooth) => (
        <Line
          key={tooth.degrees}
          x1={tooth.x1}
          y1={tooth.y1}
          x2={tooth.x2}
          y2={tooth.y2}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

export function ChevronRightSmallIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Étoile pleine — bouton « Noter ». Même tracé que la note en étoiles. */
export function StarIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 5l14 14M19 5L5 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}
