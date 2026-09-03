-- Registre des commissions.
--
-- GeoCras se rémunère en apportant des clients aux garages. Cette table est le
-- livre où cet apport s'écrit — une ligne par intervention terminée, disant ce
-- que le garage doit et sur quelle preuve.
--
-- ⚠️ **Rien n'est prélevé pour l'instant, et c'est le but.** La table tourne en
-- observation : elle enregistre ce qu'on *aurait* facturé, sans qu'un franc ne
-- change de main. Au bout de deux mois on saura combien de clients ont été
-- apportés, dans quelle proportion de dépannages légers et lourds, combien de
-- clients reviennent chez le même garage — et le barème se décidera sur ces
-- chiffres au lieu d'une intuition. Le jour du basculement, seule une constante
-- change.
--
-- La discipline est celle de `loyalty_ledger`, et pour la même raison : dès
-- qu'il s'agit d'argent, on n'incrémente pas une colonne, on écrit une ligne.
-- La clé d'idempotence est ce qui rend une reprise après incident inoffensive.

CREATE TABLE commission_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  garage_id       UUID NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  -- La demande reste jointe : c'est elle qui porte la trace GPS, le type de
  -- panne et les horodatages sur lesquels la ligne peut être rejustifiée.
  request_id      UUID NOT NULL REFERENCES assistance_requests(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  amount_xaf      INTEGER NOT NULL CHECK (amount_xaf >= 0),

  -- Ce sur quoi le montant se fonde. Conservés à côté du montant et non
  -- recalculés à la demande : le barème changera, et un relevé de mars doit
  -- rester lisible avec les règles de mars.
  tariff_class    TEXT NOT NULL CHECK (tariff_class IN ('light', 'heavy')),
  proof_level     TEXT NOT NULL CHECK (proof_level IN ('none', 'weak', 'trail', 'mutual')),
  -- Ce client était-il déjà venu chez ce garage par GeoCras ? Détermine la
  -- remise de moitié, et mesure à lui seul la fidélisation d'une paire.
  repeat_pair     BOOLEAN NOT NULL DEFAULT false,
  problem_type    TEXT NOT NULL,

  -- Les mètres et les secondes qui ont fondé la preuve. Ils permettent de
  -- reclasser l'historique si les seuils bougent, sans nouvelle migration et
  -- sans relire les millions de points de `position_pings`.
  travelled_m     INTEGER,
  dwell_s         INTEGER,
  closest_m       INTEGER,

  state           TEXT NOT NULL DEFAULT 'pending'
                    CHECK (state IN ('pending', 'confirmed', 'reversed', 'waived')),
  -- Pourquoi la ligne a été annulée ou n'a fait naître aucune dette. Toujours
  -- renseignée sur ces deux états : une écriture sans motif est une écriture
  -- qu'on ne saura pas défendre trois mois plus tard.
  state_reason    TEXT,

  -- Verrou d'idempotence, comme sur le journal de fidélité : une clôture rejouée
  -- ne peut pas facturer deux fois la même intervention.
  idempotency_key TEXT NOT NULL UNIQUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at      TIMESTAMPTZ,

  -- Une dette réglée porte sa date, et rien d'autre n'en porte.
  CONSTRAINT settled_has_timestamp CHECK (
    (state = 'confirmed') = (settled_at IS NOT NULL)
  ),

  -- Un montant nul n'attend pas d'être réglé : il est né sans dette.
  CONSTRAINT zero_is_waived CHECK (
    amount_xaf > 0 OR state IN ('waived', 'reversed')
  ),

  CONSTRAINT closed_states_have_reason CHECK (
    state NOT IN ('waived', 'reversed') OR state_reason IS NOT NULL
  )
);

-- Le relevé mensuel d'un garage : c'est la lecture la plus fréquente, et la
-- seule que le garagiste verra lui-même.
CREATE INDEX commission_garage_idx ON commission_ledger (garage_id, created_at DESC);

-- Les lignes qui attendent un règlement, pour le jour où le portefeuille
-- existera. Index partiel : les lignes réglées ou sans dette n'y entrent pas.
CREATE INDEX commission_due_idx ON commission_ledger (garage_id, created_at)
  WHERE state = 'pending';

-- Une intervention ne s'écrit qu'une fois. La clé d'idempotence l'impose déjà ;
-- cet index le dit dans le vocabulaire du métier et sert les jointures inverses.
CREATE UNIQUE INDEX commission_request_idx ON commission_ledger (request_id);
