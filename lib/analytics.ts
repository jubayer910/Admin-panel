import { all, one } from "./db";

/* Read side of the first-party analytics. On the real site a collector
   records every page view and click; the demo's are made up
   (lib/demo/seed.ts) and the same queries run over them. */

/** Days and hours are Dhaka time. Bangladesh has no daylight saving. */
export const TZ_OFFSET_MS = 6 * 60 * 60 * 1000;
export const TZ_LABEL = "Dhaka time (UTC+6)";

export type RangeKey = "today" | "7d" | "30d" | "90d" | "12m";
export type Bucket = "hour" | "day" | "month";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "12m", label: "Last 12 months" },
];

export type Range = {
  key: RangeKey;
  label: string;
  from: number;
  to: number;
  /** the same stretch one period back: yesterday up to this time, the 7
      days before these 7, the same months a year earlier */
  prevFrom: number;
  prevTo: number;
  bucket: Bucket;
  /** every bucket in the range, so empty days still get a point */
  buckets: string[];
};

const DAY = 86_400_000;

/** Local midnight, as a UTC timestamp. */
function localMidnight(ts: number): number {
  return Math.floor((ts + TZ_OFFSET_MS) / DAY) * DAY - TZ_OFFSET_MS;
}

function localKey(ts: number, bucket: Bucket): string {
  const iso = new Date(ts + TZ_OFFSET_MS).toISOString();
  if (bucket === "hour") return `${iso.slice(0, 10)} ${iso.slice(11, 13)}`;
  if (bucket === "month") return iso.slice(0, 7);
  return iso.slice(0, 10);
}

export function resolveRange(raw: string | undefined, now = Date.now()): Range {
  const key = (RANGES.find((r) => r.key === raw)?.key ?? "7d") as RangeKey;
  const label = RANGES.find((r) => r.key === key)!.label;
  const today = localMidnight(now);

  let from: number;
  let bucket: Bucket = "day";
  /** how far back the comparison window sits */
  let shift: (t: number) => number;
  if (key === "today") {
    from = today;
    bucket = "hour";
    shift = (t) => t - DAY;
  } else if (key === "12m") {
    const d = new Date(today + TZ_OFFSET_MS);
    from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1) - TZ_OFFSET_MS;
    bucket = "month";
    shift = (t) => {
      const x = new Date(t);
      x.setUTCFullYear(x.getUTCFullYear() - 1);
      return x.getTime();
    };
  } else {
    const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
    from = today - (days - 1) * DAY;
    shift = (t) => t - days * DAY;
  }
  const to = now;

  const buckets: string[] = [];
  if (bucket === "hour") {
    for (let t = from; t <= to; t += 3_600_000) buckets.push(localKey(t, "hour"));
  } else if (bucket === "day") {
    for (let t = from; t <= to; t += DAY) buckets.push(localKey(t, "day"));
  } else {
    const d = new Date(from + TZ_OFFSET_MS);
    for (let i = 0; i < 12; i++) {
      buckets.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
    }
  }

  return { key, label, from, to, prevFrom: shift(from), prevTo: shift(to), bucket, buckets };
}

const FORMAT: Record<Bucket, string> = { hour: "%Y-%m-%d %H", day: "%Y-%m-%d", month: "%Y-%m" };

/* ------------------------------------------------------------------ types */

export type Kpis = {
  visitors: number;
  views: number;
  sessions: number;
  bounced: number;
  avgMs: number;
  clicks: number;
  converted: number;
};

export type Row = { k: string | null; [col: string]: string | number | null };

export type Report = {
  range: Range;
  /** the owner's own visits are included */
  own: boolean;
  totalEver: number;
  /** the owner's own page views in this window, whether shown or not */
  ownInRange: number;
  kpis: Kpis;
  prev: Kpis;
  trend: { b: string; visitors: number; views: number; sessions: number }[];
  clickTrend: { b: string; clicks: number }[];
  pages: Row[];
  entries: Row[];
  exits: Row[];
  sources: Row[];
  campaigns: Row[];
  countries: Row[];
  cities: Row[];
  devices: Row[];
  browsers: Row[];
  os: Row[];
  languages: Row[];
  screens: Row[];
  heat: { d: number; h: number; views: number }[];
  scroll: { total: number; s25: number; s50: number; s75: number; s90: number };
  dwell: { a: number; b: number; c: number; d: number; e: number; f: number };
  ctaButtons: Row[];
  ctaPlans: Row[];
  ctaTargets: Row[];
  recent: Row[];
  funnel: { sessions: number; sawPricing: number; clickedPricing: number; clickedAny: number };
  live: { visitors: number; pages: Row[] };
};

