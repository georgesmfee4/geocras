# -*- coding: utf-8 -*-
import sys; sys.path.insert(0, '/home/user/geocras/docs/cahier-des-charges')
from svgkit import *

s = Svg(1560, 1290)
T = {}

def table(key, x, y, w, name, cols, accent=INK, note=None):
    hh = 30
    h = hh + 6 + len(cols) * 15 + 6
    s.rect(x, y, w, h, fill=BG, stroke=accent, sw=1.7)
    s.rect(x, y, w, hh, fill=PANEL, stroke=accent, sw=1.7)
    s.text(x + 10, y + 20, name, size=12.5, weight="700", font=MONO)
    if note:
        s.text(x + w - 10, y + 20, note, size=9.5, fill=MUTED, anchor="end", italic=True)
    cy = y + hh + 17
    for col, kind in cols:
        col_c = INK
        pre = ""
        if kind == "pk":
            pre, col_c = "PK ", RED_DK
        elif kind == "fk":
            pre, col_c = "FK ", BLUE
        elif kind == "uk":
            pre, col_c = "UK ", GREEN
        elif kind == "geo":
            pre, col_c = "◆  ", "#1B6B4A"
        else:
            pre = "   "
        s.text(x + 10, cy, pre + col, size=10, fill=col_c,
               font=MONO, weight="700" if kind in ("pk", "fk", "uk", "geo") else "400")
        cy += 15
    T[key] = (x, y, w, h)

def fk_same(a, b, ay, by, spine, side="left"):
    """Relation entre deux tables d'une même colonne : contournement par la gouttière."""
    ax, ayy, aw, ah = T[a]
    bx, byy, bw, bh = T[b]
    y1, y2 = ayy + ay, byy + by
    if side == "left":
        e1, e2, d = ax, bx, 1
    else:
        e1, e2, d = ax + aw, bx + bw, -1
    s.path(f"M {e1} {y1} L {spine} {y1} L {spine} {y2} L {e2} {y2}", stroke=INK2, sw=1.3)
    s.circle(e1 - 5 * d, y1, 3.2, fill=BG, stroke=INK2, sw=1.2)
    s.path(f"M {e2} {y2} l {-9*d} -5 M {e2} {y2} l {-9*d} 0 M {e2} {y2} l {-9*d} 5",
           stroke=INK2, sw=1.3)


def fk(a, b, ay, by, label="", route=None):
    """Relation 1..n : patte de corbeau côté enfant."""
    ax, ayy, aw, ah = T[a]
    bx, byy, bw, bh = T[b]
    x1 = ax + aw if ax < bx else ax
    x2 = bx if ax < bx else bx + bw
    y1, y2 = ayy + ay, byy + by
    if route is None:
        mx = (x1 + x2) / 2
    else:
        mx = route
    s.path(f"M {x1} {y1} L {mx} {y1} L {mx} {y2} L {x2} {y2}", stroke=INK2, sw=1.3)
    s.circle(x1 + (5 if ax < bx else -5), y1, 3.2, fill=BG, stroke=INK2, sw=1.2)
    d = 1 if x2 > mx else -1
    s.path(f"M {x2} {y2} l {-9*d} -5 M {x2} {y2} l {-9*d} 0 M {x2} {y2} l {-9*d} 5",
           stroke=INK2, sw=1.3)
    if label:
        s.text(mx + 6, (y1 + y2) / 2, label, size=9.5, fill=MUTED, italic=True)

# ---------------- colonne gauche ----------------
table("users", 90, 40, 300, "users", [
    ("id  UUID", "pk"), ("full_name  TEXT", ""), ("phone  TEXT", "uk"),
    ("email  TEXT", "uk"), ("password_hash  TEXT", ""),
    ("role  TEXT  CHECK(client|garage_owner|admin)", ""),
    ("city  TEXT", ""), ("locale  TEXT  CHECK(fr|en)", ""),
    ("loyalty_points  INTEGER  >= 0", ""),
    ("referral_code  TEXT", "uk"), ("referred_by  UUID → users", "fk"),
    ("created_at / updated_at  TIMESTAMPTZ", ""),
], accent=RED)

table("tokens", 90, 290, 300, "refresh_tokens", [
    ("id  UUID", "pk"), ("user_id  UUID → users", "fk"),
    ("token_hash  TEXT", "uk"), ("expires_at  TIMESTAMPTZ", ""),
    ("revoked_at  TIMESTAMPTZ", ""),
])

table("vehicles", 90, 430, 300, "vehicles", [
    ("id  UUID", "pk"), ("user_id  UUID → users", "fk"),
    ("type  TEXT  CHECK(car|moto|truck)", ""),
    ("brand / model / plate  TEXT", ""), ("year  INTEGER  1950..2100", ""),
    ("is_default  BOOLEAN", ""),
], note="1 seul défaut / user")

