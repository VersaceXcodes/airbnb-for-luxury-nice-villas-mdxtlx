-- =========================================================
-- 01  CREATE DATABASE (run outside as superuser if needed)
-- =========================================================
-- CREATE DATABASE estates;

-- =========================================================
-- 02  ENUMS & SMALL INTERNAL HELPERS
--     (we use CHECK constraints instead of native ENUM
--     so that we remain plugin-free and portable)
-- =========================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE DOMAIN user_role_enum AS text;
    END IF;
END$$;

-- =========================================================
-- 03  CORE TABLES
-- =========================================================

-- users
CREATE TABLE IF NOT EXISTS users (
    id                  text PRIMARY KEY,
    email               text     NOT NULL UNIQUE,
    phone_e164          text,
    hashed_password     text     NOT NULL,
    first_name          text     NOT NULL,
    last_name           text     NOT NULL,
    display_name        text     NOT NULL,
    avatar_url          text,
    role                text     NOT NULL CHECK (role IN ('guest','host','admin')),
    onboarding_step     integer  NOT NULL DEFAULT 0,
    created_at          text     NOT NULL,
    updated_at          text     NOT NULL,
    deleted_at          text,
    audit_meta          json
);

-- user_sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id           text PRIMARY KEY,
    user_id      text NOT NULL REFERENCES users(id),
    expires_at   text NOT NULL,
    ip           text,
    user_agent   text
);

-- villas
CREATE TABLE IF NOT EXISTS villas (
    id                         text PRIMARY KEY,
    host_user_id               text NOT NULL REFERENCES users(id),
    slug                       text NOT NULL UNIQUE,
    title                      text NOT NULL,
    description                text NOT NULL,
    location_data              json NOT NULL,
    bedrooms_total             integer NOT NULL,
    bathrooms_total            integer NOT NULL,
    max_guests                 integer NOT NULL,
    max_pets                   integer NOT NULL DEFAULT 0,
    policies                   json NOT NULL,
    base_price_usd_per_night   numeric(12,2) NOT NULL,
    cleaning_fee_usd           numeric(12,2) NOT NULL,
    service_fee_ratio          numeric(5,2)  NOT NULL,
    damage_waiver_ratio        numeric(5,2)  NOT NULL,
    published                  boolean NOT NULL DEFAULT false,
    status                     text NOT NULL CHECK (status IN ('draft','under_review','live','suspended')),
    search_text_vector          text,
    tags_array                 json,
    created_at                 text NOT NULL,
    updated_at                 text NOT NULL,
    deleted_at                 text,
    audit_meta                 json
);

-- room_types
CREATE TABLE IF NOT EXISTS room_types (
    id       text PRIMARY KEY,
    villa_id text NOT NULL REFERENCES villas(id),
    type     text NOT NULL CHECK (type IN ('bedroom','bathroom','living_area','pool')),
    name     text NOT NULL,
    beds_json json
);

-- amenities
CREATE TABLE IF NOT EXISTS amenities (
    id          text PRIMARY KEY,
    villa_id    text NOT NULL REFERENCES villas(id),
    amenity_key text NOT NULL,
    value       boolean NOT NULL,
    note        text
);

-- bookings
CREATE TABLE IF NOT EXISTS bookings (
    id                 text PRIMARY KEY,
    guest_user_id      text NOT NULL REFERENCES users(id),
    villa_id           text NOT NULL REFERENCES villas(id),
    check_in           text NOT NULL,  -- ISO date
    check_out          text NOT NULL,  -- ISO date
    adults             integer NOT NULL,
    children           integer NOT NULL,
    infants            integer NOT NULL,
    total_base_usd     numeric(12,2) NOT NULL,
    total_fees_usd     numeric(12,2) NOT NULL,
    total_taxes_usd    numeric(12,2) NOT NULL,
    total_usd          numeric(12,2) NOT NULL,
    balance_usd        numeric(12,2) NOT NULL,
    status             text NOT NULL CHECK (status IN ('inquiry','in_progress','confirmed','cancelled','completed')),
    contract_signed_at text,
    contract_pdf_url   text,
    payment_intent_id  text,
    created_at         text NOT NULL,
    updated_at         text NOT NULL,
    deleted_at         text
);

