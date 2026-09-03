# Les deux modes de service

> **À qui s'adresse ce document.** À quelqu'un qui découvre le projet. Aucune
> connaissance de PostGIS, de Kysely ni du code de GeoCras n'est supposée. Les
> termes techniques sont définis au moment où ils servent.

---

## 1. Le problème, en une phrase

Un dépannage peut se faire dans **deux sens**, et jusqu'à la migration `0009`
GeoCras n'en connaissait qu'un.

| | Ce qui se passe | Nom dans le code |
|---|---|---|
| **1** | Le garagiste sort son véhicule et va sur le lieu de la panne. | `on_site` |
| **2** | Le véhicule roule encore : le client conduit jusqu'à l'atelier. | `at_garage` |

Le cas 1 est le cas fondateur — quelqu'un immobilisé au bord d'une route. Le cas
2 existait déjà dans la vraie vie (un voyant, un bruit, un frein qui mollit) mais
**n'existait nulle part dans les données**.

### Pourquoi ce n'est pas un détail cosmétique

GeoCras se rémunère en **apportant des clients aux garages**. Pour facturer, il
faut pouvoir affirmer sans discussion possible qu'un client a bien été apporté.
Cette affirmation ne repose pas sur un bouton — le garage pourrait refuser de
l'appuyer — mais sur la **trace GPS** de celui qui s'est déplacé.

Or, dans le cas 2, le garagiste ne se déplace pas. Sa trace est vide. Si on
continuait à ne lire que la sienne, chaque client réellement venu à l'atelier
serait compté comme *« aucun déplacement n'a eu lieu »* — un vrai client apporté,
qu'on ne saurait pas facturer, et qu'on ne saurait même pas compter.

---

## 2. L'idée centrale : un mode est une **géométrie**

Tout tient dans une phrase :

> **Un mode de service, c'est un couple : _qui se déplace_, et _vers quel point_.**

| Mode | Qui se déplace | Vers quel point |
|---|---|---|
| `on_site` | le **garage** | le lieu de la panne (`origin` de la demande) |
| `at_garage` | le **client** | l'adresse de l'atelier (`location` du garage) |

Une fois ce couple connu, **rien d'autre ne change**. La question posée est la
même dans les deux cas :

> *Quelqu'un a-t-il réellement fait un trajet, et s'est-il arrêté au bout ?*

C'est pourquoi la fonction qui répond, `proveArrival()`, **n'a pas eu besoin
d'être modifiée** : elle ne sait pas ce qu'est un mode de service. On lui donne
une trace et un point d'arrivée ; elle dit ce qu'on peut en affirmer.

### Le seul endroit où le mode devient de la géométrie

```ts
// packages/shared/src/billing.ts
serviceGeometry('at_garage', { origin, garageLocation })
// → { traveller: 'client', destination: garageLocation }
```

**Tout** ce qui a besoin de savoir quelle trace lire ou vers quoi mesurer passe
par cette fonction : la preuve d'arrivée, le registre des commissions,
l'itinéraire affiché. Un `if (mode === …)` recopié dans trois modules finit
toujours par en avoir un de retard — et une preuve mesurée vers le mauvais point
**ne se voit pas** : elle ne plante pas, elle rend simplement « aucune preuve »
sur des dépannages parfaitement réels.

---

## 3. Qui décide du mode, et quand

**Le client, au moment où il déclare sa panne.** Lui seul sait si son véhicule
peut encore rouler.

Le mode est **fixé à la création de la demande et n'est plus jamais modifié**.
Deux conséquences utiles :

- il n'y a pas d'état de négociation à modéliser ;
- il est écrit **deux fois** — dans une colonne, qui décrit l'état courant, et
  dans le **journal** (événement `created`), qui est en ajout seul. Le jour où
  une commission sera contestée, c'est la ligne du journal qui dira ce qui avait
  été convenu au départ, indépendamment de tout ce qui a pu se passer depuis.
  Une colonne seule est une affirmation ; une colonne plus son événement
  fondateur est une **preuve**.

### La règle qui ne se négocie pas

> **Un véhicule immobilisé ne conduit personne nulle part.**

Le formulaire demande déjà « le véhicule est-il immobilisé ? ». Si la réponse est
oui, `at_garage` est **impossible**. Cette règle est tenue à **trois** endroits,
et les trois sont utiles :