table("ledger", 90, 590, 300, "loyalty_ledger", [
    ("id  UUID", "pk"), ("user_id  UUID → users", "fk"),
    ("delta_points  INTEGER", ""), ("reason  TEXT  CHECK(6 valeurs)", ""),
    ("state  TEXT  CHECK(pending|confirmed|reversed)", ""),
    ("request_id  UUID → assistance_requests", "fk"),
    ("idempotency_key  TEXT", "uk"), ("confirmed_at  TIMESTAMPTZ", ""),
], accent=GREEN)

table("ubadges", 90, 780, 300, "user_badges", [
    ("user_id  UUID → users", "pk"), ("badge_id  TEXT → badges", "pk"),
    ("unlocked_at  TIMESTAMPTZ", ""),
])

table("badges", 90, 890, 300, "badges", [
    ("id  TEXT", "pk"), ("label_fr / label_en  TEXT", ""),
    ("tone  TEXT  CHECK(primary|warning|muted)", ""), ("sort_order  INTEGER", ""),
])

table("sessions", 90, 1010, 300, "driving_sessions", [
    ("id  UUID", "pk"), ("user_id  UUID → users", "fk"),
    ("client_session_id  TEXT", "uk"),
    ("started_at / ended_at  TIMESTAMPTZ", ""),
    ("distance_m  DOUBLE", ""), ("max/avg_speed_kmh  REAL", ""),
    ("alert_count  INTEGER", ""), ("score  INTEGER  0..100", ""),
], accent=AMBER)

# ---------------- colonne centrale ----------------
table("req", 560, 40, 380, "assistance_requests", [
    ("id  UUID", "pk"), ("client_id  UUID → users", "fk"),
    ("vehicle_id  UUID → vehicles", "fk"), ("garage_id  UUID → garages", "fk"),
    ("vehicle_type  TEXT  CHECK(car|moto|truck|other)", ""),
    ("vehicle_label  TEXT   (obligatoire si other)", ""),
    ("problem_type  TEXT", ""), ("description  TEXT", ""),
    ("urgency  TEXT  CHECK(can_wait|blocking|danger)", ""),
    ("immobilized / vulnerable_passengers  BOOL", ""),
    ("photo_url  TEXT", ""),
    ("origin  GEOGRAPHY(POINT,4326)", "geo"), ("accuracy_m  REAL", ""),
    ("service_mode  TEXT  CHECK(on_site|at_garage)", ""),
    ("status  TEXT  CHECK(7 valeurs)", ""),
    ("last_seq  INTEGER", ""),
    ("created_at / selected_at / accepted_at", ""),
    ("en_route_at / closed_at / cancelled_at", ""),
    ("garage_arrived_at  TIMESTAMPTZ", ""),
    ("client_arrived_at  TIMESTAMPTZ", ""),
], accent=RED, note="1 seule active / client")

table("events", 560, 470, 380, "request_events", [
    ("id  BIGSERIAL", "pk"), ("request_id  UUID → assistance_requests", "fk"),
    ("seq  INTEGER", "uk"), ("actor_user_id  UUID → users", "fk"),
    ("actor_role  TEXT  CHECK(client|garage)", ""),
    ("type  TEXT  CHECK(9 valeurs)", ""), ("payload  JSONB", ""),
    ("location  GEOGRAPHY(POINT,4326)", "geo"),
], note="UNIQUE (request_id, seq)")

table("pings", 560, 680, 380, "position_pings", [
    ("id  BIGSERIAL", "pk"), ("request_id  UUID → assistance_requests", "fk"),
    ("user_id  UUID → users", "fk"), ("role  TEXT  CHECK(client|garage)", ""),
    ("location  GEOGRAPHY(POINT,4326)", "geo"),
    ("speed_mps / heading_deg / accuracy_m  REAL", ""),
    ("recorded_at  TIMESTAMPTZ", ""),
], accent=BLUE, note="preuve de mouvement")

table("alerts", 560, 890, 380, "driving_alerts", [
    ("id  BIGSERIAL", "pk"), ("session_id  UUID → driving_sessions", "fk"),
    ("type  TEXT  CHECK(5 valeurs)", ""),
    ("severity  TEXT  CHECK(critical|warning|info)", ""),
    ("at_speed_kmh / distance_m  REAL", ""), ("occurred_at  TIMESTAMPTZ", ""),
], accent=AMBER)