/* ---------------------------------------------------------------- queries */

/**
 * Every query reads through these two CTEs, so the time window and the
 * "leave out my own visits" switch are applied in exactly one place.
 * `?1`/`?2` are the window; `own` is a fixed SQL fragment, never user input.
 */
function tables(own: boolean) {
  const f = own ? "" : " AND internal = 0";
  return {
    V: `v AS (SELECT * FROM analytics_views WHERE ts >= ?1 AND ts < ?2${f})`,
    E: `ev AS (SELECT * FROM analytics_events WHERE ts >= ?1 AND ts < ?2${f})`,
  };
}

const C = `c AS (SELECT DISTINCT session FROM ev WHERE name = 'cta_click')`;
const ENTRY = `entry AS (
  SELECT * FROM (SELECT v.*, row_number() OVER (PARTITION BY session ORDER BY ts) AS rn FROM v) WHERE rn = 1
)`;

function kpiSql(V: string, E: string) {
  return `WITH ${V}, ${E}, ${C},
  s AS (SELECT session, count(*) AS views, sum(duration_ms) AS dur FROM v GROUP BY session)
SELECT
  (SELECT count(DISTINCT visitor) FROM v) AS visitors,
  (SELECT count(*) FROM v) AS views,
  (SELECT count(*) FROM s) AS sessions,
  (SELECT count(*) FROM s WHERE views = 1 AND dur < 10000 AND session NOT IN (SELECT session FROM c)) AS bounced,
  (SELECT coalesce(avg(dur), 0) FROM s) AS avgMs,
  (SELECT count(*) FROM ev WHERE name = 'cta_click') AS clicks,
  (SELECT count(*) FROM c) AS converted`;
}

