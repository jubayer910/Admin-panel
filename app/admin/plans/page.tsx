"use client";

import { all, useDatabase } from "@/lib/db";
import { deletePlan, savePlan } from "../actions";
import { Item, More, SortableRows } from "../List";
import { FormModal } from "../Modal";
import { MediaField } from "../MediaField";
import { Actions, DeleteButton, Field, PageHead, SaveButton, Select, TextArea, adminStyles as s } from "../ui";

type Row = {
  id: string; name: string; blurb: string; badge: string | null;
  monthly_price: number | null; trial_label: string | null;
  trial_price: number | null; trial_discount: number;
  cta_label: string; cta_href: string | null; cta_icon: string | null;
  icon: string | null; position: number;
};

const ICONS = [
  { value: "googleMeet", label: "Google Meet (booking a call)" },
  { value: "whatsapp", label: "WhatsApp (sending a message)" },
  { value: "telegram", label: "Telegram (sending a message)" },
  { value: "none", label: "No icon" },
];

export default function PlansPage() {
  useDatabase();
  const [plans, features] = [
    all<Row>("SELECT * FROM plans ORDER BY position"),
    all<{ plan_id: string; text: string }>(
      "SELECT plan_id, text FROM plan_features ORDER BY plan_id, position"),
  ] as const;

  const featureText = (id: string) =>
    features.filter((f) => f.plan_id === id).map((f) => f.text).join("\n");

  const form = (p?: Row) => (
    <form action={savePlan}>
      {p && <input type="hidden" name="id" value={p.id} />}

      <MediaField label="Icon" name="icon" defaultValue={p?.icon} shape="square" max={96}
                  accept="image/gif,image/png,image/webp,image/svg+xml"
                  hint="The animated icon above the name, 48 × 48 on the page. A GIF stays a GIF, scaled to 96px" />
      <div style={{ height: 14 }} />
      <Field label="Plan name" name="name" defaultValue={p?.name} required />
      <div style={{ height: 14 }} />
      <TextArea label="Short description" name="blurb" defaultValue={p?.blurb} rows={2} />
      <div style={{ height: 14 }} />
      <Field label="Monthly price" name="monthly_price" type="number"
             defaultValue={p?.monthly_price}
             hint="Leave empty for an enquiry-only plan like Custom" />
      <div style={{ height: 14 }} />
      <TextArea label="What's included" name="features"
                defaultValue={p ? featureText(p.id) : ""} rows={8}
                hint="One item per line" />

      <More label="Trial toggle">
        <div className={s.grid2}>
          <Field label="Trial label" name="trial_label" defaultValue={p?.trial_label}
                 placeholder="Try 1 week ( 12 hr )" />
          <Field label="Trial price" name="trial_price" type="number" defaultValue={p?.trial_price} />
          <Field label="Discount when switched on" name="trial_discount" type="number"
                 defaultValue={p?.trial_discount ?? 50}
                 hint="Taken off the trial price" />
        </div>
      </More>

      <div style={{ height: 18 }} />
      <p className={s.label} style={{ margin: "0 0 10px" }}>Button</p>
      <div className={s.grid2}>
        <Field label="Button text" name="cta_label" defaultValue={p?.cta_label ?? "Intro Call"} />
        <Select label="Icon" name="cta_icon" defaultValue={p?.cta_icon ?? "googleMeet"} options={ICONS}
                hint="Also decides how the click is reported: booking or message" />
        <Field label="Button link" name="cta_href" defaultValue={p?.cta_href}
               placeholder="https://cal.com/… or https://wa.me/…"
               hint="Empty uses the site-wide link from Text & labels › Buttons: the Message link for WhatsApp/Telegram, the Intro Call link otherwise" />
      </div>

      <More label="Badge">
        <Field label="Badge" name="badge" defaultValue={p?.badge} placeholder="Best Value" />
      </More>

      <Actions>
        <SaveButton label={p ? "Save" : "Add plan"} />
        {p && <DeleteButton action={deletePlan} id={p.id} />}
      </Actions>
    </form>
  );

  return (
    <>
      <PageHead title="Pricing plans"
        note="Switching the trial toggle on a card shows the trial price minus the discount.">
        <FormModal label="Add plan" title="Add a plan" done="Plan added">
          {form()}
        </FormModal>
      </PageHead>
      {plans.length === 0 ? <p className={s.empty}>No plans yet.</p> : (
        <SortableRows table="plans" ids={plans.map((p) => p.id)} label="plans">
          {plans.map((p) => (
            <Item key={p.id} table="plans" id={p.id} title={p.name}
                  meta={[
                    p.monthly_price !== null ? `$${p.monthly_price}/mo` : "Enquiry only",
                    p.badge,
                    `${features.filter(f => f.plan_id === p.id).length} features`,
                    `button: ${p.cta_label}${p.cta_href ? "" : " (site-wide link)"}`,
                  ].filter(Boolean).join(" · ")}>
              {form(p)}
            </Item>
          ))}
        </SortableRows>
      )}
    </>
  );
}
