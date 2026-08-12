# PROMPT 5 — Suivi temps réel & notifications

> Joindre : `ecrans/04-itineraire-suivi.png`. À faire après le backend et l'écran 04.

---

Implémente le suivi bidirectionnel entre client et garagiste.

## Scénario complet

1. Le client appelle le garage depuis la fiche.
2. À la fin de l'appel, le garagiste appuie sur **« Je suis en route »** dans son interface.
3. Le client reçoit une notification et l'écran de suivi s'ouvre.
4. Les deux ETA s'affichent en parallèle et se recalculent en continu :
   - **garagiste → client**, à partir de sa position et de sa **vitesse de déplacement réelle**
   - **client → garage**, si c'est le client qui se déplace
5. Le premier arrivé appuie sur **« Confirmer l'arrivée »**.
6. L'événement est horodaté, la demande passe en clôturée, et elle rejoint l'historique
   des deux parties.

## Contraintes

- Socket.io avec `room` par `requestId`.
- Émission de position **throttlée** (toutes les 3 à 5 s, pas à chaque tick GPS) — le
  réseau mobile camerounais est irrégulier et les forfaits data comptent.
- **Reconnexion automatique** avec rattrapage d'état : une coupure réseau ne doit pas
  casser le suivi.
- ETA lissé sur une moyenne glissante, pas sur la dernière mesure brute, sinon le chiffre
  saute et devient anxiogène.
- Notifications push (`expo-notifications`) : « en route », « arrivé », « demande acceptée ».
- Mode dégradé : si le socket tombe, bascule sur du polling toutes les 15 s et affiche
  discrètement l'état de la connexion.

Le bandeau de suivi affiche « MAJ 3s » en mono — cet indicateur doit refléter la
fraîcheur réelle de la donnée, pas être décoratif.
