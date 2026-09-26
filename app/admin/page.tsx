"use client";

import { AUTHOR_URL } from "./demo";
import Link from "next/link";
import Add01Icon from "@hugeicons/core-free-icons/Add01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import ArrowUpRight01Icon from "@hugeicons/core-free-icons/ArrowUpRight01Icon";
import Calendar03Icon from "@hugeicons/core-free-icons/Calendar03Icon";
import Folder01Icon from "@hugeicons/core-free-icons/Folder01Icon";
import Mouse01Icon from "@hugeicons/core-free-icons/Mouse01Icon";
import TextFontIcon from "@hugeicons/core-free-icons/TextFontIcon";
import UserMultiple02Icon from "@hugeicons/core-free-icons/UserMultiple02Icon";
import Video01Icon from "@hugeicons/core-free-icons/Video01Icon";
import { getSettings } from "@/lib/content";
import { env, useDatabase } from "@/lib/db";
import { overview } from "@/lib/overview";
import { siteName } from "@/lib/seo";
import { LocalTime } from "./bookings/LocalTime";
import { Icon, type IconSvgElement } from "./Icon";
import { NAV } from "./nav";
import { Today } from "./Today";
import { Card, adminStyles as s } from "./ui";
import o from "./overview.module.css";

/* what each part of the site counts, for its cell */
const COUNT: Record<string, { table: string; noun: string }> = {
  "/admin/bookings": { table: "bookings", noun: "booking" },
  "/admin/clients": { table: "clients", noun: "logo" },
  "/admin/photos": { table: "photos", noun: "photo" },
  "/admin/works": { table: "works", noun: "project" },
  "/admin/categories": { table: "categories", noun: "category" },
  "/admin/about": { table: "experience", noun: "role" },
  "/admin/plans": { table: "plans", noun: "plan" },
  "/admin/testimonials": { table: "testimonials", noun: "testimonial" },
  "/admin/faqs": { table: "faqs", noun: "question" },
  "/admin/media": { table: "media", noun: "file" },
};