| Barrière | Fichier | Ce qu'elle protège |
|---|---|---|
| L'écran n'offre pas l'option | `apps/mobile/app/sos/declarer.tsx` | l'utilisateur, d'une erreur |
| Le contrat refuse la demande | `packages/shared/src/contracts/requests.ts` | le serveur, d'un client trafiqué |
| La base refuse la ligne | `apps/api/migrations/0009_service_mode.sql` | **nous-mêmes**, d'un futur script d'import ou d'une reprise de données |

C'est exactement la discipline déjà appliquée à `closed_requires_both_arrivals` :
une règle qui touche à l'argent ne vit pas dans un `if`.

---

## 4. Le cycle de vie, dans les deux sens

Les états ne changent pas. **Aucun état n'a été ajouté.** Ce qui change, c'est
*qui* déclenche quoi.

```
                     on_site                        at_garage
                (le garagiste vient)          (le client va au garage)

  pending       le client cherche un garage          idem
     │
  selected      le client a choisi                   idem
     │
  accepted      le garage a accepté                  idem
     │
     │          ┌──────────────────────┐      ┌──────────────────────┐
  en_route      │ LE GARAGE se déclare │      │ LE CLIENT se déclare │
     │          │      « Je pars »     │      │     « Je pars »      │
     │          └──────────────────────┘      └──────────────────────┘
     │            ↑ ouvre la fenêtre de lecture de SA trace GPS
     │
  awaiting_      une seule des deux parties a confirmé la rencontre
  confirmation
     │
  closed        les DEUX ont confirmé  →  fidélité créditée, commission inscrite
```

### `en_route` appartient à celui qui se déplace

C'est le seul changement de la machine à états, et il est décisif.

`en_route_at` **ouvre la fenêtre de lecture de la trace** : `proveArrival()`
ignore tout point GPS antérieur à cet horodatage. Si le garagiste pouvait poser
cet horodatage dans une demande `at_garage`, il démarrerait le chronomètre du
trajet de quelqu'un d'autre — au mieux trop tôt, au pire après que le client soit
déjà arrivé, ce qui **effacerait sa trace entière** et rendrait une preuve vide
sur une intervention réelle.

Le serveur applique donc :

```ts
// apps/api/src/modules/requests/requests.service.ts — declareEnRoute()
const traveller = travellerFor(request.service_mode);
if (role !== traveller) throw forbidden(…);
```

### Les deux confirmations d'arrivée ne changent pas

`garage_arrived_at` et `client_arrived_at` gardent leur rôle : **chaque partie
reconnaît que la rencontre a eu lieu**, et la clôture exige les deux.

Leur nom date du temps où un seul mode existait. En `at_garage`, le garagiste
n'« arrive » nulle part — il est déjà chez lui. On ne les a pas renommés : ces
noms sont cités dans une contrainte SQL, dans le contrat partagé, dans le mobile
et dans le registre des commissions, et le coût du renommage serait payé partout
pour un gain de vocabulaire. À la place, la migration `0009` pose un
`COMMENT ON COLUMN` sur chacun — la documentation vit dans la base, là où le
prochain lecteur regardera.

---

## 5. D'où viennent les traces

**Bonne nouvelle : il n'y a rien eu à construire.** Les deux traces existaient
déjà.

### La table `position_pings`

```
position_pings
  request_id   quelle demande
  user_id      quel compte
  role         'client' | 'garage'   ← la colonne qui rend tout possible
  location     le point GPS
  recorded_at  quand
```

Les **deux** parties y écrivent depuis toujours. Le téléphone envoie sa position
tant que l'écran de suivi est ouvert, et le serveur en déduit le rôle à partir du
compte connecté (`recordPosition`) — personne ne déclare son propre rôle.

Lire la bonne trace se réduit donc à passer le bon rôle :

```ts
findTrail(db, requestId, geometry.traveller)   // 'garage' ou 'client'
```

### Une contrainte à connaître : un véhicule garé n'émet plus

Pour ne pas dévorer un forfait data camerounais, le téléphone n'envoie un point
que s'il a bougé d'au moins quinze mètres. **Un véhicule à l'arrêt cesse
complètement d'émettre.**

