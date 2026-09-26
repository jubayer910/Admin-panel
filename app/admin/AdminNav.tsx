"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { NAV, navFor } from "./nav";
import styles from "./admin.module.css";

/**
 * The sidebar's pages, grouped, each with its Hugeicons icon. Collapsed, the
 * labels hide and show as a tooltip on hover or focus instead. On a phone
 * the sidebar is a drawer; following a link closes it.
 */
export function AdminNav() {
  const pathname = usePathname();
  const current = navFor(pathname)?.item.href;

  return (
    <nav className={styles.nav} aria-label="Admin">
      {NAV.map((g) => (
        <div key={g.label} className={styles.navSection}>
          <p className={styles.navGroup}>{g.label}</p>
          {g.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navLink}
              data-active={item.href === current || undefined}
              aria-current={item.href === current ? "page" : undefined}
              data-tip={item.label}
              onClick={() => document.querySelector("[data-admin-app]")?.removeAttribute("data-menu-open")}
            >
              <Icon icon={item.icon} size={18} className={styles.navIcon} />
              <span className={styles.sideLabel}>{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

/** "Site / Projects" at the top of the page, from the same list. */
export function Crumbs() {
  const hit = navFor(usePathname());
  if (!hit) return null;
  return (
    <p className={styles.crumbs}>
      <span>{hit.group.label}</span>
      <span aria-hidden>/</span>
      <strong>{hit.item.label}</strong>
    </p>
  );
}

/** The phone's menu button: opens the sidebar as a drawer. */
export function MenuButton() {
  return (
    <button
      type="button"
      className={`${styles.iconBtn} ${styles.menuBtn}`}
      aria-label="Open the menu"
      onClick={() => document.querySelector("[data-admin-app]")?.setAttribute("data-menu-open", "")}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 5L20 5M4 12L20 12M4 19L20 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** The dimmed page behind the phone drawer; a tap closes it. */
export function MenuScrim() {
  return (
    <div
      className={styles.scrim}
      aria-hidden
      onClick={() => document.querySelector("[data-admin-app]")?.removeAttribute("data-menu-open")}
    />
  );
}