-- booking_addons
CREATE TABLE IF NOT EXISTS booking_addons (
    booking_id         text NOT NULL REFERENCES bookings(id),
    addon_key          text NOT NULL,
    units              integer NOT NULL,
    price_per_unit_usd numeric(12,2) NOT NULL,
    total_usd          numeric(12,2) NOT NULL,
    PRIMARY KEY (booking_id, addon_key)
);

-- payments
CREATE TABLE IF NOT EXISTS payments (
    id                text PRIMARY KEY,
    booking_id        text NOT NULL REFERENCES bookings(id),
    charge_id         text NOT NULL,
    charged_amount_usd numeric(12,2) NOT NULL,
    refunded_amount_usd numeric(12,2) NOT NULL DEFAULT 0,
    currency          text NOT NULL,
    status            text NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
    created_at        text NOT NULL
);

-- calendar_events
CREATE TABLE IF NOT EXISTS calendar_events (
    id          text PRIMARY KEY,
    villa_id    text NOT NULL REFERENCES villas(id),
    event_type  text NOT NULL CHECK (event_type IN ('blocked','booking','manual_hold')),
    start_date  text NOT NULL,
    end_date    text NOT NULL,
    booking_id  text REFERENCES bookings(id),
    note        text,
    created_at  text NOT NULL
);

-- pricing_rules
CREATE TABLE IF NOT EXISTS pricing_rules (
    id                   text PRIMARY KEY,
    villa_id             text NOT NULL REFERENCES villas(id),
    rule_type            text NOT NULL CHECK (rule_type IN ('season','weekend','event','min_stay','discount_week','discount_month')),
    start_date           text,
    end_date             text,
    adjustment_fixed_usd numeric(12,2),
    adjustment_percent   numeric(5,2),
    min_nights           integer,
    priority             integer NOT NULL,
    created_at           text NOT NULL
);

-- inquiries
CREATE TABLE IF NOT EXISTS inquiries (
    id                     text PRIMARY KEY,
    guest_user_id          text NOT NULL REFERENCES users(id),
    villa_id               text NOT NULL REFERENCES villas(id),
    message                text NOT NULL,
    requested_check_in     text NOT NULL,
    requested_check_out    text NOT NULL,
    status                 text NOT NULL CHECK (status IN ('pending','accepted','declined','expired')),
    response_price_change  numeric(12,2),
    response_message       text,
    created_at             text NOT NULL
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
    id             text PRIMARY KEY,
    booking_id     text REFERENCES bookings(id),
    sender_user_id text NOT NULL REFERENCES users(id),
    body           text NOT NULL,
    sent_at        text NOT NULL,
    read_at        text
);

-- guest_reviews
CREATE TABLE IF NOT EXISTS guest_reviews (
    id             text PRIMARY KEY,
    booking_id     text UNIQUE NOT NULL REFERENCES bookings(id),
    guest_user_id  text NOT NULL REFERENCES users(id),
    villa_id       text NOT NULL REFERENCES villas(id),
    ratings        json NOT NULL,
    content        text NOT NULL,
    photos         json,
    created_at     text NOT NULL
);

-- host_reviews
CREATE TABLE IF NOT EXISTS host_reviews (
    id             text PRIMARY KEY,
    booking_id     text NOT NULL REFERENCES bookings(id),
    host_user_id   text NOT NULL REFERENCES users(id),
    guest_user_id  text NOT NULL REFERENCES users(id),
    ratings        json NOT NULL,
    content        text NOT NULL,
    created_at     text NOT NULL
);

-- loyalty_credits
CREATE TABLE IF NOT EXISTS loyalty_credits (
    id           text PRIMARY KEY,
    guest_user_id text NOT NULL REFERENCES users(id),
    booking_id    text NOT NULL REFERENCES bookings(id),
    amount_usd    numeric(12,2) NOT NULL,
    expires_at    text NOT NULL,
    redeemed_at   text,
    created_at    text NOT NULL
);

