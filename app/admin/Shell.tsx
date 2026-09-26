"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import ArrowUpRight01Icon from "@hugeicons/core-free-icons/ArrowUpRight01Icon";
import GithubIcon from "@hugeicons/core-free-icons/GithubIcon";
import Refresh01Icon from "@hugeicons/core-free-icons/Refresh01Icon";
import { getSettings, mediaSrc } from "@/lib/content";
import { loadDatabase, useDatabase, useDatabaseReady } from "@/lib/db";
import { siteName } from "@/lib/seo";
import { AdminNav, Crumbs, MenuButton, MenuScrim } from "./AdminNav";
import { AUTHOR_URL, REPO_URL } from "./demo";
import { Icon } from "./Icon";
import { Toaster } from "./Modal";
import type { Theme } from "./prefs";
import { SidebarToggle } from "./SidebarToggle";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./admin.module.css";

/**
 * The admin shell: a light grey sidebar (who you are with the collapse switch
 * at its right, the pages with their icons) beside the work area, whose top
 * bar carries the breadcrumb and the icon buttons: light/dark, start the demo
 * over, the code on GitHub and the author's site. The site's engraved
 * hairline separates the parts.
 *
 * Nothing is drawn until the demo's database has loaded (a moment, the first
 * time); until then the page shows the line-art frame with a short note.
 */
export function Shell({ theme, collapsed, children }: { theme: Theme; collapsed: boolean; children: React.ReactNode }) {
  const ready = useDatabaseReady();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    loadDatabase().catch((e: unknown) => setFailed(e instanceof Error ? e.message : "The demo could not start."));
  }, []);

  if (!ready) {
    return (
      <div className={styles.login} data-admin-app data-theme={theme}>
        <div className={styles.loginCard} role="status" aria-live="polite">
          <h1 className={styles.loginTitle}>{failed ? "The demo could not start" : "Opening the admin"}</h1>
          <p className={styles.loginNote} style={{ margin: 0 }}>
            {failed ?? "Loading the demo's data into your browser. Nothing you change here leaves it."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <App theme={theme} collapsed={collapsed}>
      {children}
    </App>
  );
}

function App({ theme, collapsed, children }: { theme: Theme; collapsed: boolean; children: React.ReactNode }) {
  useDatabase();
  const settings = getSettings();
  const avatar = mediaSrc(settings["brand.avatar"]);
  const name = siteName(settings);

  return (
    <div className={styles.app} data-admin-app data-theme={theme} data-collapsed={collapsed || undefined}>
      <aside className={styles.side}>
        <div className={styles.sideHead}>
          <Link href="/admin" className={styles.brand} data-tip={name}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- a small avatar, already sized
              <img className={styles.brandAvatar} src={avatar} alt="" width={32} height={32} />
            ) : (
              <span className={styles.brandAvatar} />
            )}
            <span className={`${styles.brandText} ${styles.sideLabel}`}>
              <strong>{name}</strong>
              <span>Admin · demo</span>
            </span>
          </Link>
          <SidebarToggle initial={collapsed} />
        </div>

        <AdminNav />

        {/* the sidebar's floor: the footer's cross-hatch */}
        <div className={styles.sideFoot} aria-hidden />
      </aside>
      <MenuScrim />

      <div className={styles.work}>
        <header className={styles.topbar}>
          <MenuButton />
          <Crumbs />
          <span className={styles.demoTag} title="Made-up data. Your changes stay in this browser and are gone after a refresh.">
            Demo data
          </span>
          <div className={styles.topActions}>
            <ThemeToggle initial={theme} />
            <button
              type="button"
              className={styles.topIcon}
              onClick={() => location.reload()}
              aria-label="Start the demo over"
              title="Start over (undo every change)"
            >
              <Icon icon={Refresh01Icon} size={18} />
            </button>
            <a className={styles.topIcon} href={REPO_URL} target="_blank" rel="noreferrer" aria-label="The code on GitHub" title="Code on GitHub">
              <Icon icon={GithubIcon} size={18} />
            </a>
            <a className={styles.topIcon} href={AUTHOR_URL} target="_blank" rel="noreferrer" aria-label="Maniruzzaman Jubayer's site" title="Made by Maniruzzaman Jubayer">
              <Icon icon={ArrowUpRight01Icon} size={18} />
            </a>
          </div>
        </header>

        <main className={styles.main}>
          <Suspense>{children}</Suspense>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
