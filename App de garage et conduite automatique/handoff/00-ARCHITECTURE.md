# PROMPT 1 — Architecture (à envoyer en TOUT PREMIER)

> Ne joins aucune maquette à ce prompt. L'objectif est un plan, pas du code.

---

Tu vas m'aider à construire **GeoCras**, une application mobile de géolocalisation de garages
et d'assistance à la conduite, destinée au marché camerounais (Yaoundé en premier).

## Étape 1 — Lis l'existant AVANT de proposer quoi que ce soit

À la racine se trouve un dossier `geocras-backend` issu d'un travail précédent.

1. Explore-le entièrement : structure, modèles de données, routes, dépendances, ce qui
   fonctionne, ce qui est incomplet, ce qui est mort.
2. Fais-moi un **état des lieux honnête** : ce qui est réutilisable tel quel, ce qui doit
   être refactoré, ce qui doit être jeté — et pourquoi.
3. Ne code rien pour l'instant.

## Étape 2 — Le produit à construire


**Deux fonctionnalités principales, accessibles par un bottom tab à 2 entrées :**

### A. Géolocalisation de garages
- La position de l'utilisateur est captée automatiquement au lancement.
- Bouton **SOS** : l'utilisateur déclare une panne (type de véhicule, nature du problème
  triée automatiquement selon le véhicule, description libre) ; sa position part avec.
- Les garages s'affichent **sur une carte**, en marqueurs **numérotés par pertinence**
  (1 = le plus pertinent selon le tri actif).
- Tri au choix : **plus proche**, **mieux noté** (1 à 5 étoiles), **certifié**.
- Distinction visuelle nette entre garage **certifié** et non certifié.
- Clic sur un marqueur → fiche contextuelle : nom, distance, note, badge, boutons
  **Appeler** et **Itinéraire**.
- Itinéraire tracé sur la carte avec distance et durée.
- **Suivi bidirectionnel** : après l'appel, le garagiste peut se déclarer « en route ».
  L'app affiche alors les deux ETA (garagiste → client, client → garage), recalculés
  selon la vitesse de déplacement réelle. Chacun peut confirmer son arrivée ;
  l'événement est horodaté et archivé dans l'historique.
- Avis : note 1–5 étoiles + commentaire, lecture des avis des autres.
- Badges de fidélité (voir section dédiée plus bas).

### B. Mode conduite
- Démarrer / Pause / Stop.
- Statistiques temps réel : vitesse, distance, durée, nombre d'alertes, score.
- Alertes : feu rouge devant, obstacle, véhicule dans l'angle mort (gauche/droite),
  choc latéral.
- **Cette partie est une SIMULATION** — pas de capteurs réels en v1. Mais la simulation
  doit être crédible et pilotée par un moteur d'événements propre et remplaçable,
  pour qu'on puisse brancher de vrais capteurs plus tard sans réécrire l'UI.

### Transverse
- Drawer latéral (menu 3 barres en haut) : Profil, Sécurité, Assistance (numéro vert),
  Paramètres, Historique.
- Mode clair et mode sombre.
- Français par défaut, anglais prévu.

### Fidélité — contexte Cameroun
Points gagnés sur actions vérifiées (dépannage confirmé des deux côtés, avis publié,
parrainage). Paliers convertis en **remises chez les garages certifiés**, et à terme en
**équivalent Mobile Money (MTN / Orange)**. La double confirmation d'arrivée sert de
preuve anti-fraude avant tout crédit de points.

## Étape 3 — Ce que j'attends de toi maintenant

Propose-moi une architecture complète, en tenant compte de ce que tu as trouvé dans
`geocras-backend` :

1. **Arborescence de fichiers** (mobile et serveur), avec la justification des choix.
2. **Schémas de données** : collections, champs, index — en particulier l'index géospatial
   `2dsphere` et la stratégie de requête pour le tri par pertinence.
3. **Contrats d'API** : liste des endpoints, méthode, payload, réponse.
4. **Gestion d'état** côté mobile : que mettre où, et pourquoi.
5. **Temps réel** : ta recommandation (Socket.io, polling, autre) avec les compromis.
6. **Cartographie** : Mapbox vs Google Maps pour le Cameroun — coût, couverture des
   données routières locales, possibilité de styliser la carte.
7. **Ordre de construction** : les étapes, chacune testable isolément.
8. **Les 3 risques techniques principaux** de ce projet et comment tu les traiterais.

Pose-moi toutes les questions nécessaires avant de répondre.
**Ne génère aucun code tant que je n'ai pas validé le plan.**
