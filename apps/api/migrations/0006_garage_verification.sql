-- Vérification d'un garage inscrit depuis l'app.
--
-- Jusqu'ici, tout garage entrait par le seed : une liste montée à la main,
-- donc vérifiée par construction. « Devenir garagiste » ouvre la porte à des
-- dossiers déclarés par leur propre auteur, et un garage inventé qui remonte
-- dans un SOS envoie quelqu'un en panne vers une adresse qui n'existe pas.
--
-- Trois ajouts :
--
-- 1. `email` — l'adresse par laquelle on répond au dossier. Le téléphone sert
--    au client, l'e-mail sert à nous ; les confondre obligerait à appeler pour
--    dire « c'est validé ».
--
-- 2. `verified_at` — la date de la vérification, NULL tant qu'elle n'a pas eu
--    lieu. Volontairement distinct de `certified` : vérifier, c'est constater
--    que le garage existe ; certifier, c'est répondre de sa qualité. Un garage
--    vérifié non certifié est le cas normal.
--
-- 3. La contrainte qui lie les deux : **un garage non vérifié ne peut pas être
--    actif**. C'est ce qui garantit qu'aucun chemin de code — présent ou futur,
--    y compris un `PATCH /me/garage` mal gardé — ne peut faire entrer un
--    dossier en attente dans les résultats de recherche.
ALTER TABLE garages ADD COLUMN IF NOT EXISTS email       TEXT;
ALTER TABLE garages ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Les garages déjà en base viennent du seed : ils sont vérifiés par nature, et
-- la contrainte posée juste après les rejetterait sinon.
UPDATE garages SET verified_at = created_at WHERE verified_at IS NULL;

ALTER TABLE garages DROP CONSTRAINT IF EXISTS active_requires_verification;
ALTER TABLE garages ADD CONSTRAINT active_requires_verification
  CHECK (NOT is_active OR verified_at IS NOT NULL);

-- Les dossiers en attente se listent par date d'arrivée : c'est la file de
-- travail de la vérification.
CREATE INDEX IF NOT EXISTS garages_pending_verification_idx
  ON garages (created_at)
  WHERE verified_at IS NULL;
