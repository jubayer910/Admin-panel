"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PencilEdit02Icon from "@hugeicons/core-free-icons/PencilEdit02Icon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { reorderWorks, setWorkOnHomepage } from "../actions";
import { Icon } from "../Icon";
import { Modal, toast, useCloseOnSave } from "../Modal";
import admin from "../admin.module.css";
import t from "../table.module.css";
import styles from "./works.module.css";

/**
 * /admin/works: every project as a list or a grid, in site order.
 *
 *   drag      the handle (or focus it: Space, arrows, Space) moves a project;
 *             the new order is saved at once, and is the order on /work and,
 *             for the ticked ones, on the homepage
 *   filter    by category or "On homepage", or search by name; a drag in a
 *             filtered view swaps those projects among their own places and
 *             leaves the rest where they are
 *   switch    homepage on/off right on the row or card
 *   edit      a row or card opens its form in a dialog, which closes once saved
 *
 * The edit forms are rendered by the server and handed in as `form`.
 */

export type BoardItem = {
  id: string;
  title: string;
  categoryId: string | null;
  categoryTitle: string | null;
  /** a resized image for the thumbnail, or null */
  image: string | null;
  /** the video, when there is no image to show */
  video: string | null;
  hasVideo: boolean;
  onHomepage: boolean;
  form: React.ReactNode;
};

type View = "list" | "grid";
type Status = { kind: "saving" | "saved" | "error"; text: string } | null;

const VIEW_KEY = "mx_admin_works_view";

/* the list/grid choice, kept per browser */
function subscribeView(cb: () => void) {
  addEventListener("storage", cb);
  addEventListener("mx-view", cb);
  return () => {
    removeEventListener("storage", cb);
    removeEventListener("mx-view", cb);
  };
}
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}
function writeView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  dispatchEvent(new Event("mx-view"));
}

