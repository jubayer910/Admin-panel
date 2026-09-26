"use client";

import { useState, useSyncExternalStore } from "react";
import styles from "./admin.module.css";
import { THEME_COOKIE, type Theme } from "./prefs";

const QUERY = "(prefers-color-scheme: dark)";
function subscribe(cb: () => void) {
  const mq = matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Light or dark. Until it is used the admin follows the system; the choice
 * is kept in a cookie, so the server draws the right theme and nothing
 * flashes. The drawing is Hugeicons' sun and moon, one turning into the
 * other: the rays spin away as the moon swings in.
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const systemDark = useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches, () => false);
  const dark = theme === "dark" || (theme === "system" && systemDark);

  function toggle() {
    const next = dark ? "light" : "dark";
    setTheme(next);
    document.querySelectorAll("[data-admin-app]").forEach((el) => el.setAttribute("data-theme", next));
    document.cookie = `${THEME_COOKIE}=${next}; path=/admin; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      className={styles.themeToggle}
      data-dark={dark || undefined}
      onClick={toggle}
      aria-label={dark ? "Switch to the light theme" : "Switch to the dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <g className={styles.themeSun}>
          <path d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z" stroke="currentColor" strokeWidth="1.5" />
          <path
            className={styles.themeRays}
            d="M12 2V3.5M12 20.5V22M19.0708 19.0713L18.0101 18.0106M5.98926 5.98926L4.9286 4.9286M22 12H20.5M3.5 12H2M19.0713 4.92871L18.0106 5.98937M5.98975 18.0107L4.92909 19.0714"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </g>
        <path
          className={styles.themeMoon}
          d="M21.5 14.0784C20.3003 14.7189 18.9301 15.0821 17.4751 15.0821C12.7491 15.0821 8.91792 11.2509 8.91792 6.52485C8.91792 5.06986 9.28105 3.69968 9.92163 2.5C5.66765 3.49698 2.5 7.31513 2.5 11.8731C2.5 17.1899 6.8101 21.5 12.1269 21.5C16.6849 21.5 20.503 18.3324 21.5 14.0784Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </button>
  );
}