Cela semble être un défaut ; c'est en réalité le signal le plus fiable dont on
dispose. Une trace qui **s'arrête** au lieu de s'éloigner est exactement la
signature d'une arrivée. Un simple passage devant laisse au contraire des points
qui continuent.

C'est le critère `settled` de `proveArrival()`, et il fonctionne à l'identique
dans les deux modes.

---

## 6. Ce qu'on affirme à la fin, et sur quoi

`proveArrival()` rend quatre niveaux, du plus faible au plus fort :

| Niveau | Ce qu'il veut dire | Facturable |
|---|---|---|
| `none` | Aucune trace n'établit un déplacement. | non |
| `weak` | Trajet trop court, ou intervention trop brève. | non |
| `trail` | La trace GPS établit le déplacement. | **oui** |
| `mutual` | La trace l'établit **et** les deux parties en conviennent. | **oui** |

Trois signaux, lus dans cet ordre :

1. **`settled`** — le dernier point de la fenêtre est dans les 150 m de la
   destination ;
2. **`travelledMeters`** — le trajet a une longueur réelle ;
3. **`dwellSeconds`** — la demande a vécu assez longtemps après l'arrivée.

**Les seuils sont identiques dans les deux modes**, et c'est délibéré : un client
qui habite en face de l'atelier n'a pas davantage « été apporté » qu'un garagiste
qui traverse la rue. La fraude symétrique se traite symétriquement.

> ⚠️ La double confirmation d'arrivée ne **crée** aucun droit à facturation : elle
> ne fait que hisser une preuve déjà acquise de `trail` à `mutual`. C'est
> volontaire — dès qu'une confirmation conditionnerait la facture, le débiteur
> aurait intérêt à la retenir.

---

## 7. Ce qui est conservé pour plus tard

Chaque intervention close écrit **une ligne** dans `commission_ledger`, y compris
quand rien n'est dû. Une ligne manquante ne se compte pas ; c'est tout l'intérêt
d'un registre d'observation.

```
commission_ledger
  request_id     la demande, qui porte la trace complète
  garage_id      qui doit
  client_id      qui a été apporté
  service_mode   ← LE SENS DE L'INTERVENTION
  proof_level    none | weak | trail | mutual
  travelled_m    mètres réellement parcourus
  dwell_s        secondes passées sur place
  closest_m      distance la plus courte atteinte
  tariff_class   light | heavy
  repeat_pair    ce client était-il déjà venu chez ce garage ?
  amount_xaf     ce qu'on AURAIT facturé
  state          pending | confirmed | reversed | waived
  state_reason   pourquoi rien n'est dû, en clair
```

**`service_mode` est indispensable ici.** Sans lui, `travelled_m` est un nombre
sans sujet : *quatre kilomètres parcourus par qui ?* Le registre a précisément
pour but d'être relu dans deux mois pour fixer le barème, et un relevé qu'on ne
sait pas interpréter ne fixe rien.

### Répondre à « qui est allé vers qui ? », concrètement

```sql
-- Combien d'interventions dans chaque sens, et lesquelles ont produit une preuve
SELECT service_mode,
       COUNT(*)                                    AS interventions,
       COUNT(*) FILTER (WHERE proof_level IN ('trail','mutual')) AS prouvees,
       ROUND(AVG(travelled_m))                     AS metres_moyens
FROM commission_ledger
GROUP BY service_mode;
```

```sql
-- Une intervention précise : ce qui avait été convenu au départ (journal, en
-- ajout seul) face à ce que la demande dit aujourd'hui.
SELECT r.service_mode                    AS mode_courant,
       e.payload ->> 'serviceMode'       AS mode_declare_a_la_creation,
       e.created_at                      AS declare_le
FROM assistance_requests r
JOIN request_events e ON e.request_id = r.id AND e.type = 'created'
WHERE r.id = '…';
```

```sql
-- La trace brute d'une intervention, dans le bon rôle selon le mode.
SELECT p.recorded_at,
       ST_Y(p.location::geometry) AS lat,
       ST_X(p.location::geometry) AS lng
FROM position_pings p
JOIN assistance_requests r ON r.id = p.request_id
WHERE r.id = '…'
  AND p.role = CASE r.service_mode WHEN 'on_site' THEN 'garage' ELSE 'client' END
ORDER BY p.recorded_at;
```

