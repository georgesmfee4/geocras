# Conventions de développement

## Ce qui vaut partout

Les rayons de bordure sont à 0 par défaut. On monte à 2 px sur les champs et les puces,
20 à 22 px sur les feuilles du bas, et 50 % sur les pastilles. Ce qu'il faut éviter, c'est
le 8 ou 12 ou 16 px saupoudré partout par habitude.

Aucun emoji dans l'interface, et aucune icône dessinée à la main en SVG décoratif. Les
icônes viennent de `lucide-react-native` ou de formes simples.

La cible tactile minimale est de 44 × 44 px, sans exception.

Le fil conducteur derrière tout ça : l'app doit rester lisible en plein soleil et
utilisable par quelqu'un sous stress, en panne au bord de la route. Donc peu de texte, des
actions grandes, et le bouton SOS prioritaire sur tout le reste.

## Mobile

Un écran est un dossier dans `apps/mobile/src/screens/`, ou une route dans `app/`.

Tous les appels réseau passent par `src/api/`. Pas de `fetch` dans un composant, jamais.

Les marqueurs de carte passent par `<GarageMarker>`, un écusson pentagonal numéroté, et
pas la goutte par défaut. Un garage certifié est rouge plein avec une pastille de
validation ; un garage non certifié est blanc avec une bordure encre de 2 px.

Le `rank` d'un marqueur vient du serveur. Il ne faut jamais le dériver d'un index de
tableau, sous peine de voir la numérotation diverger du classement dès qu'un filtre
change.

## Serveur

Le découpage se fait par domaine, dans `src/modules/<domaine>/`, pas par couche. Les routes
restent minces, les services portent la logique.

Chaque entrée est validée par zod avant d'atteindre le controller. Les erreurs sortent
toujours sous la forme `{ error: { code, message } }`, parce que le mobile traduit sur le
code et pas sur le message.

Toute écriture géographique passe par `src/db/geo.ts`. On n'écrit pas `ST_SetSRID`
ailleurs. Et le rappel qui évite de perdre une heure : c'est
`ST_MakePoint(longitude, latitude)`, dans cet ordre.

Enfin, `ST_DWithin` doit précéder tout tri par distance, sinon l'index GIST n'est pas
utilisé et la requête parcourt la table entière.

## La fidélité

Les points sont de l'argent, il faut les traiter comme tels.

On n'écrit jamais `UPDATE users SET points = points + n`. Chaque mouvement est une ligne
dans `loyalty_ledger`, avec sa `idempotency_key`.

Le crédit exige la double confirmation d'arrivée, et ce n'est pas une vérification
applicative : c'est la contrainte SQL `closed_requires_both_arrivals`.

Avant de toucher au barème, lire `ANTI_FRAUD` dans `packages/shared/src/loyalty.ts`.

## Apparence

Tout ce qui touche aux couleurs, aux formes et à la typographie est dans
[`docs/charte-visuelle.md`](docs/charte-visuelle.md).

## Commits

Format `type(portée): description`, en français. Par exemple `feat(carte): …` ou
`fix(sos): …`. Un écran par commit tant que c'est possible.
