"use client";

import { AUTHOR_URL } from "../demo";
import { useSearchParams } from "next/navigation";
import ArrowUpRight01Icon from "@hugeicons/core-free-icons/ArrowUpRight01Icon";
import { bookingsReport, lastWebhookEvent, webhookSecret } from "@/lib/booking";
import { getSettings } from "@/lib/content";
import { env, useDatabase } from "@/lib/db";
import { saveSettings } from "../actions";
import { Icon } from "../Icon";
import { StickySave } from "../StickySave";
import { Card, Field, PageHead, TextArea, adminStyles as s } from "../ui";
import { BookingsTable } from "./BookingsTable";
import { Copy } from "./Copy";
import { LocalTime } from "./LocalTime";
import own from "./bookings.module.css";

const TABS = ["all", "upcoming", "past", "cancelled"] as const;

const pct = (a: number, b: number) => (b ? Math.round((Math.min(a, b) / b) * 100) : null);

/** Every intro call booked, as a table, and the booking window's text. */
export default function BookingsAdmin() {
  useDatabase();
  const params = useSearchParams();
  const show = params.get("show") ?? undefined;
  const open = params.get("open") ?? undefined;
  const tab = (TABS as readonly string[]).includes(show ?? "") ? (show as (typeof TABS)[number]) : "all";
  const [report, v, secret, last, e] = [
    bookingsReport(),
    getSettings(),
    webhookSecret(),
    lastWebhookEvent(),
    env(),
  ] as const;
  const { rows, kpi, now } = report;

  const host = e.CANONICAL_HOST || "your-site";
  const hookUrl = `https://${host}/api/cal/webhook`;
  const opened = kpi?.opened ?? 0;
  const picked = kpi?.picked ?? 0;
  const booked = kpi?.booked ?? 0;
  const upcoming = rows.filter((b) => b.status === "booked" && b.start_time && b.start_time >= now).length;

  const ofOpened = pct(picked, opened);
  const ofPicked = pct(booked, picked);
  const funnel: { label: string; value: number; hint: string; share: number | null }[] = [
    { label: "Opened the window", value: opened, hint: "visits, last 30 days", share: null },
    { label: "Picked a time", value: picked, hint: ofOpened === null ? "of those who opened it" : `${ofOpened}% of those who opened it`, share: ofOpened },
    { label: "Booked", value: booked, hint: ofPicked === null ? "of those who picked a time" : `${ofPicked}% of those who picked a time`, share: ofPicked },
    { label: "Upcoming calls", value: upcoming, hint: "booked and still ahead", share: null },
  ];

  return (
    <>
      <PageHead
        title="Bookings"
        note="Every Intro Call button opens the booking window, unless Text & labels gives it another link. Calls booked there, or on Cal.com, show up here."
      >
        <a className={s.btn} href={AUTHOR_URL} target="_blank" rel="noreferrer" title="The booking window opens from Intro Call on the live site">
          <Icon icon={ArrowUpRight01Icon} size={16} />
          See it on the live site
        </a>
      </PageHead>

      <div className={`${own.funnel} ${s.frame}`}>
        {funnel.map((f) => (
          <div key={f.label} className={own.step}>
            <span className={own.stepLabel}>{f.label}</span>
            <span className={own.stepValue}>{f.value}</span>
            <span className={own.stepHint}>{f.hint}</span>
            {f.share !== null && (
              <span className={own.share} aria-hidden>
                <span style={{ width: `${Math.max(f.share, 2)}%` }} />
              </span>
            )}
          </div>
        ))}
      </div>

      <BookingsTable rows={rows} now={now} initialTab={tab} initialOpen={open ?? null} />

      <Card
        title="Connect Cal.com"
        note="Reschedules, cancellations and calls booked on Cal.com itself reach this table through its webhook."
        actions={
          <span className={own.link} data-on={last ? true : undefined}>
            <i aria-hidden />
            {last ? "Connected" : "Not connected yet"}
          </span>
        }
      >
        <ol className={own.steps}>
          <li>
            In Cal.com open <strong>Settings › Developer › Webhooks</strong> and choose <strong>New</strong>.
          </li>
          <li>
            Subscriber URL:
            <Copy value={hookUrl} />
          </li>
          <li>
            Secret:
            <Copy value={secret} secret />
          </li>
          <li>
            Event triggers: <strong>Booking created</strong>, <strong>Booking rescheduled</strong> and{" "}
            <strong>Booking cancelled</strong>. Save, then use <strong>Ping test</strong>.
          </li>
        </ol>
        <p className={own.state}>
          {last ? (
            <>
              <strong>Connected.</strong> Last event: {last.trigger.replace(/_/g, " ").toLowerCase()}, <LocalTime start={last.at} />.
            </>
          ) : (
            "Nothing received from Cal.com yet. Calls booked on this site appear above without it; the webhook adds reschedules, cancellations and bookings made on Cal.com itself."
          )}
        </p>
      </Card>

      <form action={saveSettings}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Booking window: left column">
            <Field
              label="Cal.com event"
              name="booking.calLink"
              defaultValue={v["booking.calLink"]}
              placeholder="jubayer910/30min"
              hint="Your Cal.com username and event, or the event's full link. Free times and bookings go through it."
            />
            <div style={{ height: 14 }} />
            <div className={s.grid2}>
              <Field label="Window title" name="booking.title" defaultValue={v["booking.title"]} placeholder="Book an intro call" />
              <Field label="Call name" name="booking.eventTitle" defaultValue={v["booking.eventTitle"]} placeholder="30 min intro call" />
            </div>
            <div style={{ height: 14 }} />
            <div className={s.grid2}>
              <TextArea
                label="Facts"
                name="booking.facts"
                defaultValue={v["booking.facts"]}
                rows={3}
                hint="One per line: the first gets a clock, the second a camera. The visitor's time zone is added by itself."
              />
              <TextArea label="Small print" name="booking.footnote" defaultValue={v["booking.footnote"]} rows={3} hint="At the foot of the column" />
            </div>
            <div style={{ height: 14 }} />
            <div className={s.grid2}>
              <Field label="List heading" name="booking.agendaLabel" defaultValue={v["booking.agendaLabel"]} placeholder="What we'll cover" />
              <TextArea label="List" name="booking.agenda" defaultValue={v["booking.agenda"]} rows={4} hint="One point per line" />
            </div>
          </Card>

          <Card title="Booking window: step 2 and confirmation">
            <TextArea
              label="What people can pick"
              name="booking.needs"
              defaultValue={v["booking.needs"]}
              rows={6}
              hint="One per line. The plan choices are the pricing plans."
            />
            <div style={{ height: 14 }} />
            <div className={s.grid2}>
              <Field label="Confirmation heading" name="booking.successTitle" defaultValue={v["booking.successTitle"]} hint="Followed by their first name" />
              <TextArea label="Confirmation text" name="booking.successText" defaultValue={v["booking.successText"]} rows={2} />
            </div>
          </Card>
        </div>
        <StickySave label="Save text" />
      </form>
    </>
  );
}
