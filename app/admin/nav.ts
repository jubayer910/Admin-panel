import type { IconSvgElement } from "@hugeicons/react";
import Album02Icon from "@hugeicons/core-free-icons/Album02Icon";
import Analytics01Icon from "@hugeicons/core-free-icons/Analytics01Icon";
import Building06Icon from "@hugeicons/core-free-icons/Building06Icon";
import Calendar03Icon from "@hugeicons/core-free-icons/Calendar03Icon";
import DashboardSquare01Icon from "@hugeicons/core-free-icons/DashboardSquare01Icon";
import DollarSquareIcon from "@hugeicons/core-free-icons/DollarSquareIcon";
import Folder01Icon from "@hugeicons/core-free-icons/Folder01Icon";
import HelpCircleIcon from "@hugeicons/core-free-icons/HelpCircleIcon";
import Image01Icon from "@hugeicons/core-free-icons/Image01Icon";
import QuoteDownIcon from "@hugeicons/core-free-icons/QuoteDownIcon";
import Tag01Icon from "@hugeicons/core-free-icons/Tag01Icon";
import TextFontIcon from "@hugeicons/core-free-icons/TextFontIcon";
import UserCircleIcon from "@hugeicons/core-free-icons/UserCircleIcon";

/* Every admin page, in the order the sidebar lists them. The breadcrumb and
   the overview read the same list, so a page is named the same everywhere. */

export type NavItem = { href: string; label: string; icon: IconSvgElement; note: string };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Site",
    items: [
      { href: "/admin", label: "Overview", icon: DashboardSquare01Icon, note: "Today at a glance" },
      { href: "/admin/analytics", label: "Analytics", icon: Analytics01Icon, note: "Visitors, sources and clicks" },
      { href: "/admin/bookings", label: "Bookings", icon: Calendar03Icon, note: "Intro calls and the booking window" },
      { href: "/admin/settings", label: "Text & labels", icon: TextFontIcon, note: "Headline, buttons, footer and SEO" },
      { href: "/admin/clients", label: "Client logos", icon: Building06Icon, note: "Two rows in the sidebar" },
      { href: "/admin/photos", label: "Photos", icon: Image01Icon, note: "The photo row and the About gallery" },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/admin/works", label: "Projects", icon: Folder01Icon, note: "The work grid, in site order" },
      { href: "/admin/categories", label: "Categories", icon: Tag01Icon, note: "Filter tabs on /work" },
    ],
  },
  {
    label: "Page content",
    items: [
      { href: "/admin/about", label: "About page", icon: UserCircleIcon, note: "Story, experience and awards" },
      { href: "/admin/plans", label: "Pricing plans", icon: DollarSquareIcon, note: "The three offer cards" },
      { href: "/admin/testimonials", label: "Testimonials", icon: QuoteDownIcon, note: "Client recommendations" },
      { href: "/admin/faqs", label: "FAQs", icon: HelpCircleIcon, note: "The accordion on the homepage" },
    ],
  },
  {
    label: "Files",
    items: [{ href: "/admin/media", label: "Media library", icon: Album02Icon, note: "Everything uploaded" }],
  },
];

/** The nav entry a path belongs to (the longest matching href). */
export function navFor(pathname: string): { group: NavGroup; item: NavItem } | null {
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of NAV) {
    for (const item of group.items) {
      const hit = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (hit && (!best || item.href.length > best.item.href.length)) best = { group, item };
    }
  }
  return best;
}
