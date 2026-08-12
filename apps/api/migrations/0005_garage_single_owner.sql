-- Un compte, un garage.
--
-- L'inscription « devenir garagiste » crée un garage et promeut le compte. Le
-- service vérifie déjà qu'il n'en existe pas un autre, mais deux envois du
-- formulaire à une seconde d'intervalle — réseau lent, l'utilisateur appuie
-- deux fois — passeraient tous deux la vérification avant qu'aucun n'ait
-- inséré. On se retrouverait avec deux garages au même endroit, dont un
-- fantôme que son propriétaire ne verrait jamais dans « Mon garage » (la
-- lecture n'en rend qu'un) mais qui remonterait dans les SOS.
--
-- L'index partiel laisse `owner_user_id` NULL en autant d'exemplaires qu'on
-- veut : c'est l'état des garages du seed, et celui d'un garage dont le
-- propriétaire a supprimé son compte.
CREATE UNIQUE INDEX IF NOT EXISTS garages_owner_idx
  ON garages (owner_user_id)
  WHERE owner_user_id IS NOT NULL;
