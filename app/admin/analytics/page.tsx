"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  RANGES,
  TZ_LABEL,
  TZ_OFFSET_MS,
  loadReport,
  resolveRange,
  type Kpis,
  type Report,
  type Row,
} from "@/lib/analytics";
import { getPlans, getSettings } from "@/lib/content";
import { metaPixelId } from "@/lib/cta";
import { useDatabase } from "@/lib/db";
import { PageHead, adminStyles as admin } from "../ui";
import { ColumnChart, Heatmap, TrendChart } from "./Charts";
import styles from "./analytics.module.css";

/* ---------------------------------------------------------------- format */

const nf = new Intl.NumberFormat("en");
const cf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const int = (v: unknown) => nf.format(Math.round(num(v)));
const big = (v: unknown) => (num(v) >= 10_000 ? cf.format(num(v)) : int(v));
const pct = (a: unknown, b: unknown) => (num(b) ? `${Math.round((num(a) / num(b)) * 1000) / 10}%` : "-");

function dur(ms: unknown): string {
  const s = Math.round(num(ms) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-09-26" / "2026-09-26 14" / "2026-09" → short axis label and long tooltip label */
function bucketLabel(b: string, bucket: Report["range"]["bucket"]) {
  const [y, m, rest] = b.split("-");
  if (bucket === "month") return { label: MONTHS[+m - 1], long: `${MONTHS[+m - 1]} ${y}` };
  const [d, h] = (rest ?? "").split(" ");
  const wd = WEEKDAYS[new Date(Date.UTC(+y, +m - 1, +d)).getUTCDay()];
  if (bucket === "hour") {
    return { label: `${h}:00`, long: `${wd} ${+d} ${MONTHS[+m - 1]}, ${h}:00–${String((+h + 1) % 24).padStart(2, "0")}:00` };
  }
  return { label: `${+d} ${MONTHS[+m - 1]}`, long: `${wd} ${+d} ${MONTHS[+m - 1]} ${y}` };
}

function when(ts: unknown): string {
  const d = new Date(num(ts) + TZ_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

let regionNames: Intl.DisplayNames | null = null;
let languageNames: Intl.DisplayNames | null = null;
try {
  regionNames = new Intl.DisplayNames(["en"], { type: "region" });
  languageNames = new Intl.DisplayNames(["en"], { type: "language" });
} catch {
  /* runtime without display names: fall back to codes */
}

function country(code: unknown): string {
  const c = typeof code === "string" && /^[A-Z]{2}$/i.test(code) ? code.toUpperCase() : null;
  if (!c || c === "XX" || c === "T1") return "Unknown";
  const flag = String.fromCodePoint(...[...c].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
  let name = c;
  try {
    name = regionNames?.of(c) ?? c;
  } catch {
    /* keep the code */
  }
  return `${flag}  ${name}`;
}

function language(code: unknown): string {
  if (typeof code !== "string" || !code) return "Unknown";
  try {
    return languageNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

const TARGETS: Record<string, string> = {
  booking: "Booking page",
  meeting: "Booking a call",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "Email",
  phone: "Phone",
  link: "Other link",
};
const LOCATIONS: Record<string, string> = {
  sidebar: "Sidebar",
  pricing: "Pricing card",
  work: "/work page",
  cta: "Call to action",
  about: "About page",
};
const target = (v: unknown) => TARGETS[String(v)] ?? String(v ?? "-");
const place = (v: unknown) => LOCATIONS[String(v)] ?? String(v ?? "-");
const source = (v: unknown) => (v ? String(v) : "Direct / unknown");

/* ---------------------------------------------------------------- pieces */

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={`${styles.card} ${admin.frame}`}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {note && <span className={styles.cardNote}>{note}</span>}
      </div>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

function Empty({ children = "Nothing in this period yet." }: { children?: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

/** Magnitude as thin bars, one colour. The numbers are printed, so this is its own table view. */
function Bars({
  rows,
  unit,
}: {
  rows: { label: ReactNode; value: number; note?: string }[];
  unit: string;
}) {
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className={styles.bars} aria-label={unit}>
      {rows.map((r, i) => (
        <li key={i} className={styles.barRow}>
          <span className={styles.barLabel}>{r.label}</span>
          <span className={styles.barValue}>
            {int(r.value)}
            {r.note && <small>{r.note}</small>}
          </span>
          <span className={styles.track} aria-hidden>
            {r.value > 0 && <span className={styles.fill} style={{ width: `${(r.value / max) * 100}%` }} />}
          </span>
        </li>
      ))}
    </ul>
  );
}

function change(cur: number, prev: number, upIsGood: boolean, vs: string, isRate = false) {
  if (!prev && !cur) return { text: `no data ${vs}`, tone: "flat" as const };
  if (!prev) return { text: `▲ new ${vs}`, tone: upIsGood ? ("good" as const) : ("bad" as const) };
  const diff = isRate ? (cur - prev) * 100 : ((cur - prev) / prev) * 100;
  const r = Math.round(diff * 10) / 10;
  if (r === 0) return { text: `no change ${vs}`, tone: "flat" as const };
  const up = r > 0;
  return {
    text: `${up ? "▲" : "▼"} ${Math.abs(r)}${isRate ? " pts" : "%"} ${vs}`,
    tone: up === upIsGood ? ("good" as const) : ("bad" as const),
  };
}

function Tile({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: ReturnType<typeof change>;
  hint?: string;
}) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      {delta && (
        <span className={styles.delta} data-tone={delta.tone}>
          {delta.text}
        </span>
      )}
      {hint && <span className={styles.tileHint}>{hint}</span>}
    </div>
  );
}

function kpiView(k: Kpis) {
  const sessions = num(k?.sessions);
  return {
    visitors: num(k?.visitors),
    views: num(k?.views),
    sessions,
    perSession: sessions ? num(k.views) / sessions : 0,
    bounce: sessions ? num(k.bounced) / sessions : 0,
    avgMs: num(k?.avgMs),
    clicks: num(k?.clicks),
    conversion: sessions ? num(k.converted) / sessions : 0,
    converted: num(k?.converted),
  };
}

/* ---------------------------------------------------------------- page */

export default function AnalyticsPage() {
  useDatabase();
  const params = useSearchParams();
  const raw = params.get("range") ?? undefined;
  const me = params.get("me");
  const own = me === "1";
  const range = resolveRange(raw);
  const [r, settings, plans] = [loadReport(range, { own }), getSettings(), getPlans()] as const;
  const href = (k: string, m: boolean) => `/admin/analytics?range=${k}${m ? "&me=1" : ""}`;

  const cur = kpiView(r.kpis);
  const prev = kpiView(r.prev);
  const vs = range.key === "today" ? "vs yesterday so far" : "vs previous period";

  // things that make the numbers below meaningless if missing
  const missing: ReactNode[] = [];
  // an empty Intro Call link is fine: the buttons open the booking window
  if (!settings["cta.messageHref"]) missing.push(<>The <b>Message</b> link is empty, so the WhatsApp/Telegram button goes nowhere.</>);
  const deadPlans = plans.filter((p) => !p.cta.href).map((p) => p.name);
  if (deadPlans.length) missing.push(<>Pricing buttons with no link: <b>{deadPlans.join(", ")}</b>.</>);
  if (!metaPixelId(settings["tracking.metaPixelId"])) missing.push(<>No <b>Meta Pixel ID</b> yet. Clicks are recorded here, but not sent to Meta.</>);

  // fill empty buckets so the line does not skip days with no traffic
  const byBucket = new Map(r.trend.map((t) => [t.b, t]));
  const clicksBy = new Map(r.clickTrend.map((t) => [t.b, num(t.clicks)]));
  const trend = range.buckets.map((b) => ({
    ...bucketLabel(b, range.bucket),
    visitors: num(byBucket.get(b)?.visitors),
    views: num(byBucket.get(b)?.views),
  }));
  const clicks = range.buckets.map((b) => ({ ...bucketLabel(b, range.bucket), value: clicksBy.get(b) ?? 0 }));

  // weekday × hour, Monday first (SQLite's %w counts from Sunday)
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const c of r.heat) grid[(num(c.d) + 6) % 7][num(c.h)] = num(c.views);

  const f = r.funnel ?? { sessions: 0, sawPricing: 0, clickedPricing: 0, clickedAny: 0 };
  const funnel = [
    { label: "Sessions", value: num(f.sessions), color: "var(--seq-250)" },
    { label: "Scrolled to the pricing cards", value: num(f.sawPricing), color: "var(--seq-450)" },
    { label: "Clicked a pricing button", value: num(f.clickedPricing), color: "var(--seq-650)" },
  ];

  const scrollTotal = num(r.scroll?.total);
  const dwell = r.dwell ?? { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };

  return (
    <div className={styles.page}>
      <PageHead
        title="Analytics"
        note={`First-party and cookie-free. A person counts once a day. Visits from a browser signed in here are yours, and are left out unless you switch them on. ${TZ_LABEL}.`}
      >
        <span className={styles.live} title="Visitors active in the last five minutes">
          <span className={styles.liveDot} data-idle={r.live.visitors ? undefined : true} />
          {r.live.visitors} on the site now
        </span>
      </PageHead>

      <nav className={styles.filters} aria-label="Date range">
        {RANGES.map((x) => (
          <Link
            key={x.key}
            href={href(x.key, own)}
            className={styles.filter}
            data-active={x.key === range.key || undefined}
            aria-current={x.key === range.key ? "page" : undefined}
          >
            {x.label}
          </Link>
        ))}
        <span className={styles.filterGap} />
        <Link
          href={href(range.key, !own)}
          className={styles.toggle}
          role="switch"
          aria-checked={own}
          data-on={own || undefined}
        >
          <span className={styles.toggleTrack}><span /></span>
          Include my own visits
        </Link>
      </nav>

      {!own && r.ownInRange > 0 && (
        <p className={styles.ownNote}>
          {int(r.ownInRange)} page {r.ownInRange === 1 ? "view" : "views"} from your own browser in this period{" "}
          {r.ownInRange === 1 ? "is" : "are"} hidden. <Link href={href(range.key, true)}>Show them</Link> to check
          the tracking, or open the site in a private window to see it the way a visitor does.
        </p>
      )}

      {missing.length > 0 && (
        <div className={styles.setup}>
          <p className={styles.setupTitle}>Finish setting up tracking</p>
          <ul>
            {missing.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <span className={styles.cardNote}>
            Links and pixel: <Link href="/admin/settings">Text &amp; labels</Link> · per-card buttons:{" "}
            <Link href="/admin/plans">Pricing plans</Link>
          </span>
        </div>
      )}

      {r.totalEver === 0 && (
        <div className={`${styles.card} ${admin.frame}`}>
          <div className={styles.cardBody}>
          <Empty>
            No visits recorded yet. Open the site in any browser and the visit shows up here within a few seconds
            (switch on &ldquo;Include my own visits&rdquo; if it was this browser). Only the address this site is
            deployed on is measured.
          </Empty>
          </div>
        </div>
      )}

      <div className={`${styles.kpis} ${admin.frame}`}>
        <Tile label="Visitors" value={big(cur.visitors)} delta={change(cur.visitors, prev.visitors, true, vs)} />
        <Tile label="Sessions" value={big(cur.sessions)} delta={change(cur.sessions, prev.sessions, true, vs)} />
        <Tile label="Page views" value={big(cur.views)} delta={change(cur.views, prev.views, true, vs)} />
        <Tile
          label="Pages per session"
          value={cur.perSession ? cur.perSession.toFixed(2) : "-"}
          delta={change(cur.perSession, prev.perSession, true, vs)}
        />
        <Tile
          label="Bounce rate"
          value={cur.sessions ? pct(cur.bounce, 1) : "-"}
          delta={change(cur.bounce, prev.bounce, false, vs, true)}
          hint="One page, under 10s, no click"
        />
        <Tile
          label="Avg. visit length"
          value={cur.sessions ? dur(cur.avgMs) : "-"}
          delta={change(cur.avgMs, prev.avgMs, true, vs)}
          hint="Time the tab was actually visible"
        />
        <Tile label="Button clicks" value={big(cur.clicks)} delta={change(cur.clicks, prev.clicks, true, vs)} />
        <Tile
          label="Conversion rate"
          value={cur.sessions ? pct(cur.conversion, 1) : "-"}
          delta={change(cur.conversion, prev.conversion, true, vs, true)}
          hint={`${int(cur.converted)} of ${int(cur.sessions)} sessions clicked a button`}
        />
      </div>

      <Card title="Visitors and page views" note={range.label}>
        <TrendChart points={trend} />
        <details className={styles.more}>
          <summary>Show as a table</summary>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>{range.bucket === "hour" ? "Hour" : range.bucket === "month" ? "Month" : "Day"}</th><th className={styles.num}>Visitors</th><th className={styles.num}>Page views</th><th className={styles.num}>Button clicks</th></tr>
              </thead>
              <tbody>
                {trend.map((t, i) => (
                  <tr key={i}><td>{t.long}</td><td className={styles.num}>{int(t.visitors)}</td><td className={styles.num}>{int(t.views)}</td><td className={styles.num}>{int(clicks[i].value)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      {/* ------------------------------------------------------ CTAs */}
      <h2 className={styles.section}>Buttons and conversions</h2>
      <p className={styles.sectionNote}>
        Every click on Message, Intro Call and the pricing-card buttons, and which card it came from.
      </p>

      <div className={styles.grid2}>
        <Card title="Pricing funnel" note="sessions">
          <ol className={styles.funnel}>
            {funnel.map((s, i) => (
              <li key={s.label} className={styles.funnelStep}>
                <span className={styles.barLabel}>{s.label}</span>
                <span className={styles.barValue}>
                  {int(s.value)}
                  {i > 0 && <small>{pct(s.value, funnel[0].value)}</small>}
                </span>
                <span className={styles.funnelBar} aria-hidden>
                  <span style={{ width: `${funnel[0].value ? (s.value / funnel[0].value) * 100 : 0}%`, background: s.color }} />
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Button clicks" note={range.label}>
          {cur.clicks ? <ColumnChart points={clicks} unit="clicks" /> : <Empty />}
        </Card>
      </div>

      <Card title="Which buttons get clicked">
        {r.ctaButtons.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Button</th><th>Where</th><th>Pricing card</th><th>Goes to</th><th className={styles.num}>Clicks</th><th className={styles.num}>People</th></tr>
              </thead>
              <tbody>
                {r.ctaButtons.map((b, i) => (
                  <tr key={i}>
                    <td>{String(b.label ?? "-")}</td>
                    <td>{place(b.k)}</td>
                    <td>{b.plan ? <span className={styles.tag}>{String(b.plan)}</span> : <span className={styles.muted}>-</span>}</td>
                    <td>{target(b.target)}</td>
                    <td className={styles.num}>{int(b.clicks)}</td>
                    <td className={styles.num}>{int(b.people)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Card>

      <div className={styles.grid2}>
        <Card title="By pricing card" note="clicks · people">
          <Bars unit="clicks by pricing card" rows={r.ctaPlans.map((p) => ({ label: String(p.k ?? "-"), value: num(p.clicks), note: `${int(p.people)} people` }))} />
        </Card>
        <Card title="By destination" note="clicks · people">
          <Bars unit="clicks by destination" rows={r.ctaTargets.map((p) => ({ label: target(p.k), value: num(p.clicks), note: `${int(p.people)} people` }))} />
        </Card>
      </div>

      <Card title="Latest clicks" note="newest first">
        {r.recent.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>When</th><th>Button</th><th>Pricing card</th><th>Goes to</th><th>Came from</th><th>Location</th><th>Device</th></tr>
              </thead>
              <tbody>
                {r.recent.map((e, i) => (
                  <tr key={i}>
                    <td className={styles.muted} style={{ whiteSpace: "nowrap" }}>{when(e.k)}</td>
                    <td>{String(e.label ?? "-")} <span className={styles.muted}>· {place(e.location)}</span></td>
                    <td>{e.plan ? <span className={styles.tag}>{String(e.plan)}</span> : <span className={styles.muted}>-</span>}</td>
                    <td>{target(e.target)}</td>
                    <td>{source(e.source)}</td>
                    <td>{e.city ? `${String(e.city)}, ` : ""}{country(e.country).replace(/^\S+\s+/, "")}</td>
                    <td className={styles.muted}>{[e.device, e.browser].filter(Boolean).join(" · ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Card>

      {/* ------------------------------------------------------ acquisition */}
      <h2 className={styles.section}>Where visitors come from</h2>
      <p className={styles.sectionNote}>
        By the page each visit started on. A link tagged with <code>utm_source</code> is counted under its tag (marked
        UTM) rather than the site it was clicked on, so paid and organic traffic from the same place stay apart.
      </p>

      <div className={styles.grid2}>
        <Card title="Sources" note="sessions · converted">
          {r.sources.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Source</th><th className={styles.num}>Sessions</th><th className={styles.num}>Clicked</th><th className={styles.num}>Rate</th></tr></thead>
                <tbody>
                  {r.sources.map((s, i) => (
                    <tr key={i}>
                      <td>
                        {source(s.k)}
                        {num(s.tagged) ? <span className={styles.muted}> · UTM</span> : null}
                      </td>
                      <td className={styles.num}>{int(s.sessions)}</td>
                      <td className={styles.num}>{int(s.converted)}</td>
                      <td className={styles.num}>{pct(s.converted, s.sessions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
        </Card>
        <Card title="Campaigns" note="utm_source / medium / campaign">
          {r.campaigns.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Campaign</th><th className={styles.num}>Sessions</th><th className={styles.num}>Clicked</th></tr></thead>
                <tbody>
                  {r.campaigns.map((c, i) => (
                    <tr key={i}>
                      <td>
                        {String(c.k)}
                        {c.medium ? <span className={styles.muted}> / {String(c.medium)}</span> : null}
                        {c.campaign ? <div className={styles.muted}>{String(c.campaign)}</div> : null}
                      </td>
                      <td className={styles.num}>{int(c.sessions)}</td>
                      <td className={styles.num}>{int(c.converted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              No tagged links yet. Add <code>?utm_source=facebook&amp;utm_medium=paid&amp;utm_campaign=…</code> to the links
              in your ads and posts to see them here.
            </Empty>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------ content */}
      <h2 className={styles.section}>Pages</h2>

      <Card title="Top pages">
        {r.pages.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Page</th><th className={styles.num}>Views</th><th className={styles.num}>Visitors</th><th className={styles.num}>Avg. time</th><th className={styles.num}>Avg. scroll</th></tr></thead>
              <tbody>
                {r.pages.map((p, i) => (
                  <tr key={i}>
                    <td>{String(p.k)}</td>
                    <td className={styles.num}>{int(p.views)}</td>
                    <td className={styles.num}>{int(p.visitors)}</td>
                    <td className={styles.num}>{dur(p.avgMs)}</td>
                    <td className={styles.num}>{Math.round(num(p.scroll))}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Card>

      <div className={styles.grid2}>
        <Card title="Entry pages" note="sessions started">
          <Bars unit="entry pages" rows={r.entries.map((p) => ({ label: String(p.k), value: num(p.sessions) }))} />
        </Card>
        <Card title="Exit pages" note="sessions ended">
          <Bars unit="exit pages" rows={r.exits.map((p) => ({ label: String(p.k), value: num(p.sessions) }))} />
        </Card>
      </div>

      {/* ------------------------------------------------------ engagement */}
      <h2 className={styles.section}>Engagement</h2>

      <div className={styles.grid2}>
        <Card title="Time on page" note="page views">
          <Bars
            unit="time on page"
            rows={[
              { label: "Under 10 seconds", value: num(dwell.a) },
              { label: "10–30 seconds", value: num(dwell.b) },
              { label: "30–60 seconds", value: num(dwell.c) },
              { label: "1–3 minutes", value: num(dwell.d) },
              { label: "3–10 minutes", value: num(dwell.e) },
              { label: "Over 10 minutes", value: num(dwell.f) },
            ].filter((x) => scrollTotal > 0 || x.value > 0)}
          />
        </Card>
        <Card title="How far people scroll" note="share of page views">
          {scrollTotal ? (
            <Bars
              unit="scroll depth"
              rows={[
                { label: "Reached 25%", value: num(r.scroll.s25), note: pct(r.scroll.s25, scrollTotal) },
                { label: "Reached 50%", value: num(r.scroll.s50), note: pct(r.scroll.s50, scrollTotal) },
                { label: "Reached 75%", value: num(r.scroll.s75), note: pct(r.scroll.s75, scrollTotal) },
                { label: "Reached the end (90%+)", value: num(r.scroll.s90), note: pct(r.scroll.s90, scrollTotal) },
              ]}
            />
          ) : (
            <Empty />
          )}
        </Card>
      </div>

      <Card title="When people visit" note={`page views by weekday and hour · ${TZ_LABEL}`}>
        <Heatmap grid={grid} />
      </Card>

      {/* ------------------------------------------------------ audience */}
      <h2 className={styles.section}>Audience</h2>

      <div className={styles.grid2}>
        <Card title="Countries" note="visitors">
          <Bars unit="visitors by country" rows={r.countries.map((c) => ({ label: country(c.k), value: num(c.visitors) }))} />
        </Card>
        <Card title="Cities" note="visitors">
          <Bars
            unit="visitors by city"
            rows={r.cities.map((c) => ({ label: `${String(c.k)}${c.country ? `, ${String(c.country)}` : ""}`, value: num(c.visitors) }))}
          />
        </Card>
      </div>

      <div className={styles.grid3}>
        <Card title="Devices" note="visitors">
          <Bars unit="visitors by device" rows={r.devices.map((d) => ({ label: cap(d.k), value: num(d.visitors) }))} />
        </Card>
        <Card title="Browsers" note="visitors">
          <Bars unit="visitors by browser" rows={r.browsers.map((d) => ({ label: String(d.k ?? "Other"), value: num(d.visitors) }))} />
        </Card>
        <Card title="Operating systems" note="visitors">
          <Bars unit="visitors by operating system" rows={r.os.map((d) => ({ label: String(d.k ?? "Other"), value: num(d.visitors) }))} />
        </Card>
      </div>

      <div className={styles.grid2}>
        <Card title="Screen sizes" note="visitors">
          <Bars unit="visitors by screen size" rows={r.screens.filter((d) => d.k).map((d) => ({ label: String(d.k), value: num(d.visitors) }))} />
        </Card>
        <Card title="Languages" note="visitors">
          <Bars unit="visitors by browser language" rows={r.languages.map((d) => ({ label: language(d.k), value: num(d.visitors) }))} />
        </Card>
      </div>

      {r.live.pages.length > 0 && (
        <Card title="Right now" note="last five minutes">
          <Bars unit="active visitors by page" rows={r.live.pages.map((p: Row) => ({ label: String(p.k), value: num(p.visitors) }))} />
        </Card>
      )}

    </div>
  );
}

function cap(v: unknown): string {
  const s = String(v ?? "Other");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
