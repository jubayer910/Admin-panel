"use client";

import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import ArrowUpDownIcon from "@hugeicons/core-free-icons/ArrowUpDownIcon";
import ArrowUpRight01Icon from "@hugeicons/core-free-icons/ArrowUpRight01Icon";
import Copy01Icon from "@hugeicons/core-free-icons/Copy01Icon";
import GridViewIcon from "@hugeicons/core-free-icons/GridViewIcon";
import LayoutTable01Icon from "@hugeicons/core-free-icons/LayoutTable01Icon";
import PlayIcon from "@hugeicons/core-free-icons/PlayIcon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import { useState, useSyncExternalStore } from "react";
import { deleteMedia } from "../actions";
import { DeleteButton } from "../FormButtons";
import { Icon } from "../Icon";
import { toast } from "../Modal";
import admin from "../admin.module.css";
import t from "../table.module.css";
import styles from "./media.module.css";

export type MediaItem = {
  id: string;
  key: string;
  url: string | null;
  thumb: string | null;
  filename: string;
  kind: "image" | "gif" | "svg" | "video" | "other";
  meta: string;
  type: string;
  dims: string | null;
  size: string;
  bytes: number;
  /** unix ms */
  added: number;
  /** "-76%" when conversion made it smaller */
  saved: string | null;
  optimized: boolean;
};

const KINDS: { key: MediaItem["kind"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "gif", label: "GIFs" },
  { key: "video", label: "Videos" },
  { key: "svg", label: "SVG" },
];

type View = "grid" | "table";
type SortKey = "name" | "type" | "size" | "added";

/* the grid/table choice, kept per browser */
const VIEW_KEY = "mx_admin_media_view";
function subscribeView(cb: () => void) {
  addEventListener("storage", cb);
  addEventListener("mx-media-view", cb);
  return () => {
    removeEventListener("storage", cb);
    removeEventListener("mx-media-view", cb);
  };
}
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "grid";
  } catch {
    return "grid";
  }
}
function writeView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  dispatchEvent(new Event("mx-media-view"));
}

const noop = () => () => {};

/**
 * The media library, as a ruled grid of files or a table: filter by kind,
 * search by name, sort the table by its heads, open a file, copy its link,
 * or delete it (two clicks). Uploading is the header button.
 */
