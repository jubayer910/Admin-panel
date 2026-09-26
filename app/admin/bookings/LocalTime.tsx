"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * A booking time in the admin's own time zone. The server does not know that
 * zone, so it renders a plain UTC date and the browser swaps in local time.
 */
export function LocalTime({ start, end }: { start: number; end?: number | null }) {
  const local = useSyncExternalStore(subscribe, () => true, () => false);
  const d = new Date(start);
  if (!local) return <time dateTime={d.toISOString()}>{d.toISOString().slice(0, 16).replace("T", " ")} UTC</time>;

  const dayOf = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
  const t = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const e = end ? new Date(end) : null;
  // one day: "7:30 – 8:00 AM"; a call past midnight keeps both times short
  // too, where formatRange would spell out both dates
  const times = !e ? t.format(d) : d.toDateString() === e.toDateString() ? t.formatRange(d, e) : `${t.format(d)} – ${t.format(e)}`;
  return (
    <time dateTime={d.toISOString()}>
      {dayOf.format(d)}, {times}
    </time>
  );
}