### Étalonner avant de facturer

```sh
npm run audit:arrivals
```

Le script relit **toutes** les interventions terminées et compte :

- les **faux négatifs** — demandes closes (donc une rencontre a bien eu lieu)
  dont la preuve n'atteint pas `trail`. C'est l'erreur coûteuse : elle fait fuir
  les garages honnêtes ;
- les **faux positifs** — demandes annulées (personne ne devrait être venu) dont
  la preuve est facturable. C'est l'erreur qui casse la confiance.

Il ne modifie rien. Il faut le relancer maintenant que les deux modes coexistent :
c'est lui qui dira si les seuils, calibrés sur des dépanneuses, conviennent aussi
à des clients au volant.

---

## 8. Où sont les boutons, et ce qu'ils disent

### Côté client — déclarer la panne

**`apps/mobile/app/sos/declarer.tsx`, étape 2**, une nouvelle section
« **Comment on se retrouve** », placée **après** les deux constats
(immobilisé / passagers vulnérables).

L'ordre suit la dépendance : on ne peut pas répondre « je vais au garage » sans
avoir d'abord dit si le véhicule roule. Placée plus haut, la question aurait
obligé à revenir en arrière.

```
▌COMMENT ON SE RETROUVE

  ┌──────────────────────────────────────────┐
  │ ⛟  Le garagiste vient                    │  ← sélectionné : aplat encre
  │    Il se rend là où vous êtes en panne.  │
  ├──────────────────────────────────────────┤
  │ 🚗  Je vais au garage                    │
  │    Vous conduisez jusqu'à son atelier.   │
  └──────────────────────────────────────────┘
```

Deux lignes **empilées**, pas deux touches côte à côte : chaque option porte sa
conséquence en clair, ce qui demande une ligne entière. L'aplat est **encre, pas
rouge** — le rouge de ce formulaire appartient au danger et au bouton d'envoi ;
l'étendre à une sélection ordinaire le viderait au moment où il doit alerter.

Véhicule immobilisé, le sélecteur **disparaît** et laisse une phrase :

```
▌COMMENT ON SE RETROUVE
  ⛟  Votre véhicule ne roule plus : le garagiste se déplacera jusqu'à vous.
```

Un choix impossible qu'on grise reste un choix qu'on a proposé. Sur un écran
d'urgence, chaque option écartée est une seconde gagnée.

> Cocher « immobilisé » **remet le mode à `on_site`** automatiquement. Sans cela,
> quelqu'un qui choisit « je vais au garage » puis se ravise garderait un
> brouillon que le serveur refuse — et il l'apprendrait à l'envoi, après le
> récapitulatif, sur un écran d'urgence.

Le mode apparaît ensuite dans le **récapitulatif** (étape 3), juste sous
l'urgence : c'est la dernière chose relue avant d'envoyer, et celle qui décide de
ce qui va se passer dans la demi-heure.

### Côté client — le suivi

`apps/mobile/app/suivi/[requestId].tsx` aiguille sur le mode vers **deux écrans
distincts** :

| Mode | Écran | Ce qu'on y fait |
|---|---|---|
| `on_site` | `LiveTracking` | on attend, on regarde le dépanneur approcher, on confirme |
| `at_garage` | `DriveToGarage` | on **déclare son départ**, on conduit, on confirme |

`DriveToGarage` est un écran séparé et non un jeu de conditions : sur l'un on est
assis au bord d'une route et l'écran répond à « où en est-il ? » ; sur l'autre on
conduit et il répond à « où je vais ». Les empiler aurait produit un composant
dont la moitié des lignes commencent par un `if`.

```
   avant le départ (accepted)          après (en_route → awaiting_confirmation)
 ┌──────────┬──────────────────┐      ┌──────────┬──────────────────┐
 │ Appeler  │   Je pars     →  │      │ Appeler  │  Je suis arrivé ✓│
 └──────────┴──────────────────┘      └──────────┴──────────────────┘
```

> **« Je pars » n'ouvre aucune boîte de confirmation.** C'est une décision
> technique déguisée en choix d'ergonomie : ce bouton écrit `en_route_at`, donc
> **ouvre la fenêtre de lecture de la trace**. Un geste de plus, c'est un geste
> qu'on saute — et un trajet qu'on ne saura pas prouver. Le risque inverse est
> nul : appuyer trop tôt élargit la fenêtre, ce qui ne fausse rien.

