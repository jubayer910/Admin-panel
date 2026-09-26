"use client";

import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import ArrowUpDownIcon from "@hugeicons/core-free-icons/ArrowUpDownIcon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import Copy01Icon from "@hugeicons/core-free-icons/Copy01Icon";
import Download04Icon from "@hugeicons/core-free-icons/Download04Icon";
import LayoutTable01Icon from "@hugeicons/core-free-icons/LayoutTable01Icon";
import Mail01Icon from "@hugeicons/core-free-icons/Mail01Icon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import Video01Icon from "@hugeicons/core-free-icons/Video01Icon";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { BookingRow } from "@/lib/booking";
import { deleteBooking, deleteBookings } from "../actions";
import { DeleteButton } from "../FormButtons";
import { Icon } from "../Icon";
import { toast } from "../Modal";
import s from "../admin.module.css";
import t from "../table.module.css";

/*
 * /admin/bookings: every booking as a CRM table, in the site's line art.
 *
 *   tabs      All, Upcoming, Past, Cancelled, with how many each holds under
 *             the current search and filters
 *   search    name, email, note, plan, what they picked, where they came from
 *   filters   plan, interested in, where they came from, how they booked,
 *             the call's date and the day they booked
 *   sort      any column head with arrows; each tab has its natural order
 *   columns   hide the ones you do not need; kept per browser
 *   select    tick rows to export or delete them together
 *   open      a row opens everything about it in a panel on the right; ↑ ↓
 *             step through the list without closing it
 *
 * All the rows arrive at once (a few hundred at most), so all of this runs
 * here without a round trip.
 */

type Tab = "all" | "upcoming" | "past" | "cancelled";
type SortKey = "name" | "status" | "call" | "plan" | "from" | "booked";
type Sort = { key: SortKey; dir: "asc" | "desc" };
type Range = { preset: string; from?: string; to?: string };
type ColKey = "status" | "plan" | "needs" | "from" | "timezone" | "booked";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

/* each tab's natural order */
const TAB_SORT: Record<Tab, Sort> = {
  all: { key: "booked", dir: "desc" },
  upcoming: { key: "call", dir: "asc" },
  past: { key: "call", dir: "desc" },
  cancelled: { key: "booked", dir: "desc" },
};

const COLUMNS: { key: ColKey; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "plan", label: "Plan" },
  { key: "needs", label: "Interested in" },
  { key: "from", label: "Came from" },
  { key: "timezone", label: "Their time zone" },
  { key: "booked", label: "Booked" },
];

const DAY = 86_400_000;

const CALL_PRESETS: { key: string; label: string }[] = [
  { key: "any", label: "Any time" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "next7", label: "Next 7 days" },
  { key: "next30", label: "Next 30 days" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "custom", label: "Between dates" },
];

const BOOKED_PRESETS: { key: string; label: string }[] = [
  { key: "any", label: "Any time" },
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "last90", label: "Last 90 days" },
  { key: "custom", label: "Between dates" },
];

/* ------------------------------------------------------------ helpers */

const noop = () => () => {};
/** true once in the browser: times in the admin's own zone, relative dates */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

const HIDDEN_KEY = "mx_admin_bookings_hidden";
function subscribeHidden(cb: () => void) {
  addEventListener("storage", cb);
  addEventListener("mx-bookings-cols", cb);
  return () => {
    removeEventListener("storage", cb);
    removeEventListener("mx-bookings-cols", cb);
  };
}
function readHidden(): string {
  try {
    return localStorage.getItem(HIDDEN_KEY) ?? "timezone";
  } catch {
    return "timezone";
  }
}
function writeHidden(v: string) {
  try {
    localStorage.setItem(HIDDEN_KEY, v);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  dispatchEvent(new Event("mx-bookings-cols"));
}

type Stage = "upcoming" | "past" | "cancelled" | "unscheduled";

function stageOf(b: BookingRow, now: number): Stage {
  if (b.status === "cancelled") return "cancelled";
  if (!b.start_time) return "unscheduled";
  return b.start_time >= now ? "upcoming" : "past";
}

const STAGE_LABEL: Record<Stage, string> = {
  upcoming: "Upcoming",
  past: "Past",
  cancelled: "Cancelled",
  unscheduled: "No time yet",
};

/** where they came from, in words */
function originOf(b: BookingRow): string {
  if (b.came_from) return b.came_from === "a direct visit" ? "Direct visit" : b.came_from;
  return b.source === "cal.com" ? "Cal.com" : "Unknown";
}

const needsOf = (b: BookingRow) => (b.needs ? b.needs.split(", ").filter(Boolean) : []);
const NO_PLAN = "No plan";
const planOf = (b: BookingRow) => b.plan || NO_PLAN;
const sourceOf = (b: BookingRow) => (b.source === "cal.com" ? "Cal.com directly" : "Booking window");

function initials(b: BookingRow) {
  const from = (b.name || b.email || "?").trim();
  const parts = from.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (b.name ? (parts[1]?.[0] ?? "") : "")).toUpperCase();
}

