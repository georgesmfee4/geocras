-- Horodatage du choix du garage.
--
-- La demande porte déjà `created_at`, `accepted_at`, `en_route_at` — tout le
-- cycle de vie sauf le passage `pending → selected`, qui est pourtant le seul
-- que le client regarde en direct : c'est à partir de là qu'il attend une
-- réponse, et l'écran d'attente affiche ce temps-là.
--
-- Sans cette colonne, le mobile n'avait que `created_at` comme point de
-- départ, c'est-à-dire l'ouverture du formulaire de panne — les minutes
-- passées à comparer les garages étaient comptées comme du temps d'attente du
-- garagiste. Le compteur démarrait donc à plusieurs minutes sur un garage qui
-- venait tout juste d'être prévenu.
--
-- NULL sur les lignes antérieures, et sur toute demande encore `pending` : le
-- mobile retombe alors sur `created_at`, ce qui reste vrai à défaut d'être
-- précis.
ALTER TABLE assistance_requests
  ADD COLUMN IF NOT EXISTS selected_at TIMESTAMPTZ;
