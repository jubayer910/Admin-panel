import { all, one } from "./db";

/* The numbers on /admin (the overview): this week against last, the calls
   coming up, and how much is in each part of the site. */

const DAY = 86_400_000;

export type Overview = {
  visitors: number;
  visitorsPrev: number;
  clicks: number;
  clicksPrev: number;
  booked: number;
  upcoming: { id: string; name: string | null; email: string | null; start_time: number; end_time: number | null; meet_url: string | null; plan: string | null }[];
  upcomingCount: number;
  counts: Record<string, number>;
  onHomepage: number;
};

const COUNTED = ["works", "categories", "plans", "testimonials", "faqs", "clients", "photos", "experience", "media", "bookings"] as const;

export function overview(): Overview {
  const now = Date.now();
  const week = now - 7 * DAY;
  const fortnight = now - 14 * DAY;

  const [traffic, upcoming, counts, home] = [
    one<{ v: number; vp: number; c: number; cp: number; b: number; u: number }>(
      `SELECT
         (SELECT count(DISTINCT visitor) FROM analytics_views WHERE internal = 0 AND ts >= ?1) AS v,
         (SELECT count(DISTINCT visitor) FROM analytics_views WHERE internal = 0 AND ts >= ?2 AND ts < ?1) AS vp,
         (SELECT count(*) FROM analytics_events WHERE internal = 0 AND name = 'cta_click' AND ts >= ?1) AS c,
         (SELECT count(*) FROM analytics_events WHERE internal = 0 AND name = 'cta_click' AND ts >= ?2 AND ts < ?1) AS cp,
         (SELECT count(*) FROM bookings WHERE created_at >= ?1) AS b,
         (SELECT count(*) FROM bookings WHERE status = 'booked' AND start_time >= ?3) AS u`,
      week,
      fortnight,
      now,
    ),
    all<Overview["upcoming"][number]>(
      `SELECT id, name, email, start_time, end_time, meet_url, plan FROM bookings
        WHERE status = 'booked' AND start_time >= ? ORDER BY start_time LIMIT 5`,
      now,
    ),
    COUNTED.map((t) => [t, one<{ n: number }>(`SELECT count(*) AS n FROM ${t}`)?.n ?? 0] as const),
    one<{ n: number }>("SELECT count(*) AS n FROM works WHERE show_on_homepage = 1"),
  ] as const;

  return {
    visitors: traffic?.v ?? 0,
    visitorsPrev: traffic?.vp ?? 0,
    clicks: traffic?.c ?? 0,
    clicksPrev: traffic?.cp ?? 0,
    booked: traffic?.b ?? 0,
    upcoming,
    upcomingCount: traffic?.u ?? 0,
    counts: Object.fromEntries(counts),
    onHomepage: home?.n ?? 0,
  };
}