/** midnight today, in the browser's zone */
function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** [from, to) for a preset, or null for any time */
function bounds(r: Range, now: number): [number, number] | null {
  const today = startOfDay(now);
  switch (r.preset) {
    case "today":
      return [today, today + DAY];
    case "tomorrow":
      return [today + DAY, today + 2 * DAY];
    case "next7":
      return [now, now + 7 * DAY];
    case "next30":
      return [now, now + 30 * DAY];
    case "last7":
      return [now - 7 * DAY, now];
    case "last30":
      return [now - 30 * DAY, now];
    case "last90":
      return [now - 90 * DAY, now];
    case "custom": {
      const a = r.from ? new Date(`${r.from}T00:00`).getTime() : -Infinity;
      const b = r.to ? new Date(`${r.to}T00:00`).getTime() + DAY : Infinity;
      return r.from || r.to ? [a, b] : null;
    }
    default:
      return null;
  }
}

function rangeLabel(r: Range, presets: { key: string; label: string }[]) {
  if (r.preset === "custom") {
    const f = (v?: string) => (v ? new Date(`${v}T00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "…");
    return `${f(r.from)} to ${f(r.to)}`;
  }
  return presets.find((p) => p.key === r.preset)?.label ?? "Any time";
}

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }) : null;
function relative(ms: number, now: number) {
  const diff = ms - now;
  const abs = Math.abs(diff);
  if (!rtf) return "";
  if (abs < 60 * 60_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 14 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  if (abs < 60 * DAY) return rtf.format(Math.round(diff / (7 * DAY)), "week");
  return rtf.format(Math.round(diff / (30 * DAY)), "month");
}

function dayTime(ms: number, end?: number | null) {
  const d = new Date(ms);
  const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const tf = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  if (!end) return { day, time: tf.format(d) };
  const e = new Date(end);
  return { day, time: d.toDateString() === e.toDateString() ? tf.formatRange(d, e) : `${tf.format(d)} – ${tf.format(e)}` };
}

/** the same moment, on their clock */
function theirTime(ms: number, tz: string | null) {
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

/* each word keeps one tag colour (used by the dark theme) */
// no red: that is the colour of a cancelled call
const HUES = ["green", "blue", "violet", "orange", "cyan", "yellow", "lime"] as const;
function hueOf(word: string) {
  let h = 0;
  for (const ch of word.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

const tzName = (tz: string | null) => (tz ? tz.replace(/_/g, " ").replace(/^.*\//, "") : "");

function csvCell(v: unknown) {
  const x = v == null ? "" : String(v);
  return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
}

function stamp(ms: number | null) {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function exportCsv(list: BookingRow[], now: number, name: string) {
  const head = [
    "Name", "Email", "Status", "Call start (your time)", "Call end (your time)", "Their time zone", "Plan",
    "Interested in", "Note", "Came from", "Booked through", "Rescheduled", "Cancel reason", "Booked on (your time)", "Meeting link", "ID",
  ];
  const lines = list.map((b) =>
    [
      b.name, b.email, STAGE_LABEL[stageOf(b, now)], stamp(b.start_time), stamp(b.end_time), b.timezone, b.plan,
      b.needs, b.note, originOf(b), sourceOf(b), b.rescheduled ? "yes" : "", b.cancel_reason, stamp(b.created_at), b.meet_url, b.id,
    ].map(csvCell).join(","),
  );
  // the BOM keeps names with accents intact when Excel opens it
  const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ------------------------------------------------------------ table */

export function BookingsTable({
  rows,
  now,
  initialTab,
  initialOpen,
}: {
  rows: BookingRow[];
  /** the server's clock, so the first render matches in the browser */
  now: number;
  initialTab: Tab;
  initialOpen: string | null;
}) {
  const mounted = useMounted();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState("");
  const [plans, setPlans] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [origins, setOrigins] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [call, setCall] = useState<Range>({ preset: "any" });
  const [booked, setBooked] = useState<Range>({ preset: "any" });
  const [sort, setSort] = useState<Sort | null>(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(initialOpen);
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const hiddenRaw = useSyncExternalStore(subscribeHidden, readHidden, () => "timezone");
  const hidden = useMemo(() => new Set(hiddenRaw.split(",").filter(Boolean) as ColKey[]), [hiddenRaw]);
  const show = (c: ColKey) => !hidden.has(c);

  /* the options every filter offers, from all the rows */
  const options = useMemo(() => {
    const uniq = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
    const planList = uniq(rows.map(planOf).filter((p) => p !== NO_PLAN));
    if (rows.some((b) => !b.plan)) planList.push(NO_PLAN);
    return {
      plans: planList,
      needs: uniq(rows.flatMap(needsOf)),
      origins: uniq(rows.map(originOf)),
      sources: uniq(rows.map(sourceOf)),
    };
  }, [rows]);

  /* search and filters, before the tab */
  const query = q.trim().toLowerCase();
  const callB = bounds(call, now);
  const bookedB = bounds(booked, now);
  const filtered = useMemo(
    () =>
      rows.filter((b) => {
        if (plans.length && !plans.includes(planOf(b))) return false;
        if (needs.length && !needsOf(b).some((n) => needs.includes(n))) return false;
        if (origins.length && !origins.includes(originOf(b))) return false;
        if (sources.length && !sources.includes(sourceOf(b))) return false;
        if (callB && !(b.start_time && b.start_time >= callB[0] && b.start_time < callB[1])) return false;
        if (bookedB && !(b.created_at >= bookedB[0] && b.created_at < bookedB[1])) return false;
        if (!query) return true;
        return [b.name, b.email, b.note, b.needs, b.plan, originOf(b), b.timezone, b.id]
          .some((v) => v && v.toLowerCase().includes(query));
      }),
    // the bounds are recomputed from primitives each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, plans, needs, origins, sources, query, callB?.[0], callB?.[1], bookedB?.[0], bookedB?.[1]],
  );

  const counts: Record<Tab, number> = { all: filtered.length, upcoming: 0, past: 0, cancelled: 0 };
  for (const b of filtered) {
    const st = stageOf(b, now);
    if (st === "upcoming" || st === "past" || st === "cancelled") counts[st]++;
  }

  const inTab = tab === "all" ? filtered : filtered.filter((b) => stageOf(b, now) === tab);
  const order = sort ?? TAB_SORT[tab];
  const sorted = [...inTab].sort((a, b) => {
    const dir = order.dir === "asc" ? 1 : -1;
    const key = (x: BookingRow): string | number => {
      switch (order.key) {
        case "name":
          return (x.name || x.email || "").toLowerCase();
        case "status":
          return STAGE_LABEL[stageOf(x, now)];
        case "call":
          return x.start_time ?? (order.dir === "asc" ? Infinity : -Infinity);
        case "plan":
          return planOf(x);
        case "from":
          return originOf(x).toLowerCase();
        case "booked":
          return x.created_at;
      }
    };
    const ka = key(a);
    const kb = key(b);
    return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir || b.created_at - a.created_at;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const at = Math.min(page, pages - 1);
  const shown = sorted.slice(at * size, at * size + size);

  const active = [plans.length, needs.length, origins.length, sources.length, call.preset !== "any", booked.preset !== "any"].filter(Boolean).length;
  const narrowed = active > 0 || !!query;

  function clearAll() {
    setPlans([]);
    setNeeds([]);
    setOrigins([]);
    setSources([]);
    setCall({ preset: "any" });
    setBooked({ preset: "any" });
    setQ("");
    setPage(0);
  }

  function chooseTab(k: Tab) {
    setTab(k);
    setSort(null);
    setPage(0);
    const url = new URL(location.href);
    if (k === "all") url.searchParams.delete("show");
    else url.searchParams.set("show", k);
    history.replaceState(history.state, "", url);
  }

  function sortBy(key: SortKey) {
    setPage(0);
    setSort((cur) => {
      const base = cur ?? TAB_SORT[tab];
      if (base.key === key) return { key, dir: base.dir === "asc" ? "desc" : "asc" };
      return { key, dir: key === "call" || key === "booked" ? "desc" : "asc" };
    });
  }

  /* ---- selection */
  const sel = new Set(selected.filter((id) => rows.some((r) => r.id === id)));
  const pageIds = shown.map((b) => b.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => sel.has(id));
  const someOnPage = pageIds.some((id) => sel.has(id));
  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const togglePage = () =>
    setSelected((cur) => (allOnPage ? cur.filter((id) => !pageIds.includes(id)) : [...new Set([...cur, ...pageIds])]));

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(id);
  }, [armed]);

  function removeSelected() {
    if (!armed) {
      setArmed(true);
      return;
    }
    const ids = [...sel];
    setArmed(false);
    startTransition(async () => {
      try {
        await deleteBookings(ids);
        setSelected([]);
        toast(`${ids.length} ${ids.length === 1 ? "booking" : "bookings"} deleted`);
      } catch {
        toast("Couldn't delete them. Try again.");
      }
    });
  }

  /* ---- the panel */
  const openRow = openId ? rows.find((b) => b.id === openId) : undefined;
  const openIndex = openRow ? sorted.findIndex((b) => b.id === openRow.id) : -1;

  function open(id: string | null) {
    setOpenId(id);
    const url = new URL(location.href);
    if (id) url.searchParams.set("open", id);
    else url.searchParams.delete("open");
    history.replaceState(history.state, "", url);
  }

  /* "/" jumps to the search, as in most tools */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || el.closest("input, textarea, select, [contenteditable], dialog")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const cols = 4 + COLUMNS.filter((c) => show(c.key)).length;

  return (
    <div className={`${t.board} ${s.frame}`}>
      {/* ---- tabs, search and the tools */}
      <div className={t.bar}>
        <div className={t.tabs} role="tablist" aria-label="Show">
          {TABS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} className={t.tab} onClick={() => chooseTab(x.key)}>
              {x.label}
              <span className={t.tabCount}>{counts[x.key]}</span>
            </button>
          ))}
        </div>
        <div className={t.tools}>
          <label className={t.search}>
            <Icon icon={Search01Icon} size={16} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search name, email, note…"
              aria-label="Search bookings"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
            {!q && <kbd>/</kbd>}
          </label>
          <Menu label="Columns" icon={LayoutTable01Icon} align="right" solid>
            <p className={t.menuHead}>Show columns</p>
            {COLUMNS.map((c) => (
              <label key={c.key} className={t.option}>
                <input
                  type="checkbox"
                  checked={show(c.key)}
                  onChange={() => {
                    const next = new Set(hidden);
                    if (next.has(c.key)) next.delete(c.key);
                    else next.add(c.key);
                    writeHidden([...next].join(","));
                  }}
                />
                {c.label}
              </label>
            ))}
          </Menu>
          <button
            type="button"
            className={s.btn}
            onClick={() => exportCsv(sorted, now, `bookings-${stamp(now).slice(0, 10)}.csv`)}
            disabled={!sorted.length}
            title="Download these rows as a spreadsheet"
          >
            <Icon icon={Download04Icon} size={16} />
            <span className={t.hideNarrow}>Export</span>
          </button>
        </div>
      </div>

      {/* ---- the filters, or what to do with the ticked rows */}
      {sel.size > 0 ? (
        <div className={t.filters} data-bulk>
          <span className={t.bulkCount}>
            {sel.size} selected
          </span>
          <button type="button" className={s.btn} onClick={() => exportCsv(rows.filter((b) => sel.has(b.id)), now, `bookings-selected-${stamp(now).slice(0, 10)}.csv`)}>
            <Icon icon={Download04Icon} size={16} />
            Export selected
          </button>
          <button type="button" className={`${s.btn} ${s.btnDanger}`} data-armed={armed || undefined} disabled={pending} onClick={removeSelected}>
            {pending ? "Deleting…" : armed ? `Click again to delete ${sel.size}` : "Delete selected"}
          </button>
          <button type="button" className={t.link} onClick={() => setSelected([])}>
            Clear selection
          </button>
        </div>
      ) : (
        <div className={t.filters}>
          <Facet label="Plan" options={options.plans} value={plans} onChange={(v) => { setPlans(v); setPage(0); }} />
          <Facet label="Interested in" options={options.needs} value={needs} onChange={(v) => { setNeeds(v); setPage(0); }} />
          <Facet label="Came from" options={options.origins} value={origins} onChange={(v) => { setOrigins(v); setPage(0); }} />
          <Facet label="Booked through" options={options.sources} value={sources} onChange={(v) => { setSources(v); setPage(0); }} />
          <DateFacet label="Call date" presets={CALL_PRESETS} value={call} onChange={(v) => { setCall(v); setPage(0); }} />
          <DateFacet label="Booked" presets={BOOKED_PRESETS} value={booked} onChange={(v) => { setBooked(v); setPage(0); }} />
          {narrowed && (
            <button type="button" className={t.link} onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ---- the table */}
      <div className={t.scroll}>
        <table className={t.table}>
          <thead>
            <tr>
              <th className={t.check}>
                <input
                  type="checkbox"
                  aria-label="Select every booking on this page"
                  checked={allOnPage}
                  ref={(el) => {
                    if (el) el.indeterminate = !allOnPage && someOnPage;
                  }}
                  onChange={togglePage}
                  disabled={!shown.length}
                />
              </th>
              <SortHead k="name" order={order} onSort={sortBy}>Contact</SortHead>
              {show("status") && <SortHead k="status" order={order} onSort={sortBy}>Status</SortHead>}
              <SortHead k="call" order={order} onSort={sortBy}>Call</SortHead>
              {show("plan") && <SortHead k="plan" order={order} onSort={sortBy}>Plan</SortHead>}
              {show("needs") && <th>Interested in</th>}
              {show("from") && <SortHead k="from" order={order} onSort={sortBy}>Came from</SortHead>}
              {show("timezone") && <th>Their time zone</th>}
              {show("booked") && <SortHead k="booked" order={order} onSort={sortBy}>Booked</SortHead>}
              <th className={t.end} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={cols} className={t.none}>
                  {rows.length === 0 ? (
                    <>
                      <strong>No bookings yet.</strong> They appear here the moment someone books an intro call.
                    </>
                  ) : (
                    <>
                      <strong>Nothing matches.</strong>{" "}
                      {narrowed ? (
                        <button type="button" className={t.link} onClick={clearAll}>
                          Clear the search and filters
                        </button>
                      ) : (
                        "No bookings in this tab."
                      )}
                    </>
                  )}
                </td>
              </tr>
            ) : (
              shown.map((b) => {
                const st = stageOf(b, now);
                const n = needsOf(b);
                const when = b.start_time && mounted ? dayTime(b.start_time, b.end_time) : null;
                return (
                  <tr
                    key={b.id}
                    tabIndex={0}
                    className={t.row}
                    data-selected={sel.has(b.id) || undefined}
                    data-open={openId === b.id || undefined}
                    data-stage={st}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a, button, input, label")) return;
                      open(b.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open(b.id);
                      }
                    }}
                  >
                    <td className={t.check}>
                      <input type="checkbox" aria-label={`Select ${b.name || b.email || "this booking"}`} checked={sel.has(b.id)} onChange={() => toggle(b.id)} />
                    </td>
                    <td>
                      <span className={t.contact}>
                        <span className={t.avatar} aria-hidden>
                          {initials(b)}
                        </span>
                        <span className={t.contactText}>
                          <strong>{b.name || "Name not given"}</strong>
                          {b.email && <span>{b.email}</span>}
                        </span>
                      </span>
                    </td>
                    {show("status") && (
                      <td>
                        <Status stage={st} rescheduled={!!b.rescheduled} />
                      </td>
                    )}
                    <td>
                      {b.start_time ? (
                        <span className={t.when}>
                          <strong>{when ? when.day : new Date(b.start_time).toISOString().slice(0, 10)}</strong>
                          <span>
                            {when ? when.time : " "}
                            {mounted && st === "upcoming" && <em> · {relative(b.start_time, now)}</em>}
                          </span>
                        </span>
                      ) : (
                        <span className={s.muted}>-</span>
                      )}
                    </td>
                    {show("plan") && (
                      <td>
                        {b.plan ? (
                          <span className={`${t.tag} ${t.planTag}`} data-hue={hueOf(`plan ${b.plan}`)}>
                            {b.plan}
                          </span>
                        ) : (
                          <span className={s.muted}>-</span>
                        )}
                      </td>
                    )}
                    {show("needs") && (
                      <td>
                        {n.length ? (
                          <span className={t.tags}>
                            {n.slice(0, 2).map((x) => (
                              <span key={x} className={t.tag} data-hue={hueOf(x)}>
                                {x}
                              </span>
                            ))}
                            {n.length > 2 && (
                              <span className={t.tag} title={n.slice(2).join(", ")}>
                                +{n.length - 2}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className={s.muted}>-</span>
                        )}
                      </td>
                    )}
                    {show("from") && <td className={t.from}>{originOf(b)}</td>}
                    {show("timezone") && <td className={t.from}>{b.timezone ? tzName(b.timezone) : <span className={s.muted}>-</span>}</td>}
                    {show("booked") && (
                      <td className={t.booked} title={mounted ? new Date(b.created_at).toLocaleString() : undefined}>
                        {mounted ? relative(b.created_at, now) : new Date(b.created_at).toISOString().slice(0, 10)}
                      </td>
                    )}
                    <td className={t.end}>
                      <span className={t.rowActions}>
                        {st === "upcoming" && b.meet_url && (
                          <a className={s.iconBtn} href={b.meet_url} target="_blank" rel="noreferrer" title="Join the call" aria-label={`Join the call with ${b.name || "them"}`}>
                            <Icon icon={Video01Icon} size={16} />
                          </a>
                        )}
                        <button type="button" className={t.openBtn} onClick={() => open(b.id)} aria-label={`Open ${b.name || "this booking"}`}>
                          <Icon icon={ArrowRight01Icon} size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ---- the foot: where you are, and the pages */}
      <div className={t.foot}>
        <span>
          {sorted.length
            ? `${at * size + 1}–${Math.min(sorted.length, at * size + size)} of ${sorted.length}`
            : "0 bookings"}
          {sorted.length !== rows.length && <span className={s.muted}> · {rows.length} in all</span>}
        </span>
        <span className={t.pager}>
          <label className={t.size}>
            Rows
            <select
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setPage(0);
              }}
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={s.iconBtn} disabled={at === 0} onClick={() => setPage(at - 1)} aria-label="Previous page">
            <Icon icon={ArrowLeft01Icon} size={16} />
          </button>
          <span className={t.pageNo}>
            {at + 1} / {pages}
          </span>
          <button type="button" className={s.iconBtn} disabled={at >= pages - 1} onClick={() => setPage(at + 1)} aria-label="Next page">
            <Icon icon={ArrowRight01Icon} size={16} />
          </button>
        </span>
      </div>

      <Panel
        row={openRow}
        now={now}
        mounted={mounted}
        place={openIndex >= 0 ? `${openIndex + 1} of ${sorted.length}` : null}
        onPrev={openIndex > 0 ? () => open(sorted[openIndex - 1].id) : undefined}
        onNext={openIndex >= 0 && openIndex < sorted.length - 1 ? () => open(sorted[openIndex + 1].id) : undefined}
        onClose={() => open(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------ pieces */

function SortHead({ k, order, onSort, children }: { k: SortKey; order: Sort; onSort: (k: SortKey) => void; children: React.ReactNode }) {
  const on = order.key === k;
  return (
    <th aria-sort={on ? (order.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" className={t.sort} data-on={on || undefined} onClick={() => onSort(k)}>
        {children}
        <Icon icon={on ? (order.dir === "asc" ? ArrowUp01Icon : ArrowDown01Icon) : ArrowUpDownIcon} size={13} />
      </button>
    </th>
  );
}

function Status({ stage, rescheduled }: { stage: Stage; rescheduled: boolean }) {
  return (
    <span className={t.statusCell}>
      <span className={t.status} data-stage={stage}>
        <i aria-hidden />
        {STAGE_LABEL[stage]}
      </span>
      {rescheduled && <span className={t.moved}>Rescheduled</span>}
    </span>
  );
}

/** A small menu under a button; closes on a click outside, Escape, or another menu opening. */
function Menu({
  label,
  icon,
  badge,
  align = "left",
  solid,
  children,
}: {
  label: React.ReactNode;
  icon?: Parameters<typeof Icon>[0]["icon"];
  badge?: React.ReactNode;
  align?: "left" | "right";
  /** a tool rather than a filter: drawn like a button */
  solid?: boolean;
  children: React.ReactNode;
}) {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  // one menu open at a time
  useEffect(() => {
    const other = (e: Event) => {
      if ((e as CustomEvent).detail !== id) setOn(false);
    };
    addEventListener("mx-menu", other);
    return () => removeEventListener("mx-menu", other);
  }, [id]);

  useEffect(() => {
    if (!on) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOn(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOn(false);
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    addEventListener("mousedown", down);
    addEventListener("keydown", key);
    return () => {
      removeEventListener("mousedown", down);
      removeEventListener("keydown", key);
    };
  }, [on]);

  return (
    <div className={t.menu} ref={ref}>
      <button
        type="button"
        className={`${t.facet} ${solid ? t.facetSolid : ""}`}
        data-on={badge ? true : undefined}
        aria-expanded={on}
        onClick={() => {
          if (!on) dispatchEvent(new CustomEvent("mx-menu", { detail: id }));
          setOn(!on);
        }}
      >
        {icon && <Icon icon={icon} size={15} />}
        {label}
        {badge}
        <Icon icon={ArrowDown01Icon} size={14} className={t.caret} />
      </button>
      {on && (
        <div className={t.menuPanel} data-align={align}>
          {children}
        </div>
      )}
    </div>
  );
}

function Facet({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!options.length) return null;
  const summary = value.length === 0 ? null : value.length === 1 ? value[0] : `${value.length}`;
  return (
    <Menu
      label={label}
      badge={summary ? <span className={t.facetValue}>{summary}</span> : undefined}
    >
      <p className={t.menuHead}>{label}</p>
      <div className={t.optionList}>
        {options.map((o) => (
          <label key={o} className={t.option}>
            <input type="checkbox" checked={value.includes(o)} onChange={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])} />
            <span>{o}</span>
          </label>
        ))}
      </div>
      {value.length > 0 && (
        <button type="button" className={t.menuClear} onClick={() => onChange([])}>
          Clear
        </button>
      )}
    </Menu>
  );
}

function DateFacet({
  label,
  presets,
  value,
  onChange,
}: {
  label: string;
  presets: { key: string; label: string }[];
  value: Range;
  onChange: (v: Range) => void;
}) {
  const on = value.preset !== "any";
  return (
    <Menu label={label} badge={on ? <span className={t.facetValue}>{rangeLabel(value, presets)}</span> : undefined}>
      <p className={t.menuHead}>{label}</p>
      <div className={t.optionList}>
        {presets.map((p) => (
          <label key={p.key} className={t.option}>
            <input type="radio" name={label} checked={value.preset === p.key} onChange={() => onChange({ preset: p.key, from: value.from, to: value.to })} />
            <span>{p.label}</span>
          </label>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className={t.dates}>
          <label>
            From
            <input type="date" value={value.from ?? ""} onChange={(e) => onChange({ ...value, from: e.target.value || undefined })} />
          </label>
          <label>
            To
            <input type="date" value={value.to ?? ""} onChange={(e) => onChange({ ...value, to: e.target.value || undefined })} />
          </label>
        </div>
      )}
    </Menu>
  );
}

/* ------------------------------------------------------------ the panel */

function Panel({
  row: b,
  now,
  mounted,
  place,
  onPrev,
  onNext,
  onClose,
}: {
  row: BookingRow | undefined;
  now: number;
  mounted: boolean;
  place: string | null;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const nav = useRef({ onPrev, onNext });
  useEffect(() => {
    nav.current = { onPrev, onNext };
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (b && !d.open) d.showModal();
    if (!b && d.open) d.close();
  }, [b]);

  const st = b ? stageOf(b, now) : "past";
  const when = b?.start_time && mounted ? dayTime(b.start_time, b.end_time) : null;
  const theirs = b?.start_time && mounted ? theirTime(b.start_time, b.timezone) : null;
  const mins = b?.start_time && b.end_time ? Math.round((b.end_time - b.start_time) / 60_000) : null;

  return (
    <dialog
      ref={ref}
      className={t.panel}
      aria-label={b ? `Booking: ${b.name || b.email || "no name"}` : "Booking"}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      onKeyDown={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest("input, textarea, select")) return;
        if ((e.key === "ArrowDown" || e.key === "j") && nav.current.onNext) {
          e.preventDefault();
          nav.current.onNext();
        }
        if ((e.key === "ArrowUp" || e.key === "k") && nav.current.onPrev) {
          e.preventDefault();
          nav.current.onPrev();
        }
      }}
    >
      {b && (
        <div className={t.panelInner}>
          <header className={t.panelHead}>
            <div className={t.panelNav}>
              <button type="button" className={s.iconBtn} onClick={onPrev} disabled={!onPrev} aria-label="Previous booking" title="Previous (↑)">
                <Icon icon={ArrowUp01Icon} size={16} />
              </button>
              <button type="button" className={s.iconBtn} onClick={onNext} disabled={!onNext} aria-label="Next booking" title="Next (↓)">
                <Icon icon={ArrowDown01Icon} size={16} />
              </button>
              {place && <span className={t.panelPlace}>{place}</span>}
              <button type="button" className={`${s.iconBtn} ${t.panelClose}`} onClick={() => ref.current?.close()} aria-label="Close">
                <Icon icon={Cancel01Icon} size={16} />
              </button>
            </div>
            <div className={t.panelWho}>
              <span className={`${t.avatar} ${t.avatarBig}`} aria-hidden>
                {initials(b)}
              </span>
              <div>
                <h2 className={t.panelName}>{b.name || "Name not given"}</h2>
                {b.email && <p className={t.panelEmail}>{b.email}</p>}
              </div>
            </div>
            <Status stage={st} rescheduled={!!b.rescheduled} />
          </header>

          <div className={t.panelActions}>
            {b.meet_url && st !== "cancelled" && (
              <a className={`${s.btn} ${st === "upcoming" ? s.btnPrimary : ""}`} href={b.meet_url} target="_blank" rel="noreferrer">
                <Icon icon={Video01Icon} size={16} />
                {st === "upcoming" ? "Join the call" : "Meeting link"}
              </a>
            )}
            {b.email && (
              <a className={s.btn} href={`mailto:${b.email}`}>
                <Icon icon={Mail01Icon} size={16} />
                Email
              </a>
            )}
            {b.email && (
              <button
                type="button"
                className={s.btn}
                onClick={async () => {
                  await navigator.clipboard.writeText(b.email!);
                  toast("Email copied");
                }}
              >
                <Icon icon={Copy01Icon} size={16} />
                Copy email
              </button>
            )}
          </div>

          <div className={t.panelBody}>
            <section className={t.panelPart}>
              <h3>The call</h3>
              <dl className={t.facts}>
                <div>
                  <dt>Your time</dt>
                  <dd>{when ? `${when.day}, ${when.time}` : b.start_time ? "…" : "Not picked yet"}</dd>
                </div>
                {b.start_time && mounted && st === "upcoming" && (
                  <div>
                    <dt>Starts</dt>
                    <dd>{relative(b.start_time, now)}</dd>
                  </div>
                )}
                {theirs && (
                  <div>
                    <dt>Their time</dt>
                    <dd>
                      {theirs}
                      <span className={t.sub}>{b.timezone?.replace(/_/g, " ")}</span>
                    </dd>
                  </div>
                )}
                {mins && (
                  <div>
                    <dt>Length</dt>
                    <dd>{mins} min</dd>
                  </div>
                )}
                {b.rescheduled ? (
                  <div>
                    <dt>Changes</dt>
                    <dd>Rescheduled at least once</dd>
                  </div>
                ) : null}
                {b.cancel_reason && (
                  <div>
                    <dt>Why cancelled</dt>
                    <dd>{b.cancel_reason}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className={t.panelPart}>
              <h3>What they asked for</h3>
              <dl className={t.facts}>
                <div>
                  <dt>Plan</dt>
                  <dd>{b.plan || <span className={s.muted}>None picked</span>}</dd>
                </div>
                <div>
                  <dt>Interested in</dt>
                  <dd>
                    {needsOf(b).length ? (
                      <span className={t.tags}>
                        {needsOf(b).map((x) => (
                          <span key={x} className={t.tag} data-hue={hueOf(x)}>
                            {x}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className={s.muted}>Nothing picked</span>
                    )}
                  </dd>
                </div>
              </dl>
              {b.note ? <p className={t.note}>{b.note}</p> : <p className={t.noNote}>No note left.</p>}
            </section>

            <section className={t.panelPart}>
              <h3>Where it came from</h3>
              <dl className={t.facts}>
                <div>
                  <dt>Came from</dt>
                  <dd>{originOf(b)}</dd>
                </div>
                <div>
                  <dt>Booked through</dt>
                  <dd>{sourceOf(b)}</dd>
                </div>
                <div>
                  <dt>Booked on</dt>
                  <dd>
                    {mounted ? new Date(b.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : new Date(b.created_at).toISOString().slice(0, 16).replace("T", " ")}
                    {mounted && <span className={t.sub}>{relative(b.created_at, now)}</span>}
                  </dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd className={t.mono}>{b.id}</dd>
                </div>
              </dl>
            </section>
          </div>

          <form action={deleteBooking} className={t.panelFoot}>
            <input type="hidden" name="id" value={b.id} />
            <span>Deleting removes it from this list only. The call stays on your Cal.com calendar.</span>
            <DeleteButton action={deleteBooking} label="Delete booking" />
          </form>
        </div>
      )}
    </dialog>
  );
}
