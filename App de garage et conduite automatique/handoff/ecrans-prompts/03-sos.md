# ÉCRAN — Déclarer une panne

> Joindre : `ecrans/02-declarer-panne.png`

---

Implémente le formulaire de déclaration de panne, conforme à la maquette jointe.

- En-tête « Signaler une panne » avec flèche retour, et **barre de progression en 3 segments**
  (2 remplis en rouge, 1 en `#E2DDD1`).
- **Type de véhicule** : 3 tuiles de 64 px — Voiture, Moto, Camion. La tuile active est
  `#1C1A17` avec le pictogramme rouge et le libellé blanc en majuscules.
- **Nature de la panne** : puces qui se **réordonnent automatiquement selon le véhicule
  choisi**, la plus probable en premier. Mention « tri auto » en mono à droite du libellé.

Liste complète des pannes à gérer, par véhicule :

| Voiture | Moto | Camion |
|---|---|---|
| Batterie / démarrage | Batterie | Batterie / démarrage |
| Pneu crevé | Pneu crevé | Pneu crevé |
| Surchauffe moteur | Chaîne / transmission | Surchauffe moteur |
| Panne sèche | Panne sèche | Panne sèche |
| Freins | Freins | Freins / air |
| Embrayage | Carburateur | Embrayage |
| Boîte de vitesse | Démarreur | Boîte de vitesse |
| Alternateur | Fuite d'huile | Circuit pneumatique |
| Direction / suspension | Éclairage | Suspension / essieu |
| Électricité / éclairage | Accident | Chargement / arrimage |
| Accident | Autre | Accident |
| Autre | | Autre |

- **Précisions** : champ libre, 70 px, placeholder « Aucun bruit au contact, les phares
  faiblissent… ».
- Ajoute aussi, car c'est utile en situation réelle et absent de la maquette —
  **propose-les-moi avant de les implémenter** : photo de la panne, niveau d'urgence
  (peut attendre / bloquant / danger), véhicule immobilisé oui-non, et présence de
  passagers vulnérables.
- Pied fixe : rappel de la position en mono avec pastille verte + bouton
  « Lancer la recherche SOS » chamfré.

Le formulaire doit pouvoir être envoyé en moins de 15 secondes. Rien d'obligatoire
sauf le type de véhicule et la nature de la panne.