Aux abords de l'atelier, une **feuille de proximité** remplace la barre d'action
et pose directement la question — « Vous y êtes ? / J'y suis ». Y répondre puis
devoir confirmer qu'on a bien voulu répondre serait le clic de trop qu'elle
existe pour supprimer.

Le panneau et le rail de progression sont **les mêmes composants** dans les deux
sens ; seuls trois libellés changent de sujet :

| `on_site` | `at_garage` |
|---|---|
| Arrive dans | Vous arrivez dans |
| En route | Vous roulez |
| Sur place | À l'atelier |

### Côté garagiste — la file

`apps/mobile/src/jobs/JobRow.tsx` : une étiquette **`À L'ATELIER`** à côté de
l'étiquette d'urgence — **uniquement** sur `at_garage`.

L'omission est le sujet. Le déplacement est le cas fondateur ; le marquer sur
chaque ligne en ferait un ornement qu'on cesse de voir. Ce qui mérite un signe,
c'est l'exception.

Le défaut silencieux est aussi le défaut **sûr** : un garagiste qui ignore que ce
marqueur existe lit une ligne nue et suppose qu'il doit y aller — ce qui est
exact. L'inverse aurait envoyé une dépanneuse pour rien.

### Côté garagiste — la fiche

`apps/mobile/app/interventions/[requestId].tsx` : un **bandeau**, cette fois pour
**les deux** modes, placé juste avant le tableau de bord.

```
┃ ⛟  DÉPLACEMENT
┃    Vous vous rendez sur le lieu de la panne.

┃ 🚗  À L'ATELIER
┃    Le client conduit jusqu'à votre atelier. Ne sortez rien.
```

Pourquoi les deux ici, alors que la liste n'en montre qu'un ? Parce qu'on
*parcourt* une file mais qu'on *s'engage* sur une fiche. Devant un bouton
« Accepter », une information absente n'est pas un défaut sûr : c'est une
supposition, et elle porte sur la seule chose à préparer avant de répondre —
sortir un véhicule, ou ne pas le sortir.

Le bandeau est **avant** les chiffres parce qu'il change leur lecture : les mêmes
3,2 km sont une distance à parcourir dans un cas, la longueur du trajet que le
client est en train de faire dans l'autre. La cellule « approche » devient
d'ailleurs « **trajet client** » en `at_garage`.

**La barre d'action a désormais trois issues** au lieu de deux :

| Situation | Bouton principal |
|---|---|
| `accepted`, `on_site` | **Y aller** → ouvre l'itinéraire |
| `accepted`, `at_garage` | *En attente du départ du client* (inerte) |
| `en_route` / arrivée à confirmer | **Je suis arrivé** |
| arrivée déjà confirmée | *Arrivée enregistrée — en attente du client* (inerte) |

Le bouton reste **visible et inerte** plutôt qu'absent : sa disparition ferait
sauter la barre d'un écran à l'autre, et son libellé est précisément
l'information utile.

> Accepter une demande `at_garage` **n'ouvre plus l'écran d'itinéraire**. Y
> pousser le garagiste l'enverrait chercher un client déjà en route.

### L'historique

`apps/mobile/src/history/RequestCard.tsx` : la même étiquette `À L'ATELIER` sur la
ligne qui nomme l'autre partie — *avec qui* et *où*, les deux moitiés de la même
information. Et le libellé d'état passe par `requestStatusLabel(status, mode)` :
sans cela, un client qui a conduit lui-même relirait « Garagiste en route » dans
son propre historique.

---

## 9. La carte des fichiers

