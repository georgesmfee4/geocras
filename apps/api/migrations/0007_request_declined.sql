-- Le refus d'un garage, distinct de l'annulation.
--
-- Jusqu'ici un garagiste qui ne pouvait pas intervenir n'avait qu'une sortie :
-- annuler. C'est-à-dire fermer le SOS de quelqu'un qui est en panne au bord
-- d'une route, et l'obliger à tout ressaisir pour en trouver un autre. La
-- machine à états y gagne sa seule marche arrière — `selected → pending` — qui
-- ne retire que le garage : la demande garde son identifiant, son journal et
-- son ancienneté.
--
-- Rien à changer sur `assistance_requests` : `garage_set_after_selection`
-- autorise déjà `garage_id IS NULL` en `pending`, et l'index d'unicité de
-- demande active compte `pending` comme active. Le retour en arrière tombe donc
-- exactement dans ce que le schéma prévoyait pour une demande sans garage.
--
-- Seul le journal doit s'ouvrir : `declined` est un événement à part entière,
-- et non un `cancelled` déguisé. C'est lui qui portera le taux de refus par
-- garage, et lui qui explique après coup pourquoi une demande a traversé trois
-- ateliers avant d'aboutir.
ALTER TABLE request_events DROP CONSTRAINT IF EXISTS request_events_type_check;
ALTER TABLE request_events ADD CONSTRAINT request_events_type_check
  CHECK (type IN (
    'created', 'garage_selected', 'declined', 'accepted', 'en_route',
    'position', 'arrival_confirmed', 'closed', 'cancelled'));

-- Refus d'un garage donné, retrouvés sans parcourir tout le journal.
--
-- L'index porte sur le type seul et non sur le garage : celui-ci vit dans
-- `payload`, et les refus sont une fraction infime des événements — le filtre
-- partiel suffit à ramener la lecture à quelques lignes.
CREATE INDEX IF NOT EXISTS request_events_declined_idx
  ON request_events (request_id, created_at DESC)
  WHERE type = 'declined';
