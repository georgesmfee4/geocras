# Charte visuelle

Quatre partis pris reviennent partout dans l'app. Pris ensemble, ce sont eux qui font
qu'on reconnaît GeoCras d'un coup d'œil au lieu de tomber sur une application générique.
Autant le dire franchement : ce sont les règles sur lesquelles je ne transige pas, même
quand elles compliquent un écran.

## L'angle coupé

Le coin inférieur droit est coupé à 45° sur le logo, les boutons d'action rouges, les
avatars et les badges de fidélité. Jamais sur les cartes de contenu, jamais sur les champs
de saisie : dès qu'on l'applique à tout, l'effet disparaît et il ne reste qu'un bruit de
forme.

Le composant `<ChamferView>` s'en occupe. Il ne faut pas le réimplémenter au cas par cas.

## Les chiffres en mono

Toute donnée mesurée s'affiche en IBM Plex Mono : distances, ETA, vitesse, notes, points,
plaques d'immatriculation, précision GPS, horodatages, numéros de version. Tout le reste
est en IBM Plex Sans. Jamais l'inverse.

Ça passe par `<Text variant="mono">`, avec les déclinaisons `monoSmall`, `monoStrong`,
`speed` et `footnote`. Ces variantes activent `tabular-nums` toutes seules, ce qui évite
qu'un chiffre qui change fasse sautiller la ligne entière.

Une remarque sur l'état des lieux : la famille sans était Inter jusqu'ici, et les deux
polices sont chargées en même temps le temps que les écrans basculent. Un écran qui
s'affiche encore en Inter n'est pas cassé, il n'est simplement pas encore repris. Inter
partira quand la passe sera terminée.

## Le blanc chaud

Pas de gris bleuté nulle part. Le fond est `#F6F4EF` et l'encre `#1C1A17`. Le mode sombre
reste chaud lui aussi, avec `#121110` en fond et `#1C1A18` en surface.

## Le filet rouge

Chaque libellé de section est précédé d'un trait rouge de 14 × 2 px. C'est le rôle de
`<SectionLabel>`.

## La palette

Elle vit dans [`apps/mobile/src/theme/tokens.ts`](../apps/mobile/src/theme/tokens.ts) et
nulle part ailleurs. Aucune couleur en dur dans un composant : si une valeur manque, on
l'ajoute aux jetons plutôt que de l'écrire sur place.

| Rôle | Clair | Sombre |
|---|---|---|
| Primaire | `#E53935` | `#E53935` |
| Primaire foncé | `#C62A26` | `#C62A26` |
| Teinte primaire | `#FCECEA` | `#2A1513` |
| Fond | `#F6F4EF` | `#121110` |
| Surface | `#FFFFFF` | `#1C1A18` |
| Encre | `#1C1A17` | `#FFFFFF` |
| Encre secondaire | `#6E6A62` | `#BDB7AB` |
| Discret | `#A39D91` | `#8C867A` |
| Filet | `#E8E4DB` | `#2A2724` |
| Succès | `#2F8F5B` | `#2F8F5B` |
| Attention | `#E0A32E` | `#E0A32E` |
| Position utilisateur | `#2D6FD6` | `#2D6FD6` |

Pour la carte : fond `#EFEBE2`, routes `#FEFBF0` sur un casing `#E2DDD1`, eau `#BBD5EA`,
végétation `#D9E6C8`, bâtiments `#E6E1D6`.

## Le wordmark

`GEOCRAS`, en capitales, avec `GEO` en 500 et `CRAS` en 800, letter-spacing .11em. Jamais
« GeoCras » en CamelCase dans l'interface. Le composant est `<Wordmark>`.

Le rendu se fait en IBM Plex Sans 400 et 700, parce que les graisses 500 et 800 ne font pas
partie des trois embarquées. L'écart de trois crans est conservé, et c'est le contraste
entre les deux moitiés du mot qui le rend lisible, pas la graisse absolue.

## Les maquettes

Les onze écrans dessinés sont dans [`maquettes/`](maquettes/). Ils portent encore des
libellés de Douala, Akwa, Wouri, la rue Joss. C'est cosmétique et daté : le produit se
lance à Yaoundé, et le seed l'est déjà.