-- hosts
CREATE TABLE IF NOT EXISTS hosts (
    user_id              text PRIMARY KEY REFERENCES users(id),
    company_name         text,
    payout_currency      text NOT NULL DEFAULT 'usd',
    payout_schedule      text NOT NULL CHECK (payout_schedule IN ('daily','weekly','monthly')),
    stripe_account_id    text,
    onboarding_complete  boolean NOT NULL DEFAULT false
);

-- payouts
CREATE TABLE IF NOT EXISTS payouts (
    id                text PRIMARY KEY,
    host_user_id      text NOT NULL REFERENCES hosts(user_id),
    stripe_payout_id  text NOT NULL,
    amount_usd        numeric(12,2) NOT NULL,
    status            text NOT NULL CHECK (status IN ('scheduled','paid','failed')),
    transaction_ids   json NOT NULL,
    payout_date       text NOT NULL,
    created_at        text NOT NULL
);

-- damage_reports
CREATE TABLE IF NOT EXISTS damage_reports (
    id                 text PRIMARY KEY,
    booking_id         text NOT NULL REFERENCES bookings(id),
    reporter_user_id   text NOT NULL REFERENCES users(id),
    damage_description text NOT NULL,
    estimated_cost_usd numeric(12,2) NOT NULL,
    photos             json,
    status             text NOT NULL CHECK (status IN ('open','resolved','closed','disputed')),
    created_at         text NOT NULL
);

-- moderation_queues
CREATE TABLE IF NOT EXISTS moderation_queues (
    id                     text PRIMARY KEY,
    villa_id               text NOT NULL REFERENCES villas(id),
    queue_name             text NOT NULL,
    status                 text NOT NULL CHECK (status IN ('pending','approved','rejected')),
    notes                  text,
    assigned_admin_user_id text REFERENCES users(id),
    created_at             text NOT NULL
);

-- tickets
CREATE TABLE IF NOT EXISTS tickets (
    id                 text PRIMARY KEY,
    subject            text NOT NULL,
    reporter_user_id   text NOT NULL REFERENCES users(id),
    booking_id         text REFERENCES bookings(id),
    department         text NOT NULL CHECK (department IN ('guest_support','host_support','ops')),
    priority           text NOT NULL CHECK (priority IN ('low','high','urgent')),
    assigned_user_id   text REFERENCES users(id),
    status             text NOT NULL CHECK (status IN ('open','closed','escalated')),
    responses          json NOT NULL,
    created_at         text NOT NULL
);

-- cms_pages
CREATE TABLE IF NOT EXISTS cms_pages (
    id         text PRIMARY KEY,
    slug       text NOT NULL UNIQUE,
    title      text NOT NULL,
    body_md    text NOT NULL,
    published  boolean NOT NULL DEFAULT false,
    updated_at text NOT NULL
);

-- file_uploads
CREATE TABLE IF NOT EXISTS file_uploads (
    id               text PRIMARY KEY,
    uploader_user_id text NOT NULL REFERENCES users(id),
    purpose          text NOT NULL CHECK (purpose IN ('villa_photo','guidebook_pdf','contract_pdf','damage_evidence')),
    file_url         text NOT NULL,
    mime_type        text NOT NULL,
    file_size_bytes  bigint NOT NULL,
    created_at       text NOT NULL
);

-- wishlists
CREATE TABLE IF NOT EXISTS wishlists (
    id             text PRIMARY KEY,
    guest_user_id  text NOT NULL REFERENCES users(id),
    name           text NOT NULL,
    created_at     text NOT NULL
);

-- wishlist_items
CREATE TABLE IF NOT EXISTS wishlist_items (
    wishlist_id text NOT NULL REFERENCES wishlists(id),
    villa_id    text NOT NULL REFERENCES villas(id),
    added_at    text NOT NULL,
    PRIMARY KEY (wishlist_id, villa_id)
);