export function loadReport(range: Range, opts: { own?: boolean } = {}): Report {
  const now = Date.now();
  const cur = [range.from, range.to];
  const q = (sql: string, ...params: unknown[]) => ({ sql, params });
  const { V, E } = tables(!!opts.own);
  const KPIS = kpiSql(V, E);

  /** visitors + views per value of one column. `col` is never user input. */
  const by = (col: string, limit = 10) => `WITH ${V}
SELECT ${col} AS k, count(DISTINCT visitor) AS visitors, count(*) AS views
FROM v GROUP BY k ORDER BY visitors DESC, views DESC LIMIT ${limit}`;

  const statements = [
    q(`SELECT count(*) AS n FROM analytics_views`),
    // the owner's own visits in this window, so the page can say they exist
    q(`SELECT count(*) AS n FROM analytics_views WHERE ts >= ?1 AND ts < ?2 AND internal = 1`, ...cur),
    q(KPIS, ...cur),
    q(KPIS, range.prevFrom, range.prevTo),
    q(
      `WITH ${V} SELECT strftime(?3, (ts + ?4) / 1000, 'unixepoch') AS b,
              count(DISTINCT visitor) AS visitors, count(*) AS views, count(DISTINCT session) AS sessions
         FROM v GROUP BY b ORDER BY b`,
      ...cur, FORMAT[range.bucket], TZ_OFFSET_MS,
    ),
    q(
      `WITH ${E} SELECT strftime(?3, (ts + ?4) / 1000, 'unixepoch') AS b, count(*) AS clicks
         FROM ev WHERE name = 'cta_click' GROUP BY b ORDER BY b`,
      ...cur, FORMAT[range.bucket], TZ_OFFSET_MS,
    ),
    // pages
    q(
      `WITH ${V} SELECT path AS k, count(*) AS views, count(DISTINCT visitor) AS visitors,
              avg(duration_ms) AS avgMs, avg(scroll_pct) AS scroll
         FROM v GROUP BY path ORDER BY views DESC LIMIT 12`,
      ...cur,
    ),
    q(
      `WITH ${V}, ${ENTRY} SELECT path AS k, count(*) AS sessions FROM entry GROUP BY path ORDER BY sessions DESC LIMIT 8`,
      ...cur,
    ),
    q(
      `WITH ${V}, x AS (
         SELECT * FROM (SELECT v.*, row_number() OVER (PARTITION BY session ORDER BY ts DESC) AS rn FROM v) WHERE rn = 1
       ) SELECT path AS k, count(*) AS sessions FROM x GROUP BY path ORDER BY sessions DESC LIMIT 8`,
      ...cur,
    ),
    // where people came from - attributed by the page a session started on
    q(
      `WITH ${V}, ${E}, ${C}, ${ENTRY}
       SELECT coalesce(utm_source, referrer) AS k, utm_source IS NOT NULL AS tagged,
              count(*) AS sessions, count(DISTINCT visitor) AS visitors,
              sum(session IN (SELECT session FROM c)) AS converted
         FROM entry GROUP BY k, tagged ORDER BY sessions DESC LIMIT 12`,
      ...cur,
    ),
    q(
      `WITH ${V}, ${E}, ${C}, ${ENTRY}
       SELECT utm_source AS k, utm_medium AS medium, utm_campaign AS campaign,
              count(*) AS sessions, sum(session IN (SELECT session FROM c)) AS converted
         FROM entry WHERE utm_source IS NOT NULL
        GROUP BY utm_source, utm_medium, utm_campaign ORDER BY sessions DESC LIMIT 12`,
      ...cur,
    ),
    // audience
    q(by("country", 12), ...cur),
    q(
      `WITH ${V} SELECT city AS k, country, count(DISTINCT visitor) AS visitors, count(*) AS views
         FROM v WHERE city IS NOT NULL GROUP BY city, country ORDER BY visitors DESC LIMIT 12`,
      ...cur,
    ),
    q(by("device", 5), ...cur),
    q(by("browser", 10), ...cur),
    q(by("os", 8), ...cur),
    q(by("lower(substr(lang, 1, instr(lang || '-', '-') - 1))", 10), ...cur),
    q(
      by(
        `CASE WHEN screen_w IS NULL THEN NULL
              WHEN screen_w < 480 THEN 'Phone (under 480)'
              WHEN screen_w < 768 THEN 'Large phone (480–767)'
              WHEN screen_w < 1024 THEN 'Tablet (768–1023)'
              WHEN screen_w < 1440 THEN 'Laptop (1024–1439)'
              WHEN screen_w < 1920 THEN 'Desktop (1440–1919)'
              ELSE 'Large desktop (1920+)' END`,
        6,
      ),
      ...cur,
    ),
    // when
    q(
      `WITH ${V} SELECT cast(strftime('%w', (ts + ?3) / 1000, 'unixepoch') AS integer) AS d,
              cast(strftime('%H', (ts + ?3) / 1000, 'unixepoch') AS integer) AS h, count(*) AS views
         FROM v GROUP BY d, h`,
      ...cur, TZ_OFFSET_MS,
    ),
    // engagement
    q(
      `WITH ${V} SELECT count(*) AS total, coalesce(sum(scroll_pct >= 25), 0) AS s25, coalesce(sum(scroll_pct >= 50), 0) AS s50,
              coalesce(sum(scroll_pct >= 75), 0) AS s75, coalesce(sum(scroll_pct >= 90), 0) AS s90
         FROM v`,
      ...cur,
    ),
    q(
      `WITH ${V} SELECT coalesce(sum(duration_ms < 10000), 0) AS a,
              coalesce(sum(duration_ms >= 10000 AND duration_ms < 30000), 0) AS b,
              coalesce(sum(duration_ms >= 30000 AND duration_ms < 60000), 0) AS c,
              coalesce(sum(duration_ms >= 60000 AND duration_ms < 180000), 0) AS d,
              coalesce(sum(duration_ms >= 180000 AND duration_ms < 600000), 0) AS e,
              coalesce(sum(duration_ms >= 600000), 0) AS f
         FROM v`,
      ...cur,
    ),
    // calls to action
    q(
      `WITH ${E} SELECT location AS k, label, plan, target, count(*) AS clicks, count(DISTINCT visitor) AS people
         FROM ev WHERE name = 'cta_click'
        GROUP BY location, label, plan, target ORDER BY clicks DESC LIMIT 20`,
      ...cur,
    ),
    q(
      `WITH ${E} SELECT plan AS k, count(*) AS clicks, count(DISTINCT visitor) AS people
         FROM ev WHERE name = 'cta_click' AND location = 'pricing'
        GROUP BY plan ORDER BY clicks DESC`,
      ...cur,
    ),
    q(
      `WITH ${E} SELECT target AS k, count(*) AS clicks, count(DISTINCT visitor) AS people
         FROM ev WHERE name = 'cta_click'
        GROUP BY target ORDER BY clicks DESC`,
      ...cur,
    ),
    q(
      `WITH ${E} SELECT e.ts AS k, e.location, e.label, e.plan, e.target, v.country, v.city, v.device, v.browser,
              (SELECT coalesce(x.utm_source, x.referrer) FROM analytics_views x
                WHERE x.session = e.session ORDER BY x.ts LIMIT 1) AS source
         FROM ev e LEFT JOIN analytics_views v ON v.id = e.view_id
        WHERE e.name = 'cta_click'
        ORDER BY e.ts DESC LIMIT 25`,
      ...cur,
    ),
    q(
      `WITH ${V}, ${E} SELECT
         (SELECT count(DISTINCT session) FROM v) AS sessions,
         (SELECT count(DISTINCT session) FROM ev WHERE name = 'section_view' AND location = 'pricing') AS sawPricing,
         (SELECT count(DISTINCT session) FROM ev WHERE name = 'cta_click' AND location = 'pricing') AS clickedPricing,
         (SELECT count(DISTINCT session) FROM ev WHERE name = 'cta_click') AS clickedAny`,
      ...cur,
    ),
    // right now: a view in the last five minutes, or one still being read
    q(
      `SELECT count(DISTINCT visitor) AS n FROM analytics_views
        WHERE ts >= ?2 AND (ts >= ?1 OR ts + duration_ms >= ?1)${opts.own ? "" : " AND internal = 0"}`,
      now - 5 * 60_000, now - 60 * 60_000,
    ),
    q(
      `SELECT path AS k, count(DISTINCT visitor) AS visitors FROM analytics_views
        WHERE ts >= ?2 AND (ts >= ?1 OR ts + duration_ms >= ?1)${opts.own ? "" : " AND internal = 0"}
        GROUP BY path ORDER BY visitors DESC LIMIT 5`,
      now - 5 * 60_000, now - 60 * 60_000,
    ),
  ];

  const res = statements.map((st) => all<Record<string, unknown>>(st.sql, ...st.params));
  const rows = <T>(i: number) => (res[i] ?? []) as T[];
  const first = <T>(i: number) => rows<T>(i)[0];

  let i = 0;
  const next = () => i++;
  return {
    range,
    own: !!opts.own,
    totalEver: first<{ n: number }>(next())?.n ?? 0,
    ownInRange: first<{ n: number }>(next())?.n ?? 0,
    kpis: first<Kpis>(next()),
    prev: first<Kpis>(next()),
    trend: rows(next()),
    clickTrend: rows(next()),
    pages: rows(next()),
    entries: rows(next()),
    exits: rows(next()),
    sources: rows(next()),
    campaigns: rows(next()),
    countries: rows(next()),
    cities: rows(next()),
    devices: rows(next()),
    browsers: rows(next()),
    os: rows(next()),
    languages: rows(next()),
    screens: rows(next()),
    heat: rows(next()),
    scroll: first(next()),
    dwell: first(next()),
    ctaButtons: rows(next()),
    ctaPlans: rows(next()),
    ctaTargets: rows(next()),
    recent: rows(next()),
    funnel: first(next()),
    live: { visitors: first<{ n: number }>(next())?.n ?? 0, pages: rows(next()) },
  };
}

/** For the Overview page: the last seven days in two numbers. */
export function weekSnapshot(): { visitors: number; clicks: number } {
  const r = resolveRange("7d");
  const row = one<{ visitors: number; clicks: number }>(
    `SELECT (SELECT count(DISTINCT visitor) FROM analytics_views WHERE ts >= ?1 AND ts < ?2 AND internal = 0) AS visitors,
            (SELECT count(*) FROM analytics_events
              WHERE name = 'cta_click' AND ts >= ?1 AND ts < ?2 AND internal = 0) AS clicks`,
    r.from,
    r.to,
  );
  return row ?? { visitors: 0, clicks: 0 };
}
