-- Ouverture d'un garage à un instant donné.
--
-- Calculé en base plutôt qu'en JavaScript pour que le filtre « Ouverts » de la
-- maquette 01 puisse s'appliquer DANS la requête de proximité : filtrer après
-- coup fausserait la numérotation des marqueurs, qui doit porter sur les
-- garages réellement proposés.
--
-- Le Cameroun est à UTC+1 toute l'année (pas d'heure d'été) : la conversion est
-- stable, mais on passe quand même par la zone IANA plutôt que par un décalage
-- codé en dur.

CREATE OR REPLACE FUNCTION garage_is_open(hours JSONB, at_moment TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
DECLARE
  local_ts   TIMESTAMP;
  day_key    TEXT;
  spec       TEXT;
  open_time  TIME;
  close_time TIME;
  now_time   TIME;
BEGIN
  -- Horaires inconnus : on n'exclut pas le garage. Mieux vaut proposer un
  -- garage peut-être fermé que masquer le seul garage à 2 km.
  IF hours IS NULL THEN
    RETURN TRUE;
  END IF;

  local_ts := at_moment AT TIME ZONE 'Africa/Douala';

  -- ISODOW plutôt que to_char(..., 'Dy') : indépendant de la locale du serveur.
  day_key := (ARRAY['mon','tue','wed','thu','fri','sat','sun'])[
    EXTRACT(ISODOW FROM local_ts)::int
  ];

  spec := hours ->> day_key;

  IF spec IS NULL OR spec = 'closed' THEN
    RETURN FALSE;
  END IF;

  IF spec = '24h' THEN
    RETURN TRUE;
  END IF;

  BEGIN
    open_time  := split_part(spec, '-', 1)::TIME;
    close_time := split_part(spec, '-', 2)::TIME;
  EXCEPTION WHEN OTHERS THEN
    -- Horaire mal formé en base : on ne fait pas planter une recherche SOS
    -- pour une donnée sale.
    RETURN TRUE;
  END;

  now_time := local_ts::TIME;

  -- Plage franchissant minuit, ex. « 20:00-02:00 ».
  IF close_time <= open_time THEN
    RETURN now_time >= open_time OR now_time < close_time;
  END IF;

  RETURN now_time >= open_time AND now_time < close_time;
END;
$$ LANGUAGE plpgsql STABLE;
