import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { buildBlindMapStyle, buildMapStyle } from './style';

const CLE = 'cle-de-test';

/** Les couches qui écrivent du texte sur la carte. */
const LIBELLES = ['road-label', 'place-label', 'locality-label'] as const;

type CoucheLue = {
  id: string;
  type: string;
  minzoom?: number;
  filter?: unknown[];
  layout?: Record<string, unknown>;
};

/**
 * Une couche du style, lue par son identifiant.
 *
 * Le type de retour est volontairement plus lâche que `LayerSpecification` :
 * cette union distingue chaque type de couche, si bien que `filter` n'existe
 * pas sur un fond de carte. Le test veut lire des champs facultatifs, pas
 * prouver qu'ils sont là — l'assertion s'en charge juste après.
 */
function couche(style: ReturnType<typeof buildMapStyle>, id: string): CoucheLue {
  const trouvee = style.layers.find((l) => l.id === id);
  if (!trouvee) throw new Error(`Couche « ${id} » absente du style`);
  return trouvee as CoucheLue;
}

describe('style de carte — validité', () => {
  /**
   * Le garde-fou le plus utile du fichier.
   *
   * MapLibre **ne signale pas** une couche dont une expression est invalide :
   * il l'ignore, et la carte s'affiche sans elle. Un `interpolate` mal formé ou
   * un champ inconnu produit donc exactement ce qu'on a passé une soirée à
   * chercher — des rues sans nom, sans la moindre erreur nulle part.
   *
   * Le validateur officiel de la spécification tranche en une milliseconde ce
   * qui demandait un appareil, un trajet et une paire d'yeux.
   */
  it('passe le validateur officiel de la spécification', () => {
    expect(validateStyleMin(buildMapStyle(CLE))).toEqual([]);
  });

  it('vaut aussi pour le fond aveugle', () => {
    expect(validateStyleMin(buildBlindMapStyle(CLE))).toEqual([]);
  });
});

describe('style de carte — ce qui porte les noms', () => {
  /**
   * La classe `village` est la raison d'être de `locality-label`.
   *
   * Hors des grandes villes, OpenStreetMap range les quartiers camerounais sous
   * `village` et non sous `suburb`. À Ebolowa, le filtre d'origine retenait
   * trois noms là où les tuiles en contiennent vingt-cinq : la carte n'y offrait
   * aucun repère, dans les villes qui en ont pourtant le plus besoin puisque
   * leurs rues ne sont pas nommées.
   */
  it('affiche les quartiers rangés sous « village », pas seulement « suburb »', () => {
    const filtre = couche(buildMapStyle(CLE), 'locality-label').filter ?? [];

    expect(filtre).toContain('village');
    expect(filtre).toContain('quarter');
    expect(filtre).toContain('suburb');
  });

  /**
   * Un axe sans nom garde son numéro.
   *
   * `N2`, `D 39`, `P10` : hors agglomération, c'est tout ce qu'OSM connaît des
   * routes qu'on emprunte pour rejoindre une panne. Ne lire que `name` les
   * laissait muettes.
   */
  it('retombe sur le numéro de route quand le nom manque', () => {
    const champ = couche(buildMapStyle(CLE), 'road-label').layout?.['text-field'] as unknown[];

    expect(champ[0]).toBe('coalesce');
    expect(JSON.stringify(champ)).toContain('ref');
  });

  /**
   * Le seuil d'apparition est ce qui décide qu'on lit, ou non, un nom de rue
   * pendant un trajet : presque tous les écrans du produit cadrent large.
   */
  it('montre les noms de voie dès le zoom des trajets', () => {
    expect(couche(buildMapStyle(CLE), 'road-label').minzoom).toBeLessThanOrEqual(12);
  });
});

describe('style de carte — le fond aveugle', () => {
  /**
   * Aucun libellé ne doit survivre au fond aveugle.
   *
   * C'est lui qui protège la position d'une demande que le garage n'a pas
   * encore acceptée : un nom de rue ou de quartier suffirait à situer le
   * client, ce que l'arrondi des coordonnées cherche justement à empêcher.
   * Ajouter une couche de texte sans l'inscrire dans `LOCATING_LAYERS` ouvrirait
   * la fuite en silence — d'où ce test, qui balaie **toutes** les couches de
   * type `symbol` plutôt qu'une liste écrite à la main.
   */
  it('ne laisse passer aucune couche de texte', () => {
    const aveugle = buildBlindMapStyle(CLE);
    expect(aveugle.layers.filter((l) => l.type === 'symbol')).toEqual([]);
  });

  it('retire aussi les voies et le bâti', () => {
    const restants = buildBlindMapStyle(CLE).layers.map((l) => l.id);

    for (const id of [...LIBELLES, 'building', 'road-minor', 'road-major']) {
      expect(restants).not.toContain(id);
    }
  });

  /**
   * L'eau et la végétation restent : elles donnent une masse au fond sans
   * nommer quoi que ce soit. Un cadre entièrement vide se lirait comme une
   * carte en panne.
   */
  it('garde de quoi ne pas ressembler à une carte cassée', () => {
    const restants = buildBlindMapStyle(CLE).layers.map((l) => l.id);

    expect(restants).toContain('background');
    expect(restants).toContain('water');
  });
});