const plural = (n: number, noun: string) =>
  `${n} ${n === 1 ? noun : noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`}`;

/** "+12%" against last week, or nothing to compare with. */
function delta(now: number, before: number): { text: string; dir: "up" | "down" | "flat" } | null {
  if (!before) return now ? { text: "new this week", dir: "up" } : null;
  const pct = Math.round(((now - before) / before) * 100);
  return { text: `${pct > 0 ? "+" : ""}${pct}% vs last week`, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

export default function AdminHome() {
  useDatabase();
  const [d, settings, e] = [overview(), getSettings(), env()] as const;
  const first = siteName(settings).split(/\s+/)[0];
  const host = e.CANONICAL_HOST || "";
  const next = d.upcoming[0];

  const kpis: { label: string; value: string; icon: IconSvgElement; href: string; sub: React.ReactNode }[] = [
    {
      label: "Visitors",
      value: String(d.visitors),
      icon: UserMultiple02Icon,
      href: "/admin/analytics",
      sub: <Delta d={delta(d.visitors, d.visitorsPrev)} fallback="last 7 days" />,
    },
    {
      label: "Button clicks",
      value: String(d.clicks),
      icon: Mouse01Icon,
      href: "/admin/analytics",
      sub: <Delta d={delta(d.clicks, d.clicksPrev)} fallback="last 7 days" />,
    },
    {
      label: "Upcoming calls",
      value: String(d.upcomingCount),
      icon: Calendar03Icon,
      href: "/admin/bookings?show=upcoming",
      sub: `${plural(d.booked, "booking")} this week`,
    },
    {
      label: "Projects",
      value: String(d.counts.works ?? 0),
      icon: Folder01Icon,
      href: "/admin/works",
      sub: `${d.onHomepage} on the homepage`,
    },
  ];

  // every part of the site but this page: twelve cells, so the lattice
  // closes evenly at four, three or two across
  const tiles = NAV.flatMap((g) => g.items).filter((i) => i.href !== "/admin");
  const countOf = (href: string) => {
    if (href === "/admin/analytics") return plural(d.visitors, "visitor") + " this week";
    const c = COUNT[href];
    return c ? plural(d.counts[c.table] ?? 0, c.noun) : null;
  };

  return (
    <>
      <section className={`${o.hero} ${s.frame}`}>
        <div className={o.heroMain}>
          <div>
            <p className={o.kicker}>
              Overview
              <i aria-hidden />
              <Today />
            </p>
            <h1 className={o.heroTitle}>Welcome back, {first}</h1>
            <p className={o.heroNote}>Everything on the site lives here. Changes go live the moment you save.</p>
          </div>
          <div className={o.next}>
            <span className={o.nextLabel}>Next call</span>
            {next ? (
              <>
                <span className={o.nextWhen}>
                  <LocalTime start={next.start_time} end={next.end_time} />
                </span>
                <span className={o.nextWho}>
                  with <Link href={`/admin/bookings?open=${next.id}`}>{next.name || next.email || "someone"}</Link>
                </span>
              </>
            ) : (
              <>
                <span className={o.nextWhen}>Nothing booked</span>
                <span className={o.nextWho}>New calls show up here the moment they are booked.</span>
              </>
            )}
          </div>
        </div>
        <div className={o.heroBand}>
          <div className={o.heroActions}>
            <Link className={`${s.btn} ${s.btnPrimary}`} href="/admin/works?add=1">
              <Icon icon={Add01Icon} size={16} />
              Add project
            </Link>
            <Link className={s.btn} href="/admin/settings">
              <Icon icon={TextFontIcon} size={16} />
              Edit text
            </Link>
          </div>
          {host && (
            <a className={o.host} href={AUTHOR_URL} target="_blank" rel="noreferrer" title="The live site this admin was built for">
              <span className={o.liveDot} aria-hidden />
              {AUTHOR_URL.replace(/^https?:\/\//, "")}
              <Icon icon={ArrowUpRight01Icon} size={15} />
            </a>
          )}
        </div>
      </section>

      <div className={`${o.kpis} ${s.frame}`}>
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className={o.kpi}>
            <span className={o.kpiHead}>
              <span>
                <Icon icon={k.icon} size={18} />
                {k.label}
              </span>
              <Icon icon={ArrowRight01Icon} size={16} className={o.kpiGo} />
            </span>
            <span className={o.kpiValue}>{k.value}</span>
            <span className={o.kpiSub}>{k.sub}</span>
          </Link>
        ))}
      </div>

      <div className={o.split}>
        <Card
          title="Upcoming calls"
          flush
          actions={
            <Link href="/admin/bookings?show=upcoming" className={o.more}>
              All bookings <Icon icon={ArrowRight01Icon} size={14} />
            </Link>
          }
        >
          {d.upcoming.length === 0 ? (
              <p className={o.none}>No calls booked yet. They show up here as soon as someone books.</p>
            ) : (
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Who</th>
                      <th className={o.planCol}>Plan</th>
                      <th aria-label="Join" />
                    </tr>
                  </thead>
                  <tbody>
                    {d.upcoming.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <span className={o.when}>
                            <strong>
                              <LocalTime start={b.start_time} end={b.end_time} />
                            </strong>
                          </span>
                        </td>
                        <td>
                          <span className={o.who}>
                            <Link href={`/admin/bookings?open=${b.id}`}>{b.name || "Name not given"}</Link>
                            {b.email && <span>{b.email}</span>}
                          </span>
                        </td>
                        <td className={o.planCol}>{b.plan || <span className={s.muted}>-</span>}</td>
                        <td className={o.join}>
                          {b.meet_url && (
                            <a className={s.iconBtn} href={b.meet_url} target="_blank" rel="noreferrer" aria-label={`Join the call with ${b.name ?? "them"}`} title="Join the call">
                              <Icon icon={Video01Icon} size={16} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>

        <Card
          title="This week"
          flush
          actions={
            <Link href="/admin/analytics" className={o.more}>
              Analytics <Icon icon={ArrowRight01Icon} size={14} />
            </Link>
          }
        >
          <dl className={o.facts}>
            <div>
              <dt>Visitors</dt>
              <dd>{d.visitors}</dd>
            </div>
            <div>
              <dt>Button clicks</dt>
              <dd>{d.clicks}</dd>
            </div>
            <div>
              <dt>Clicks per visitor</dt>
              <dd>{d.visitors ? (d.clicks / d.visitors).toFixed(2) : "-"}</dd>
            </div>
            <div>
              <dt>Calls booked</dt>
              <dd>{d.booked}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card title="Site content" note="Every part of the site, and how much is in it." flush>
        <div className={o.tiles}>
          {tiles.map((t) => {
            const count = countOf(t.href);
            return (
              <Link key={t.href} href={t.href} className={o.tile}>
                <span className={o.tileTop}>
                  <Icon icon={t.icon} size={20} />
                  <Icon icon={ArrowRight01Icon} size={16} className={o.kpiGo} />
                </span>
                <span className={o.tileText}>
                  <strong>{t.label}</strong>
                  <span>{t.note}</span>
                </span>
                {count && <span className={o.tileCount}>{count}</span>}
              </Link>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function Delta({ d, fallback }: { d: ReturnType<typeof delta>; fallback: string }) {
  if (!d) return <>{fallback}</>;
  return (
    <span className={o.delta} data-dir={d.dir}>
      {d.text}
    </span>
  );
}