export function WorksBoard({ items, categories }: { items: BoardItem[]; categories: { id: string; title: string }[] }) {
  const view = useSyncExternalStore(subscribeView, readView, () => "list" as View);
  const [order, setOrder] = useState(() => items.map((i) => i.id));
  const [home, setHome] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [, startTransition] = useTransition();

  // the server's order wins whenever it changes (a project added or deleted,
  // or our own save coming back)
  const propKey = items.map((i) => i.id).join(",");
  const homeKey = items.map((i) => (i.onHomepage ? 1 : 0)).join("");
  const [seen, setSeen] = useState({ propKey, homeKey });
  if (seen.propKey !== propKey || seen.homeKey !== homeKey) {
    setSeen({ propKey, homeKey });
    if (seen.propKey !== propKey) setOrder(items.map((i) => i.id));
    setHome({});
  }

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const ordered = order.map((id) => byId.get(id)).filter((i): i is BoardItem => !!i);
  const isHome = (i: BoardItem) => home[i.id] ?? i.onHomepage;

  const q = query.trim().toLowerCase();
  const visible = ordered.filter((i) => {
    if (filter === "home" && !isHome(i)) return false;
    if (filter === "none" && i.categoryId) return false;
    if (filter.startsWith("cat:") && i.categoryId !== filter.slice(4)) return false;
    return !q || i.title.toLowerCase().includes(q) || (i.categoryTitle ?? "").toLowerCase().includes(q);
  });
  const visibleIds = visible.map((i) => i.id);
  const narrowed = filter !== "all" || !!q;

  useEffect(() => {
    if (status?.kind !== "saved") return;
    const t = setTimeout(() => setStatus(null), 2200);
    return () => clearTimeout(t);
  }, [status]);

  /* ------------------------------------------------------------ ordering */

  function commit(next: string[]) {
    const before = order;
    setOrder(next);
    setStatus({ kind: "saving", text: "Saving the order…" });
    startTransition(async () => {
      try {
        await reorderWorks(next);
        setStatus({ kind: "saved", text: "Order saved" });
        toast("Order saved");
      } catch (e) {
        setOrder(before);
        setStatus({ kind: "error", text: e instanceof Error && e.message ? e.message : "Couldn't save the order. Try again." });
      }
    });
  }

  /** Move within what is on screen; hidden projects keep their places. */
  function move(id: string, to: number) {
    const from = visibleIds.indexOf(id);
    if (from < 0 || to < 0 || to >= visibleIds.length || from === to) return;
    const nextVisible = arrayMove(visibleIds, from, to);
    const slots = new Set(visibleIds);
    let k = 0;
    commit(order.map((x) => (slots.has(x) ? nextVisible[k++] : x)));
  }

  function toggleHome(i: BoardItem) {
    const next = !isHome(i);
    setHome((h) => ({ ...h, [i.id]: next }));
    startTransition(async () => {
      try {
        await setWorkOnHomepage(i.id, next);
      } catch {
        setHome((h) => ({ ...h, [i.id]: !next }));
        setStatus({ kind: "error", text: "Couldn't change the homepage setting. Try again." });
      }
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: string | number | undefined) => byId.get(String(id))?.title ?? "project";
  const placeOf = (id: string | number | undefined) => visibleIds.indexOf(String(id)) + 1;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (e.over && e.active.id !== e.over.id) move(String(e.active.id), visibleIds.indexOf(String(e.over.id)));
  }

  /* ------------------------------------------------------------ edit */

  const editItem = editId ? byId.get(editId) : undefined;
  const editBody = useCloseOnSave(!!editItem, () => {
    setEditId(null);
    toast("Project saved");
  });

  /* ------------------------------------------------------------ view */

  const counts = {
    all: items.length,
    home: ordered.filter(isHome).length,
    none: items.filter((i) => !i.categoryId).length,
  };
  const chips: { key: string; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "home", label: "On homepage", n: counts.home },
    ...categories.map((c) => ({ key: `cat:${c.id}`, label: c.title, n: items.filter((i) => i.categoryId === c.id).length })),
    ...(counts.none ? [{ key: "none", label: "No category", n: counts.none }] : []),
  ];

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <div className={`${t.board} ${admin.frame}`}>
      <div className={t.bar}>
        <div className={t.tabs} role="group" aria-label="Show">
          {chips.map((c) => (
            <button key={c.key} type="button" className={t.tab} aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}>
              {c.label}
              <span className={t.tabCount}>{c.n}</span>
            </button>
          ))}
        </div>
        <div className={t.tools}>
          <label className={t.search}>
            <Icon icon={Search01Icon} size={16} />
            <input type="search" placeholder="Search projects" aria-label="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className={styles.views} role="group" aria-label="View">
            {(["list", "grid"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => writeView(v)} title={v === "list" ? "List view" : "Grid view"}>
                {v === "list" ? <ListIcon /> : <GridIcon />}
                <span>{v === "list" ? "List" : "Grid"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.hintRow}>
        <p className={styles.hint}>
          Drag <Grip /> to reorder{narrowed ? ". In this filtered view the shown projects swap places among themselves; the others stay put." : ": this is the order on /work, and on the homepage for the ticked ones."}
        </p>
        {status && (
          <p className={styles.status} data-kind={status.kind} role="status">
            {status.text}
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <p className={styles.empty}>{items.length ? "No projects match." : "No projects yet. Add the first one above."}</p>
      ) : (
        <DndContext
          id="works-board"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{
            screenReaderInstructions: {
              draggable: "To reorder, press Space. Use the arrow keys to move, Space to drop, Escape to cancel.",
            },
            announcements: {
              onDragStart: ({ active: a }) => `Picked up ${titleOf(a.id)}, place ${placeOf(a.id)} of ${visibleIds.length}.`,
              onDragOver: ({ active: a, over }) => (over ? `${titleOf(a.id)} is over place ${placeOf(over.id)}.` : `${titleOf(a.id)} is not over a place.`),
              onDragEnd: ({ active: a, over }) => (over ? `${titleOf(a.id)} dropped at place ${placeOf(over.id)}.` : `${titleOf(a.id)} dropped.`),
              onDragCancel: ({ active: a }) => `Moving ${titleOf(a.id)} cancelled.`,
            },
          }}
        >
          <SortableContext items={visibleIds} strategy={view === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
            {view === "list" && (
              <div className={styles.listHead} aria-hidden>
                <span />
                <span>#</span>
                <span />
                <span>Project</span>
                <span>Homepage</span>
                <span>Move</span>
                <span />
              </div>
            )}
            <div className={view === "grid" ? styles.grid : styles.list}>
              {visible.map((i, n) =>
                view === "grid" ? (
                  <Card key={i.id} item={i} place={n + 1} home={isHome(i)} onHome={() => toggleHome(i)} onEdit={() => setEditId(i.id)} />
                ) : (
                  <Row
                    key={i.id}
                    item={i}
                    place={n + 1}
                    last={n === visible.length - 1}
                    home={isHome(i)}
                    onEdit={() => setEditId(i.id)}
                    onHome={() => toggleHome(i)}
                    onStep={(d) => move(i.id, n + d)}
                    onEnds={(end) => move(i.id, end === "top" ? 0 : visible.length - 1)}
                  />
                ),
              )}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.33, 1, 0.68, 1)" }}>
            {active ? (
              view === "grid" ? (
                <CardFace item={active} place={placeOf(active.id)} home={isHome(active)} lifted />
              ) : (
                <RowFace item={active} place={placeOf(active.id)} home={isHome(active)} lifted />
              )
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Modal open={!!editItem} onClose={() => setEditId(null)} title={editItem ? `Edit ${editItem.title}` : "Edit project"}>
        <div ref={editBody}>{editItem?.form}</div>
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------------- list */

function Row({
  item,
  place,
  last,
  home,
  onEdit,
  onHome,
  onStep,
  onEnds,
}: {
  item: BoardItem;
  place: number;
  last: boolean;
  home: boolean;
  onEdit: () => void;
  onHome: () => void;
  onStep: (d: -1 | 1) => void;
  onEnds: (end: "top" | "bottom") => void;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      className={styles.row}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <div className={styles.rowHead}>
        <Handle title={item.title} activator={setActivatorNodeRef} attributes={attributes} listeners={listeners} />
        <span className={styles.place}>{place}</span>
        <Thumb item={item} className={styles.rowThumb} />
        <button type="button" className={styles.rowMain} onClick={onEdit}>
          <span className={styles.rowTitle}>{item.title}</span>
          <Meta item={item} />
        </button>
        <HomeSwitch on={home} title={item.title} onChange={onHome} />
        <div className={styles.rowMoves}>
          <button type="button" className={styles.iconBtn} onClick={() => onEnds("top")} disabled={place === 1} title="Move to the top" aria-label={`Move ${item.title} to the top`}>
            <ToEndIcon />
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => onStep(-1)} disabled={place === 1} title="Move up" aria-label={`Move ${item.title} up`}>
            ↑
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => onStep(1)} disabled={last} title="Move down" aria-label={`Move ${item.title} down`}>
            ↓
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => onEnds("bottom")} disabled={last} title="Move to the bottom" aria-label={`Move ${item.title} to the bottom`}>
            <ToEndIcon down />
          </button>
        </div>
        <button type="button" className={styles.editBtn} onClick={onEdit}>
          <PencilIcon />
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
}

function RowFace({ item, place, home, lifted }: { item: BoardItem; place: number; home: boolean; lifted?: boolean }) {
  return (
    <div className={styles.row} data-lifted={lifted || undefined}>
      <div className={styles.rowHead}>
        <span className={styles.handle} aria-hidden>
          <Grip />
        </span>
        <span className={styles.place}>{place}</span>
        <Thumb item={item} className={styles.rowThumb} />
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>{item.title}</span>
          <Meta item={item} />
        </span>
        <span className={styles.switch} data-on={home || undefined} aria-hidden>
          <span />
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- grid */

function Card({ item, place, home, onHome, onEdit }: { item: BoardItem; place: number; home: boolean; onHome: () => void; onEdit: () => void }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      className={styles.card}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <div className={styles.cardMedia}>
        <button type="button" className={styles.cardOpen} onClick={onEdit} aria-label={`Edit ${item.title}`}>
          <Thumb item={item} className={styles.cardThumb} />
        </button>
        <div className={styles.cardTop}>
          <Handle title={item.title} activator={setActivatorNodeRef} attributes={attributes} listeners={listeners} onMedia />
          <span className={styles.cardPlace}>{place}</span>
        </div>
      </div>
      <div className={styles.cardFoot}>
        <button type="button" className={styles.cardText} onClick={onEdit}>
          <span className={styles.rowTitle}>{item.title}</span>
          <Meta item={item} />
        </button>
        <HomeSwitch on={home} title={item.title} onChange={onHome} />
      </div>
    </div>
  );
}

function CardFace({ item, place, home, lifted }: { item: BoardItem; place: number; home: boolean; lifted?: boolean }) {
  return (
    <div className={styles.card} data-lifted={lifted || undefined}>
      <div className={styles.cardMedia}>
        <Thumb item={item} className={styles.cardThumb} />
        <div className={styles.cardTop}>
          <span className={`${styles.handle} ${styles.handleOnMedia}`} aria-hidden>
            <Grip />
          </span>
          <span className={styles.cardPlace}>{place}</span>
        </div>
      </div>
      <div className={styles.cardFoot}>
        <span className={styles.cardText}>
          <span className={styles.rowTitle}>{item.title}</span>
          <Meta item={item} />
        </span>
        <span className={styles.switch} data-on={home || undefined} aria-hidden>
          <span />
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- parts */

type Sortable = ReturnType<typeof useSortable>;

function Handle({
  title,
  activator,
  attributes,
  listeners,
  onMedia,
}: {
  title: string;
  activator: Sortable["setActivatorNodeRef"];
  attributes: Sortable["attributes"];
  listeners: Sortable["listeners"];
  onMedia?: boolean;
}) {
  return (
    <button
      type="button"
      ref={activator}
      className={`${styles.handle} ${onMedia ? styles.handleOnMedia : ""}`}
      aria-label={`Reorder ${title}`}
      {...attributes}
      {...listeners}
    >
      <Grip />
    </button>
  );
}

function HomeSwitch({ on, title, onChange }: { on: boolean; title: string; onChange: () => void }) {
  return (
    <label className={styles.homeSwitch} title={on ? "Shown on the homepage" : "Not on the homepage"}>
      <input type="checkbox" role="switch" checked={on} onChange={onChange} aria-label={`Show ${title} on the homepage`} />
      <span className={styles.switch} data-on={on || undefined} aria-hidden>
        <span />
      </span>
      <span className={styles.switchLabel}>Homepage</span>
    </label>
  );
}

function Thumb({ item, className }: { item: BoardItem; className: string }) {
  if (item.image) {
    // eslint-disable-next-line @next/next/no-img-element -- already a resized copy from /media
    return <img className={className} src={item.image} alt="" loading="lazy" decoding="async" draggable={false} />;
  }
  if (item.video) return <video className={className} src={item.video} muted playsInline preload="metadata" />;
  return <span className={`${className} ${styles.noThumb}`}>No cover</span>;
}

function Meta({ item }: { item: BoardItem }) {
  const bits = [item.categoryTitle ?? "No category", item.hasVideo ? "Video" : null].filter(Boolean);
  return <span className={styles.rowMeta}>{bits.join(" · ")}</span>;
}

/* ---------------------------------------------------------------- icons */

function Grip() {
  return (
    <svg className={styles.gripIcon} width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      {[2, 8, 14].map((y) => (
        <g key={y}>
          <circle cx="2.5" cy={y} r="1.4" />
          <circle cx="7.5" cy={y} r="1.4" />
        </g>
      ))}
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.75" y="1.75" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.75" y="1.75" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.75" y="7.75" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.75" y="7.75" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ToEndIcon({ down = false }: { down?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden style={down ? { transform: "scaleY(-1)" } : undefined}>
      <path d="M2.5 1.75h7M6 10.25V4.5M3.5 7L6 4.5 8.5 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return <Icon icon={PencilEdit02Icon} size={16} />;
}
