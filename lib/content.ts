import { BOOKING_PATH, brandIcon, siteCtas } from "./cta";
import { all, env, mediaUrl } from "./db";
import type { Plan } from "./types";

/* Read side: the settings and the pricing plans, as the admin reads them. */

export type Settings = Record<string, string>;

function base(): string | undefined {
  return env().MEDIA_BASE_URL || undefined;
}

export function getSettings(): Settings {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** A media field's value - a stored key or a full URL - as a URL the page can use. */
export function mediaSrc(ref: string | null | undefined): string | null {
  return mediaUrl(ref, base());
}

export function getPlans(): Plan[] {
  const rows = all<{
    id: string;
    name: string;
    blurb: string;
    badge: string | null;
    monthly_price: number | null;
    trial_label: string | null;
    trial_price: number | null;
    trial_discount: number;
    cta_label: string;
    cta_href: string | null;
    cta_icon: string | null;
    icon: string | null;
  }>("SELECT * FROM plans ORDER BY position");

  const features = all<{ plan_id: string; text: string }>(
    "SELECT plan_id, text FROM plan_features ORDER BY plan_id, position",
  );
  const settings = getSettings();
  const b = base();
  const site = siteCtas(settings);

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    blurb: p.blurb,
    badge: p.badge ?? undefined,
    icon: mediaUrl(p.icon, b) ?? undefined,
    monthlyPrice: p.monthly_price ?? undefined,
    trial:
      p.trial_label && p.trial_price !== null
        ? {
            label: p.trial_label,
            price: p.trial_price,
            discount: p.trial_discount,
          }
        : undefined,
    features: features.filter((f) => f.plan_id === p.id).map((f) => f.text),
    cta: planCta(p.id, p.cta_label, p.cta_href, p.cta_icon, site),
  }));
}

/**
 * A card with no link of its own borrows the site-wide one that matches its
 * icon: a messaging icon takes the Message link, anything else Intro Call.
 * On the site's booking page the plan comes along, so it is pre-selected.
 */
function planCta(
  id: string,
  label: string,
  href: string | null,
  icon: string | null,
  site: ReturnType<typeof siteCtas>,
): Plan["cta"] {
  const i = brandIcon(icon);
  const fallback =
    i === "whatsapp" || i === "telegram" ? site.message.href : site.call.href;
  const to = href || fallback;
  const withPlan = to?.startsWith(BOOKING_PATH) && !to.includes("?") ? `${to}?plan=${encodeURIComponent(id)}` : to;
  return { label: label || site.call.label, href: withPlan, icon: i };
}

