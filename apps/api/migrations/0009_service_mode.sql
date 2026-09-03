-- Les deux façons de se rencontrer.
--
-- Jusqu'ici GeoCras ne connaissait qu'un seul scénario : le garagiste sort son
-- véhicule et se rend là où la panne s'est produite. C'est le cas fondateur,
-- celui du bord de route. Mais la moitié des pannes n'immobilisent rien — un
-- voyant, un bruit, un frein qui mollit — et le client conduit alors lui-même
-- jusqu'à l'atelier. Ce trajet-là existait déjà en pratique ; il n'existait
-- nulle part dans les données.
--
-- Une colonne, deux valeurs, et tout le reste en découle :
--
--   on_site    le garagiste va vers le client   → sa trace est la preuve
--   at_garage  le client va vers le garagiste   → la trace du client est la preuve
--
-- ⚠️ **La preuve d'arrivée change de sens avec cette colonne.** Elle lit la
-- trace de celui qui se déplace, mesurée vers le point qu'il devait atteindre.
-- Sans le mode, une intervention `at_garage` produirait une trace de garage
-- immobile — donc `proof_level = 'none'`, donc un client réellement apporté
-- que l'on ne saurait pas facturer. Voir `serviceGeometry()` dans
-- `packages/shared/src/billing.ts`, et `MODES-DE-SERVICE.md` à la racine.

-- ---------------------------------------------------------------------------
-- Le mode sur la demande
-- ---------------------------------------------------------------------------

-- `on_site` par défaut, et ce n'est pas un choix esthétique : c'est le seul
-- comportement qui existait avant cette migration. Toutes les lignes déjà en
-- base décrivent bien un garagiste qui s'est déplacé, et le défaut les remplit
-- avec la vérité plutôt qu'avec une hypothèse.
ALTER TABLE assistance_requests
  ADD COLUMN service_mode TEXT NOT NULL DEFAULT 'on_site'
    CHECK (service_mode IN ('on_site', 'at_garage'));

-- Un véhicule immobilisé ne conduit personne nulle part.
--
-- Troisième barrière sur la même règle. Le formulaire grise l'option, le
-- contrat zod refuse le corps de requête, et cette contrainte interdit la
-- ligne. Les deux premières protègent d'une erreur et d'un client trafiqué ;
-- celle-ci nous protège de nous-mêmes — d'un futur script d'import, d'une
-- reprise de données, d'un chemin de code qui ne passerait par aucune des deux
-- autres. C'est la discipline de `closed_requires_both_arrivals`, appliquée à
-- la seule combinaison de champs qui soit physiquement impossible.
ALTER TABLE assistance_requests
  ADD CONSTRAINT at_garage_requires_rolling_vehicle CHECK (
    service_mode = 'on_site' OR immobilized = false
  );

-- La file d'un garage se lit désormais mode par mode : « qu'est-ce qui
-- m'attend à l'atelier ? » n'est pas la même question que « où dois-je
-- aller ? ». L'index existant porte déjà (garage_id, status) ; celui-ci le
-- prolonge sans le remplacer.
CREATE INDEX requests_garage_mode_idx
  ON assistance_requests (garage_id, service_mode, status);

-- ---------------------------------------------------------------------------
-- Ce que les deux horodatages d'arrivée veulent dire
-- ---------------------------------------------------------------------------
--
-- Leur nom date du temps où un seul mode existait, et il induirait en erreur
-- maintenant qu'il y en a deux : en `at_garage`, le garagiste n'« arrive »
-- nulle part — il est déjà chez lui. Ce que la colonne a toujours enregistré,
-- en réalité, c'est *cette partie a reconnu que la rencontre avait eu lieu*.
--
-- On ne les renomme pas : ces deux noms sont cités dans la contrainte
-- `closed_requires_both_arrivals`, dans le contrat partagé, dans le mobile et
-- dans le registre des commissions. Le coût d'un renommage serait payé partout
-- pour un gain de vocabulaire. On documente donc dans la base elle-même, là où
-- le prochain lecteur regardera.
COMMENT ON COLUMN assistance_requests.garage_arrived_at IS
  'Instant où le GARAGE a reconnu la rencontre. En on_site il est arrivé sur place ; en at_garage il constate que le client est à l''atelier.';
COMMENT ON COLUMN assistance_requests.client_arrived_at IS
  'Instant où le CLIENT a reconnu la rencontre. En on_site il constate que le dépanneur est là ; en at_garage il est arrivé à l''atelier.';
COMMENT ON COLUMN assistance_requests.en_route_at IS
  'Départ déclaré par CELUI QUI SE DÉPLACE — le garage en on_site, le client en at_garage. Ouvre la fenêtre de lecture de la trace GPS.';
COMMENT ON COLUMN assistance_requests.service_mode IS
  'Qui se déplace vers qui. Fixé à la création, jamais modifié. Commande la lecture de la preuve d''arrivée.';

-- ---------------------------------------------------------------------------
-- Le mode dans le registre des commissions
-- ---------------------------------------------------------------------------
--
-- Sans lui, `travelled_m` est un nombre sans sujet : quatre kilomètres
-- parcourus par qui ? Le registre a précisément pour but d'être relu dans deux
-- mois pour fixer le barème, et un relevé qu'on ne sait pas interpréter ne
-- fixe rien. La colonne est donc rangée avec les autres témoins de la preuve —
-- `tariff_class`, `proof_level`, `repeat_pair` — et pour la même raison : on
-- conserve ce sur quoi le montant s'est fondé, on ne le recalcule pas.
ALTER TABLE commission_ledger
  ADD COLUMN service_mode TEXT NOT NULL DEFAULT 'on_site'
    CHECK (service_mode IN ('on_site', 'at_garage'));

COMMENT ON COLUMN commission_ledger.travelled_m IS
  'Mètres parcourus par celui qui se déplace — voir service_mode sur la même ligne.';