# ---------------- colonne droite ----------------
table("garages", 1170, 40, 360, "garages", [
    ("id  UUID", "pk"), ("owner_user_id  UUID → users", "fk"),
    ("name / description / phone / email  TEXT", ""),
    ("location  GEOGRAPHY(POINT,4326)", "geo"),
    ("address_label / quarter / city  TEXT", ""),
    ("certified  BOOLEAN", ""), ("certified_at  TIMESTAMPTZ", ""),
    ("verified_at  TIMESTAMPTZ", ""),
    ("rating  NUMERIC(2,1)  0..5", ""), ("review_count  INTEGER", ""),
    ("services  TEXT[]", ""), ("specialties  TEXT[]", ""), ("photos  TEXT[]", ""),
    ("opening_hours  JSONB", ""), ("years_in_business  INTEGER", ""),
    ("is_active  BOOLEAN", ""),
], accent=RED, note="1 garage / propriétaire")

table("reviews", 1170, 400, 360, "reviews", [
    ("id  UUID", "pk"),
    ("request_id  UUID → assistance_requests", "uk"),
    ("garage_id  UUID → garages", "fk"), ("user_id  UUID → users", "fk"),
    ("rating  INTEGER  1..5", ""), ("comment  TEXT", ""),
], note="UNIQUE : un avis par demande")

table("commission", 1170, 992, 360, "commission_ledger", [
    ("id  UUID", "pk"),
    ("request_id  UUID → assistance_requests", "uk"),
    ("garage_id  UUID → garages", "fk"),
    ("client_id  UUID → users", "fk"),
    ("service_mode  TEXT", ""),
    ("proof_level  TEXT  none|weak|trail|mutual", ""),
    ("travelled_m / dwell_s / closest_m", ""),
    ("tariff_class  TEXT  light|heavy", ""),
    ("repeat_pair  BOOLEAN", ""),
    ("amount_xaf  INTEGER", ""),
    ("state  TEXT  pending|confirmed|reversed|waived", ""),
    ("state_reason  TEXT", ""),
    ("idempotency_key  TEXT", "uk"),
], accent=GREEN, note="une ligne par intervention close")

# ---------------- relations ----------------
fk_same("users", "tokens", 118, 62, 20)
fk_same("users", "vehicles", 130, 77, 34)
fk_same("users", "ledger", 142, 62, 48)
fk_same("users", "ubadges", 154, 47, 62)
fk_same("badges", "ubadges", 47, 77, 76)
fk_same("users", "sessions", 166, 62, 12)
fk("sessions", "alerts", 47, 62, route=470)
fk("users", "req", 82, 62, route=470)
fk("vehicles", "req", 62, 77, route=500)
fk("req", "events", 47, 62, route=1000)
fk("req", "pings", 47, 62, route=1020)
fk("req", "reviews", 62, 77, route=1060)
fk("garages", "req", 62, 92, route=1080)
fk_same("garages", "reviews", 200, 92, 1546, side="right")
fk("req", "commission", 300, 62, route=1092)
fk("users", "garages", 94, 62, route=1100)

# ---------------- légende ----------------
s.rect(1170, 560, 360, 168, fill=PANEL, stroke=RULE, sw=1.2, rx=3)
s.rect(1186, 578, 14, 2.2, fill=RED, stroke="none", sw=0)
s.text(1208, 583, "LÉGENDE", size=10.5, fill=INK2, weight="700", ls="1.4")
leg = [("PK", "clé primaire", RED_DK), ("FK", "clé étrangère", BLUE),
       ("UK", "contrainte d'unicité", GREEN), ("◆", "colonne géographique PostGIS", "#1B6B4A")]
yy = 606
for tag, txt, col in leg:
    s.text(1188, yy, tag, size=10, fill=col, font=MONO, weight="700")
    s.text(1222, yy, txt, size=10.5, fill=INK2)
    yy += 18
s.text(1188, yy + 6, "La patte de corbeau marque le côté « plusieurs ».", size=10, fill=MUTED, italic=True)
s.text(1188, yy + 22, "14 tables, 4 index GIST/GIN, 2 déclencheurs.", size=10, fill=MUTED, italic=True)

# ---------------- index ----------------
s.rect(1170, 756, 360, 200, fill=PANEL, stroke=RULE, sw=1.2, rx=3)
s.rect(1186, 774, 14, 2.2, fill=RED, stroke="none", sw=0)
s.text(1208, 779, "INDEX DÉCISIFS", size=10.5, fill=INK2, weight="700", ls="1.4")
s.lines(1186, 804, [
    "garages_location_idx        GIST (location)",
    "garages_certified_location  GIST partiel",
    "garages_services_idx        GIN (services)",
    "requests_origin_idx         GIST (origin)",
    "requests_one_active_per_client_idx",
    "vehicles_single_default_idx",
    "request_events_replay_idx   (request_id, seq)",
    "pings_role_idx  (request_id, role, recorded_at)",
    "loyalty_state_idx  partiel sur pending",
], size=9.5, fill=INK, lh=15, font=MONO)

s.save("figures/08-schema-bd.svg")
print("ok")
