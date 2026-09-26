import type { BrandIcon } from "./types";

/* Call-to-action helpers shared by the server (rendering the buttons) and the
   browser (tracking the clicks). No server-only imports in here. */

export type Cta = { label: string; href?: string; icon: BrandIcon };

/** Where a button sends people - what the analytics and the pixels report. */
export type CtaTarget =
  | "booking"
  | "whatsapp"
  | "telegram"
  | "meeting"
  | "email"
  | "phone"
  | "link";

export type MessageIcon = "whatsapp" | "telegram";

export function messageIcon(v: string | null | undefined): MessageIcon {
  return v === "telegram" ? "telegram" : "whatsapp";
}

export function brandIcon(
  v: string | null | undefined,
  fallback: BrandIcon = "googleMeet",
): BrandIcon {
  return v === "googleMeet" || v === "whatsapp" || v === "telegram" || v === "none"
    ? v
    : fallback;
}

/** Where Intro Call goes unless /admin gives it another link. */
export const BOOKING_PATH = "/book";

/**
 * The Message and Intro Call buttons in the sidebar and on /work. They are
 * also the fallback for any pricing card that has no link of its own.
 */
export function siteCtas(s: Record<string, string>): { message: Cta; call: Cta } {
  return {
    message: {
      label: s["cta.messageLabel"] || "Message",
      href: s["cta.messageHref"] || undefined,
      icon: messageIcon(s["cta.messageIcon"]),
    },
    call: {
      label: s["cta.callLabel"] || "Intro Call",
      href: s["cta.callHref"] || BOOKING_PATH,
      icon: "googleMeet",
    },
  };
}

/** Read the destination off the link itself; the icon is only a tie-breaker. */
export function ctaTarget(
  href: string | null | undefined,
  icon?: string | null,
): CtaTarget {
  const h = (href ?? "").toLowerCase();
  // the site's own booking page, relative or absolute
  if (/^(https?:\/\/[^/]+)?\/book(?=[/?#]|$)/.test(h)) return "booking";
  if (h.startsWith("mailto:")) return "email";
  if (h.startsWith("tel:")) return "phone";
  if (/(^|[/.])wa\.me\b|whatsapp\.com/.test(h)) return "whatsapp";
  if (/(^|[/.])t\.me\b|telegram\.(me|org|dog)/.test(h)) return "telegram";
  if (
    /cal\.com|cal\.id|calendly\.com|meet\.google|zoom\.us|savvycal|tidycal|zcal\.co|youcanbook\.me|koalendar|hubspot\.com\/meetings|calendar\.app\.google/.test(
      h,
    )
  ) {
    return "meeting";
  }
  if (icon === "whatsapp" || icon === "telegram") return icon;
  if (icon === "googleMeet") return "meeting";
  return "link";
}

/* Pixel ids are pasted in /admin and end up inside an inline <script>, so
   anything that is not exactly the expected shape is dropped. */

export function metaPixelId(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return /^\d{5,20}$/.test(s) ? s : null;
}

export function ga4Id(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toUpperCase();
  return /^G-[A-Z0-9]{4,15}$/.test(s) ? s : null;
}
