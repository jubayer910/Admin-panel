"use client";

import { useState } from "react";
import styles from "./admin.module.css";
import { SIDE_COOKIE } from "./prefs";

/**
 * Collapses the sidebar to its icons and back; it sits at the right of the
 * profile at the top, and under the avatar once collapsed. The drawing is
 * Hugeicons' sidebar-left (the frame, the panel line, the two menu ticks, the chevron),
 * taken apart so it can move: the panel line slides, the ticks fold away,
 * the chevron swings round, each on a slight spring. The choice is kept in a
 * cookie, so the server draws the right width and nothing jumps on load.
 */
export function SidebarToggle({ initial }: { initial: boolean }) {
  const [collapsed, setCollapsed] = useState(initial);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.querySelector("[data-admin-app]")?.toggleAttribute("data-collapsed", next);
    document.cookie = `${SIDE_COOKIE}=${next ? "collapsed" : "open"}; path=/admin; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      className={styles.sideToggle}
      onClick={toggle}
      aria-pressed={collapsed}
      aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
      data-tip={collapsed ? "Expand" : undefined}
      title={collapsed ? undefined : "Collapse"}
    >
      <svg className={styles.toggleIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M2 12C2 8.25027 2 6.3754 2.95491 5.06107C3.26331 4.6366 3.6366 4.26331 4.06107 3.95491C5.3754 3 7.25027 3 11 3H13C16.7497 3 18.6246 3 19.9389 3.95491C20.3634 4.26331 20.7367 4.6366 21.0451 5.06107C22 6.3754 22 8.25027 22 12C22 15.7497 22 17.6246 21.0451 18.9389C20.7367 19.3634 20.3634 19.7367 19.9389 20.0451C18.6246 21 16.7497 21 13 21H11C7.25027 21 5.3754 21 4.06107 20.0451C3.6366 19.7367 3.26331 19.3634 2.95491 18.9389C2 17.6246 2 15.7497 2 12Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <rect className={styles.togglePanel} x="2.75" y="3.75" width="6.75" height="16.5" rx="2" fill="currentColor" />
        <path className={styles.toggleLine} d="M9.5 3.5L9.5 20.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <g className={styles.toggleTicks}>
          <path d="M5 7H6.5M5 11H6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        <path
          className={styles.toggleChevron}
          d="M17 10L15.7735 11.0572C15.2578 11.5016 15 11.7239 15 12C15 12.2761 15.2578 12.4984 15.7735 12.9428L17 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