-- saved_searches
CREATE TABLE IF NOT EXISTS saved_searches (
    id              text PRIMARY KEY,
    guest_user_id   text NOT NULL REFERENCES users(id),
    name            text NOT NULL,
    criteria_json   json NOT NULL,
    alert_enabled   boolean NOT NULL DEFAULT true,
    created_at      text NOT NULL
);

-- guidebooks
CREATE TABLE IF NOT EXISTS guidebooks (
    id        text PRIMARY KEY,
    villa_id  text NOT NULL REFERENCES villas(id),
    title     text NOT NULL,
    content_md text NOT NULL,
    pdf_url   text,
    created_at text NOT NULL
);

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_villas_published ON villas (published);
CREATE INDEX IF NOT EXISTS idx_villas_max_guests ON villas (max_guests);
CREATE INDEX IF NOT EXISTS idx_bookings_all_links ON bookings (guest_user_id, villa_id, status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_villa ON calendar_events (villa_id);

-- VERY LIGHT RUM / GIN is avoided – JSON indexes stay generic BTree-ish for now
-- because no extension requirements.

-- =========================================================
-- 04  SEED DATA
--     (all IDs are simply random 22-char strings prefixed
--      here for immediate dev & staging use)
-- =========================================================

-- 04.1  USERS
INSERT INTO users
(id, email, phone_e164, hashed_password, first_name, last_name, display_name, avatar_url, role, onboarding_step, created_at, updated_at, audit_meta) VALUES
('usr_admin_000000000000000001', 'admin@estates.com', '+1234567890', '$2b$12$hEjZd7xZ5P2j3xFxg2aXSu', 'Super', 'Admin', 'Admin Boss', 'https://picsum.photos/seed/admin/200/200', 'admin', 9, NOW()::text, NOW()::text, '{}'),
('usr_host_000000000000000002',  'jeff@bezoshost.net', NULL,'$2b$12$hEjZd7xZ5P2j3xFxg2aXSv','Jeff','BezosHost','Jeff B', 'https://picsum.photos/seed/jeffh/200/200', 'host', 5, NOW()::text, NOW()::text, '{}');

-- generate 40 more hosts
INSERT INTO users
(id, email, hashed_password, first_name, last_name, display_name, role, created_at, updated_at)
SELECT
   'usr_host_' || LPAD(gs::text, 16, '0'),
   'host' || gs || '@test.com',
   '$2b$12$' || substr(md5(random()::text), 0, 28),
   'First' || gs,
   'Last' || gs,
   'Host #' || gs,
   'host',
   NOW()::text,
   NOW()::text
FROM generate_series(3, 42) AS gs;

-- generate 500 guests
INSERT INTO users
(id, email, hashed_password, first_name, last_name, display_name, role, created_at, updated_at)
SELECT
   'usr_guest_' || LPAD(gs::text, 16, '0'),
   'guest' || gs || '@test.com',
   '$2b$12$' || substr(md5(random()::text), 0, 28),
   'GuestFn' || gs,
   'GuestLn' || gs,
   'Guest #'|| gs,
   'guest',
   NOW()::text,
   NOW()::text
FROM generate_series(1, 500) AS gs;

-- 04.2  HOST EXTENSION ROWS
INSERT INTO hosts (user_id, payout_schedule, onboarding_complete, company_name)
SELECT id, 'weekly', true, 'Host Co ' || substr(id, -4)
FROM users WHERE role='host';

-- 04.3  150 VILLAS
INSERT INTO villas
(id, host_user_id, slug, title, description, location_data, bedrooms_total, bathrooms_total,
 max_guests, base_price_usd_per_night, cleaning_fee_usd, service_fee_ratio, damage_waiver_ratio,
 policies, published, status, tags_array, created_at, updated_at)
SELECT
 'villa_' || LPAD(gs::text, 12, '0'),
 (SELECT id FROM users WHERE role='host' ORDER BY random() LIMIT 1),
 'villa-slug-' || gs,
 'Luxury Villa #'|| gs,
 E'Markdown description **Villa #' || gs || '** sets right by the Med sea.',
 json_build_object(
     'lat', 43.7 + random()*0.3,
     'lng', 7.1  + random()*0.4,
     'city', 'Nice',
     'address', 'Rue Bonaparte '|| (100+gs),
     'postal_code', '06000',
     'country', 'FR'
 ),
 3 + (random()*3)::int,
 2 + (random()*2)::int,
 8 + (random()*6)::int,
 150 + (random()*250)::int,
 50,
 0.10,
 0.035,
 '{"cancellation_tier":"flex","security_deposit_usd":500,"house_rules":["No parties"],"checkin_time":"15:00","checkout_time":"11:00"}',
 true,
 'live',
 '["pool","sea_view","gym","cinema","chef_kitchen","concierge"]',
 NOW()::text,
 NOW()::text
FROM generate_series(1,150) AS gs;

-- 04.4  ROOM TYPES per villa (bedrooms bath living pool)
WITH villa_cte AS (SELECT id FROM villas)
INSERT INTO room_types (id, villa_id, type, name, beds_json)
SELECT
  'rt_' || villa.id || '_' || row_number() OVER (PARTITION BY villa.id),
  villa.id,
  'bedroom' as type,
  'Bedroom #' || row_number() OVER (PARTITION BY villa.id),
  '[{"type":"king","count":1}]'
FROM villa_cte vida
JOIN generate_series(1, 3) ON true;

-- bathrooms
INSERT INTO room_types (id, villa_id, type, name)
SELECT
  'rt_' || villa.id || '_bath_' || gs,
  villa.id,
  'bathroom',
  'Bathroom #'||gs
FROM (SELECT id FROM villas) villa
JOIN generate_series(1,2) gs ON true;

-- living area
INSERT INTO room_types (id, villa_id, type, name)
SELECT
  'rt_' || villa.id || '_living',
  villa.id,
  'living_area',
  'Living Room'
FROM (SELECT id FROM villas) villa;

-- pool
INSERT INTO room_types (id, villa_id, type, name)
SELECT
  'rt_' || villa.id || '_pool',
  villa.id,
  'pool',
  'Private Pool'
FROM (SELECT id FROM villas) villa;

-- 04.5  AMENITIES
INSERT INTO amenities (id, villa_id, amenity_key, value)
SELECT 'am_' || villa.id || '_' || key,
       villa.id,
       key,
       true
FROM (SELECT id FROM villas) villa
JOIN (
  SELECT unnest(ARRAY['pool','chef_kitchen','cinema','gym','sea_view','concierge']) AS key
) k ON true;

-- 04.6  600 CONFIRMED BOOKINGS spanning next 300 days
INSERT INTO bookings
(id, guest_user_id, villa_id, check_in, check_out, adults, children, infants,
 total_base_usd, total_fees_usd, total_taxes_usd, total_usd, balance_usd,
 status, contract_signed_at, created_at, updated_at)
SELECT
 'booking_' || LPAD(gs::text,10,'0'),
 (SELECT id FROM users WHERE role='guest' ORDER BY random() LIMIT 1),
 (SELECT id FROM villas ORDER BY random() LIMIT 1),
 (CURRENT_DATE + (random()*150)::int)::text,
 (CURRENT_DATE + (random()*150 + 4)::int)::text,
 2 + (random()*6)::int,
 0 + (random()*3)::int,
 0,
 (5 + (random()*10)::int)*100,
 50 + (random()*50)::int * 2,
 (random()*50)::int,
 (5 + (random()*12)::int)*100,
 0,
 'confirmed',
 CURRENT_TIMESTAMP::text,
 NOW()::text,
 NOW()::text
FROM generate_series(1,600) gs;

-- 04.7  booking_addons
INSERT INTO booking_addons
SELECT b.id,
       (array['private_chef_daily','yacht_half_day','airport_transfer'])[ceil(random()*3)],
       ceil(random()*2),
       300.00,
       300 * ceil(random()*2)
FROM bookings b TABLESAMPLE BERNOULLI (0.3);

-- 04.8  CALENDAR EVENTS for every live booking
INSERT INTO calendar_events
(id, villa_id, event_type, start_date, end_date, booking_id, created_at)
SELECT
 'ce_' || b.id,
 b.villa_id,
 'booking',
 b.check_in,
 b.check_out,
 b.id,
 NOW()::text
FROM bookings b;

-- 04.9  Pricing rules – 30% of villas get a summer rule
INSERT INTO pricing_rules
(id, villa_id, rule_type, start_date, end_date, adjustment_percent, priority, created_at)
SELECT
 'pr_' || villa.id,
 villa.id,
 'season',
 '2024-06-01',
 '2024-09-01',
 20.00,
 10,
 NOW()::text
FROM (SELECT id FROM villas TABLESAMPLE BERNOULLI(0.3)) villa;

-- 04.10  GUEST REVIEWS  (only completed bookings 60 days ago)
INSERT INTO guest_reviews
(id, booking_id, guest_user_id, villa_id, ratings, content, created_at)
SELECT
 'rev_' || b.id,
 b.id,
 b.guest_user_id,
 b.villa_id,
 '{"accuracy":5,"cleanliness":5,"communication":5,"location":5,"value":5}'::json,
 'Amazing villa! Highly recommend.',
 NOW()::text
FROM bookings b
WHERE b.check_out < current_date - 60
ORDER BY random()
LIMIT 400;

-- 04.11  DAMAGE REPORTS (5% of completed bookings)
INSERT INTO damage_reports
(id, booking_id, reporter_user_id, damage_description, estimated_cost_usd, status, photos, created_at)
SELECT
 'dmg_' || b.id,
 b.id,
 (SELECT host_user_id FROM villas WHERE id=b.villa_id),
 'Minor scratch on marble table',
 (random()*500 + 100),
 'open',
 '["https://picsum.photos/seed/dmg/600/400"]',
 NOW()::text
FROM bookings b
WHERE b.check_out < current_date
ORDER BY random()
LIMIT 30;

-- 04.12  WISHLISTS & ITEMS
INSERT INTO wishlists
SELECT
 'wl_' || u.id,
 u.id,
 'My Dream Villas',
 NOW()::text
FROM (SELECT id FROM users WHERE role='guest' ORDER BY random() LIMIT 250) u;

INSERT INTO wishlist_items
SELECT l.id,
       (SELECT id FROM villas ORDER BY random() LIMIT 1),
       NOW()::text
FROM wishlists l,
     generate_series(1, (random()*5+1)::int) gs;

-- 04.13  SAVED SEARCHES
INSERT INTO saved_searches
(id, guest_user_id, name, criteria_json, created_at)
SELECT
 'ss_' || u.id,
 u.id,
 'Favorites',
 '{"location":"Côte d’Azur","guests":8}',
 NOW()::text
FROM (SELECT id FROM users WHERE role='guest' ORDER BY random() LIMIT 100) u;

-- 04.14  GUIDEBOOKS
INSERT INTO guidebooks
(id, villa_id, title, content_md, pdf_url, created_at)
SELECT
 'gb_' || v.id,
 v.id,
 'Welcome Guide ' || v.title,
 E'# Welcome to our villa\n\n- Check-in time 15:00\n- Checkout 11:00',
 'https://picsum.photos/seed/guide/800/600',
 NOW()::text
FROM (SELECT id FROM villas ORDER BY random() LIMIT 50) v;

-- 04.15  ADMIN CMS PAGES
INSERT INTO cms_pages
(id, slug, title, body_md, published, updated_at)
VALUES
('pg_tos','terms','Terms of Service','**Our simple terms**...',true,NOW()::text),
('pg_privacy','privacy','Privacy Policy','**We ❤️ your privacy.**',true,NOW()::text);

-- =========================================================
-- END OF SEED
-- =========================================================