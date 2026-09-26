import { all, one } from "./db";

/* Bookings. On the real site the booking window saves them and Cal.com's
   webhook keeps them current; the demo's are made up (lib/demo/seed.ts). */

const SECRET_KEY = "cal.webhookSecret";
const LAST_EVENT_KEY = "cal.lastEvent";

/** The secret Cal.com signs its webhooks with (a made-up one in the demo). */
export function webhookSecret(): string {
  return one<{ value: string }>("SELECT value FROM secrets WHERE key = ?", SECRET_KEY)?.value ?? "";
}

export function lastWebhookEvent(): { trigger: string; at: number } | null {
  const row = one<{ value: string; updated_at: number }>(
    "SELECT value, updated_at FROM secrets WHERE key = ?",
    LAST_EVENT_KEY,
  );
  return row ? { trigger: row.value, at: row.updated_at } : null;
}

/* ------------------------------------------------------------- admin */

export type BookingRow = {
  id: string;
  created_at: number;
  status: "booked" | "cancelled";
  name: string | null;
  email: string | null;
  needs: string | null;
  plan: string | null;
  note: string | null;
  source: string;
  start_time: number | null;
  end_time: number | null;
  timezone: string | null;
  meet_url: string | null;
  rescheduled: number;
  cancel_reason: string | null;
  /** utm_source or referrer of the visit's first page, "a direct visit" without either */
  came_from: string | null;
};

const DAY = 86_400_000;

/**
 * Every booking for /admin/bookings (the table filters, sorts and pages them
 * in the browser), and the funnel over the last 30 days.
 */
export function bookingsReport() {
  const since = Date.now() - 30 * DAY;

  const [rows, kpi] = [
    all<BookingRow>(
      `SELECT b.id, b.created_at, b.status, b.name, b.email, b.needs, b.plan, b.note, b.source,
              b.start_time, b.end_time, b.timezone, b.meet_url, b.rescheduled, b.cancel_reason,
              (SELECT coalesce(x.utm_source, x.referrer, 'a direct visit') FROM analytics_views x
                WHERE x.session = b.session ORDER BY x.ts LIMIT 1) AS came_from
         FROM bookings b
        ORDER BY b.created_at DESC
        LIMIT 2000`,
    ),
    // the funnel, in visits: opened the booking window → picked a time → booked
    one<{ opened: number; picked: number; booked: number }>(
      `SELECT
         (SELECT count(DISTINCT session) FROM analytics_events
           WHERE name = 'booking_open' AND internal = 0 AND ts >= ?) AS opened,
         (SELECT count(DISTINCT session) FROM analytics_events
           WHERE name = 'booking_time' AND internal = 0 AND ts >= ?) AS picked,
         (SELECT count(*) FROM bookings WHERE created_at >= ?) AS booked`,
      since,
      since,
      since,
    ),
  ] as const;
  return { rows, kpi, now: Date.now() };
}

