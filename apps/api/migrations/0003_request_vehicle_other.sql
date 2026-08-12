-- Véhicule « Autre » sur une demande d'assistance.
--
-- Le parc camerounais déborde de voiture/moto/camion : tricycles, minibus,
-- bus de transport, engins. Refuser une demande SOS parce que le véhicule
-- n'entre pas dans trois cases n'est pas tenable pour un service d'urgence.
--
-- La contrepartie est une contrainte, pas une convention : `other` **exige**
-- un libellé. Sans lui la ligne serait inexploitable pour le garagiste, qui
-- ne saurait ni quel outillage sortir ni quel véhicule d'intervention prendre.
-- On l'écrit en CHECK plutôt qu'en validation applicative, pour la même raison
-- que la double confirmation d'arrivée : une règle qui protège la donnée ne
-- doit pas pouvoir être contournée par un futur appelant.
--
-- La table `vehicles` n'est **pas** touchée. Un véhicule enregistré sert à
-- préremplir des demandes futures : il a besoin d'un type exploitable, pas
-- d'une chaîne libre.

ALTER TABLE assistance_requests
  DROP CONSTRAINT IF EXISTS assistance_requests_vehicle_type_check;

ALTER TABLE assistance_requests
  ADD CONSTRAINT assistance_requests_vehicle_type_check
  CHECK (vehicle_type IN ('car', 'moto', 'truck', 'other'));

ALTER TABLE assistance_requests
  ADD COLUMN IF NOT EXISTS vehicle_label TEXT;

ALTER TABLE assistance_requests
  DROP CONSTRAINT IF EXISTS vehicle_other_requires_label;

ALTER TABLE assistance_requests
  ADD CONSTRAINT vehicle_other_requires_label
  CHECK (
    vehicle_type <> 'other'
    OR (vehicle_label IS NOT NULL AND length(btrim(vehicle_label)) >= 2)
  );

-- Même logique pour la panne « Autre » : le libellé ne dit rien, seule la
-- description porte l'information sur laquelle le garage se décide.
ALTER TABLE assistance_requests
  DROP CONSTRAINT IF EXISTS problem_other_requires_description;

ALTER TABLE assistance_requests
  ADD CONSTRAINT problem_other_requires_description
  CHECK (
    problem_type <> 'other'
    OR length(btrim(description)) >= 3
  );