export function MediaBrowser({ items }: { items: MediaItem[] }) {
  const view = useSyncExternalStore(subscribeView, readView, () => "grid" as View);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "added", dir: "desc" });
  const query = q.trim().toLowerCase();
  const shown = items.filter((m) => (kind === "all" || m.kind === kind) && (!query || m.filename.toLowerCase().includes(query) || m.key.includes(query)));

  const sorted =
    view === "table"
      ? [...shown].sort((a, b) => {
          const d = sort.dir === "asc" ? 1 : -1;
          const k = (m: MediaItem) => (sort.key === "name" ? m.filename.toLowerCase() : sort.key === "type" ? m.type : sort.key === "size" ? m.bytes : m.added);
          const ka = k(a);
          const kb = k(b);
          return (ka < kb ? -1 : ka > kb ? 1 : 0) * d;
        })
      : shown;

  const sortBy = (key: SortKey) =>
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "type" ? "asc" : "desc" }));

  const head = (key: SortKey, label: string, num = false) => {
    const on = sort.key === key;
    return (
      <th className={num ? admin.num : undefined} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
        <button type="button" className={t.sort} data-on={on || undefined} onClick={() => sortBy(key)}>
          {label}
          <Icon icon={on ? (sort.dir === "asc" ? ArrowUp01Icon : ArrowDown01Icon) : ArrowUpDownIcon} size={13} />
        </button>
      </th>
    );
  };

  return (
    <div className={`${t.board} ${admin.frame}`}>
      <div className={t.bar}>
        <div className={t.tabs} role="group" aria-label="Show">
          {KINDS.map((k) => {
            const n = k.key === "all" ? items.length : items.filter((m) => m.kind === k.key).length;
            if (k.key !== "all" && !n) return null;
            return (
              <button key={k.key} type="button" className={t.tab} aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
                {k.label}
                <span className={t.tabCount}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className={t.tools}>
          <label className={t.search}>
            <Icon icon={Search01Icon} size={16} />
            <input type="search" placeholder="Search files" aria-label="Search files" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className={styles.views} role="group" aria-label="View">
            <button type="button" aria-pressed={view === "grid"} onClick={() => writeView("grid")} title="Grid view">
              <Icon icon={GridViewIcon} size={15} />
              <span>Grid</span>
            </button>
            <button type="button" aria-pressed={view === "table"} onClick={() => writeView("table")} title="Table view">
              <Icon icon={LayoutTable01Icon} size={15} />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className={styles.none}>{items.length ? "No files match." : "Nothing uploaded yet."}</p>
      ) : view === "grid" ? (
        <div className={styles.grid}>
          {sorted.map((m) => (
            <article key={m.id} className={styles.card}>
              <div className={styles.preview}>
                <Preview m={m} />
                {m.saved && <span className={styles.saved}>{m.saved}</span>}
              </div>
              <div className={styles.info}>
                <p className={styles.name} title={m.filename}>
                  {m.filename}
                </p>
                <p className={styles.meta}>
                  {m.meta}
                  {!m.optimized && <span className={styles.warn}> · not optimised</span>}
                </p>
              </div>
              <Actions m={m} />
            </article>
          ))}
        </div>
      ) : (
        <div className={t.scroll}>
          <table className={t.table}>
            <thead>
              <tr>
                <th className={styles.thumbCol} aria-label="Preview" />
                {head("name", "File")}
                {head("type", "Type")}
                <th>Dimensions</th>
                {head("size", "Size", true)}
                <th className={admin.num}>Saved</th>
                {head("added", "Added")}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id}>
                  <td className={styles.thumbCol}>
                    <span className={styles.mini}>
                      <Preview m={m} small />
                    </span>
                  </td>
                  <td>
                    <span className={styles.file}>
                      <strong title={m.filename}>{m.filename}</strong>
                      {!m.optimized && <span className={styles.warn}>Not optimised</span>}
                    </span>
                  </td>
                  <td className={styles.cellSoft}>{m.type}</td>
                  <td className={styles.cellSoft}>{m.dims ?? <span className={admin.muted}>-</span>}</td>
                  <td className={admin.num}>{m.size}</td>
                  <td className={admin.num}>{m.saved ? <span className={styles.savedText}>{m.saved}</span> : <span className={admin.muted}>-</span>}</td>
                  <td className={styles.cellSoft} style={{ whiteSpace: "nowrap" }}>
                    {m.added ? (mounted ? new Date(m.added).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : new Date(m.added).toISOString().slice(0, 10)) : "-"}
                  </td>
                  <td style={{ width: "1%" }}>
                    <Actions m={m} inline />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Preview({ m, small = false }: { m: MediaItem; small?: boolean }) {
  if (m.kind === "video" && m.url) {
    return (
      <>
        <video src={m.url} muted playsInline preload="metadata" />
        {!small && (
          <span className={styles.play} aria-hidden>
            <Icon icon={PlayIcon} size={14} />
          </span>
        )}
      </>
    );
  }
  if (m.thumb) {
    // eslint-disable-next-line @next/next/no-img-element -- a resized copy; GIFs must keep animating
    return <img src={m.thumb} alt="" loading="lazy" decoding="async" />;
  }
  return <span className={styles.noPreview}>{small ? "-" : "No preview"}</span>;
}

function Actions({ m, inline = false }: { m: MediaItem; inline?: boolean }) {
  return (
    <div className={inline ? styles.inlineActions : styles.actions}>
      {m.url && (
        <a className={styles.iconBtn} href={m.url} target="_blank" rel="noreferrer" title="Open" aria-label={`Open ${m.filename}`}>
          <Icon icon={ArrowUpRight01Icon} size={16} />
        </a>
      )}
      {m.url && (
        <button
          type="button"
          className={styles.iconBtn}
          title="Copy link"
          aria-label={`Copy the link to ${m.filename}`}
          onClick={async () => {
            await navigator.clipboard.writeText(new URL(m.url!, location.href).href);
            toast("Link copied");
          }}
        >
          <Icon icon={Copy01Icon} size={16} />
        </button>
      )}
      <form action={deleteMedia} className={styles.deleteForm}>
        <input type="hidden" name="key" value={m.key} />
        <DeleteButton action={deleteMedia} />
      </form>
    </div>
  );
}
