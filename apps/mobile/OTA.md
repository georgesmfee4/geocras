# Mises à jour à distance (OTA)

Publier un correctif JavaScript ou un asset **sans repasser par les stores**.
Le service est EAS Update ; le projet est `d40a680e-be65-413a-a47c-5e52c287ca8f`.

> **Toutes les commandes se lancent depuis `apps/mobile/`**, jamais depuis la
> racine du dépôt : c'est là que vivent l'`app.json` et l'`eas.json` du mobile.

## Ce qui passe en OTA, ce qui n'y passe pas

| Change | Passe en OTA |
|---|---|
| Code TypeScript, écrans, styles, traductions | oui |
| Images, polices, fichiers de `assets/` | oui |
| Nouvelle dépendance **native** (`expo install …`), permission Android/iOS, plugin de config, icône, splash | **non — nouveau build** |

La règle n'est pas déclarative, elle est calculée : `runtimeVersion` suit la
politique `fingerprint`, une empreinte de tout ce qui compose le binaire. Ajouter
un module natif change l'empreinte, et la mise à jour ne descend alors que sur
les binaires reconstruits — jamais sur les anciens, qui n'auraient pas le code
natif correspondant et planteraient au lancement.

## Canaux

Un canal par profil de build (`eas.json`). Le binaire est marqué au moment du
build et ne va plus chercher ailleurs.

| Profil | Canal |
|---|---|
| `development` | `development` |
| `preview` | `preview` |
| `production` | `production` |

## Publier

```sh
cd apps/mobile

# Vérifier ce qui partirait, sans rien publier
eas update --channel preview --message "fix(sos): …" --dry-run

# Publier
eas update --channel preview --message "fix(sos): …"
```

Le message reprend la convention de commit du projet — c'est lui qu'on relit
dans `eas update:list` six mois plus tard.

## Vérifier

```sh
eas update:list --branch <branche>     # ce qui a été publié
eas channel:view production            # ce que le canal sert aujourd'hui
```

Dans l'app : **Paramètres → À propos → Mise à jour**. La ligne affiche l'état de
la liaison, et le pied de page l'identifiant court de la version en cours
d'exécution (`GEOCRAS V1.0.0 · a1b2c3d4`) — c'est ce numéro qu'on demande au
téléphone quand un bug ne se reproduit pas.

## Revenir en arrière

```sh
eas update:roll-back-to-embedded --channel production   # retour au code du binaire
eas update:republish --group <id>                        # ou republier une version connue
```

## Ce que l'app fait, et ce qu'elle ne fait pas

`checkAutomatically: ON_LOAD` cherche et télécharge au lancement, en tâche de
fond ; `fallbackToCacheTimeout: 0` garantit que l'ouverture n'attend jamais le
réseau. Le nouveau code prend effet au **lancement suivant**.

**Aucun redémarrage automatique n'est déclenché en cours d'usage.** Une app qu'on
ouvre au bord de la route ne se recharge pas sous les doigts de son utilisateur ;
le seul `reloadAsync()` du projet est celui de la ligne des réglages, et il est
explicite. Voir `src/updates/useOtaUpdate.ts`.

## En développement

L'OTA est inactive sur serveur Metro et dans le client de développement :
`Updates.isEnabled` vaut `false`, la ligne des réglages affiche `DÉVELOPPEMENT`.
Pour tester réellement, il faut un build `preview` ou `production` installé.