| Fichier | Ce qu'il porte |
|---|---|
| `packages/shared/src/taxonomy.ts` | `SERVICE_MODES`, les libellés, `SERVICE_MODE_TRAVELLER`, `isServiceModeAllowed` |
| `packages/shared/src/billing.ts` | **`serviceGeometry()`**, `proveArrival()`, les seuils, le barème |
| `packages/shared/src/contracts/requests.ts` | le champ `serviceMode`, son refus sur véhicule immobilisé, `requestStatusLabel()` |
| `packages/shared/src/contracts/jobs.ts` | `serviceMode` sur la file, `nextJobAction()` par mode |
| `apps/api/migrations/0009_service_mode.sql` | les colonnes, la contrainte, les commentaires en base |
| `…/requests/requests.service.ts` | écriture à la création, `declareEnRoute` par voyageur, itinéraire par mode |
| `…/requests/arrival.ts` | la preuve, liée au mode |
| `…/requests/commission.ts` | le registre, lié au mode |
| `apps/mobile/src/sos/ServiceModePicker.tsx` | le choix, côté client |
| `apps/mobile/src/ui/ServiceModeTag.tsx` | l'étiquette (liste) et le bandeau (fiche) |
| `apps/mobile/src/tracking/DriveToGarage.tsx` | le suivi quand le client conduit |

---

## 10. Ce qu'on n'a pas fait, et pourquoi

### Changer de mode en cours de route

Un client annonce « je viens », puis sa voiture cale. Aujourd'hui il doit annuler
et refaire une demande.

Le corriger demanderait l'**accord des deux parties** — sinon le garagiste
apprendrait en chemin qu'il n'a plus rien à faire, ou l'inverse — donc un état de
négociation dans la machine à états, avec ce qu'il faut prévoir quand l'un refuse
le contre-choix de l'autre. C'est un vrai morceau, et il ne se justifie qu'une
fois qu'on saura à quelle fréquence le cas se produit.

**La structure est déjà prête** : le mode vit dans une colonne (donc modifiable)
doublée d'un événement de journal en ajout seul (donc l'historique du changement
serait conservé). Il n'y aurait qu'un type d'événement `mode_changed` à ouvrir et
une route à écrire.

### Les tarifs

Hors sujet ici, et volontairement. `TARIFF_XAF` porte des montants
**d'hypothèse** : le registre tourne en observation, il écrit ce qu'on *aurait*
facturé sans qu'un franc ne change de main. C'est lui qui, dans deux mois, dira
ce que le barème doit devenir — et notamment si un client qui se déplace vaut
autant qu'un garagiste qui se déplace. Le basculement ne coûtera qu'une constante.

### Renommer `garage_arrived_at` / `client_arrived_at`

Voir §4. Le gain est de vocabulaire, le coût s'étale sur une contrainte SQL, un
contrat partagé, quatre écrans et un registre. On a documenté en base à la place.

---

## 11. Vérifier que tout tient

```sh
npm run typecheck        # les trois espaces de travail
npm run test             # 119 tests partagés + 137 mobiles
npm run db:migrate       # applique 0009
npm run audit:arrivals   # étalonne la preuve sur les données réelles
```

Les tests qui gardent spécifiquement ce dispositif :

| Fichier | Ce qu'il empêche |
|---|---|
| `packages/shared/src/billing.test.ts` | qu'un trajet client cesse d'être prouvable ; qu'on relise la trace du mauvais voyageur ; que les seuils divergent entre les deux modes |
| `packages/shared/src/contracts/requests.test.ts` | qu'un véhicule immobilisé puisse choisir l'atelier ; que les libellés d'état oublient le mode |
| `packages/shared/src/contracts/jobs.test.ts` | qu'un garagiste puisse déclarer un départ qu'il ne fait pas |

---

## Glossaire

| Terme | Définition |
|---|---|
| **demande** (`assistance_request`) | un SOS, de sa création à sa clôture |
| **mode de service** | le sens de la rencontre : `on_site` ou `at_garage` |
| **voyageur** (`traveller`) | la partie qui se déplace dans ce mode |
| **trace** | la suite des points GPS d'un téléphone sur une demande (`position_pings`) |
| **journal** (`request_events`) | l'histoire de la demande, en ajout seul, jamais modifiée |
| **preuve d'arrivée** | ce que la trace permet d'affirmer : `none`, `weak`, `trail`, `mutual` |
| **fenêtre de lecture** | l'intervalle `[départ déclaré, fin connue]` hors duquel les points sont ignorés |
| **`settled`** | la trace se **termine** près de la destination au lieu de repartir — la signature d'une arrivée |
| **registre des commissions** | `commission_ledger` : une ligne par intervention terminée, avec ce sur quoi elle se fonde |
