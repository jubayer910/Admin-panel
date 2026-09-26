/* The database's shape: every table and index of the live site's D1
   database, exported as it stands after all its migrations. The demo runs
   it in the browser with sql.js (SQLite compiled to WebAssembly). */

export const SCHEMA = `
CREATE TABLE about_stats (
  id       TEXT PRIMARY KEY,
  value    TEXT NOT NULL,             -- "3+", "5.0"
  label    TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE analytics_events (
  id        TEXT PRIMARY KEY,
  ts        INTEGER NOT NULL,
  visitor   TEXT NOT NULL,
  session   TEXT NOT NULL,
  view_id   TEXT,
  name      TEXT NOT NULL,               -- 'cta_click'
  path      TEXT NOT NULL,
  location  TEXT,                        -- sidebar | pricing | work
  label     TEXT,                        -- the button text
  plan      TEXT,                        -- pricing card name
  target    TEXT,                        -- whatsapp | telegram | meeting | email | phone | link
  href      TEXT
, internal INTEGER NOT NULL DEFAULT 0);

CREATE TABLE analytics_views (
  id           TEXT PRIMARY KEY,         -- generated in the browser
  ts           INTEGER NOT NULL,         -- unix ms, UTC
  visitor      TEXT NOT NULL,
  session      TEXT NOT NULL,
  path         TEXT NOT NULL,
  referrer     TEXT,                     -- host only, self-referrals dropped
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_term     TEXT,
  utm_content  TEXT,
  country      TEXT,                     -- ISO 3166-1 alpha-2, from Cloudflare
  region       TEXT,
  city         TEXT,
  device       TEXT,                     -- desktop | mobile | tablet
  browser      TEXT,
  os           TEXT,
  screen_w     INTEGER,
  lang         TEXT,
  duration_ms  INTEGER NOT NULL DEFAULT 0,  -- time the tab was actually visible
  scroll_pct   INTEGER NOT NULL DEFAULT 0   -- deepest point reached
, internal INTEGER NOT NULL DEFAULT 0);

CREATE TABLE awards (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,             -- the gallery, e.g. "UI/UX"
  count    TEXT NOT NULL DEFAULT '',  -- "Featured 7x"
  badge    TEXT,                      -- media key of the ribbon image
  href     TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bookings (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,               -- unix ms
  updated_at    INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'booked', -- booked | cancelled
  name          TEXT,
  email         TEXT,
  needs         TEXT,                           -- the chosen options, ", "-joined
  plan          TEXT,
  note          TEXT,
  session       TEXT,                           -- analytics session, for "came from"
  ip_hash       TEXT,                           -- daily hash, only to limit repeat bookings
  source        TEXT NOT NULL DEFAULT 'site',   -- site | cal.com
  cal_uid       TEXT,
  start_time    INTEGER,                        -- unix ms
  end_time      INTEGER,
  timezone      TEXT,
  meet_url      TEXT,
  rescheduled   INTEGER NOT NULL DEFAULT 0,
  cancel_reason TEXT
);

CREATE TABLE categories (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  icon          TEXT,                -- still image
  icon_animated TEXT,                -- GIF, hover
  icon_active   TEXT,                -- GIF, active tab
  position      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE clients (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  logo      TEXT,                    -- media key or absolute URL
  width     REAL,                    -- render width in px, from the design
  height    REAL,
  row_index INTEGER NOT NULL DEFAULT 0,  -- which of the two logo rows
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE experience (
  id       TEXT PRIMARY KEY,
  role     TEXT NOT NULL,
  company  TEXT NOT NULL DEFAULT '',
  period   TEXT NOT NULL DEFAULT '',  -- free text: "Jan 2024 - Present"
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE faqs (
  id       TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer   TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE media (
  id         TEXT PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,   -- object key in the R2 bucket
  filename   TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  width      INTEGER,
  height     INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
, original_size INTEGER, fallback_key TEXT, optimized INTEGER NOT NULL DEFAULT 0);

CREATE TABLE photos (
  id       TEXT PRIMARY KEY,
  src      TEXT NOT NULL,
  alt      TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE plan_features (
  id       TEXT PRIMARY KEY,
  plan_id  TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE plans (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  blurb          TEXT NOT NULL DEFAULT '',
  badge          TEXT,
  monthly_price  INTEGER,            -- null for the enquiry-only plan
  trial_label    TEXT,
  trial_price    INTEGER,
  trial_discount INTEGER NOT NULL DEFAULT 50,
  cta_label      TEXT NOT NULL DEFAULT 'Intro Call',
  cta_href       TEXT,
  position       INTEGER NOT NULL DEFAULT 0
, cta_icon TEXT NOT NULL DEFAULT 'googleMeet', icon TEXT);

CREATE TABLE secrets (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE testimonials (
  id       TEXT PRIMARY KEY,
  quote    TEXT NOT NULL,
  name     TEXT NOT NULL,
  role     TEXT NOT NULL DEFAULT '',
  avatar   TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE works (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  category_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  cover            TEXT,             -- image shown in the grid
  preview_video    TEXT,             -- plays instead of the cover when set
  client           TEXT,
  year             TEXT,
  summary          TEXT,
  live_link        TEXT,
  show_on_homepage INTEGER NOT NULL DEFAULT 0,
  position         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ae_session ON analytics_events(session);

CREATE INDEX idx_ae_ts      ON analytics_events(ts);

CREATE INDEX idx_av_session ON analytics_views(session, ts);

CREATE INDEX idx_av_ts      ON analytics_views(ts);

CREATE UNIQUE INDEX idx_bookings_cal_uid ON bookings(cal_uid);

CREATE INDEX idx_bookings_created ON bookings(created_at);

CREATE INDEX idx_bookings_ip ON bookings(ip_hash, created_at);

CREATE INDEX idx_plan_features_plan ON plan_features(plan_id, position);

CREATE INDEX idx_works_category ON works(category_id, position);

CREATE INDEX idx_works_homepage ON works(show_on_homepage, position);
`;
