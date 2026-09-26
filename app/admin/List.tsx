"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowDownDoubleIcon from "@hugeicons/core-free-icons/ArrowDownDoubleIcon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import ArrowUpDoubleIcon from "@hugeicons/core-free-icons/ArrowUpDoubleIcon";
import DragDropVerticalIcon from "@hugeicons/core-free-icons/DragDropVerticalIcon";
import PencilEdit02Icon from "@hugeicons/core-free-icons/PencilEdit02Icon";
import { createContext, useContext, useState, useTransition } from "react";
import { reorderRows } from "./actions";
import { Icon } from "./Icon";
import { Modal, toast, useCloseOnSave } from "./Modal";
import admin from "./admin.module.css";
import styles from "./List.module.css";

/*
 * The list every collection page uses. Rows are dragged by their handle (or,
 * from the keyboard: focus it, Space, arrows, Space), or sent up, down, to
 * the top or the bottom with the buttons; the new order is saved at once.
 * A row opens its form in a dialog, which closes itself once saved.
 *
 * The rows arrive from the server in its order. While a save is on its way
 * the list shows the new order through CSS `order`, so nothing jumps.
 */

type ListCtx = {
  order: string[];
  move: (id: string, to: number) => void;
};

const Ctx = createContext<ListCtx | null>(null);

export function SortableRows({
  table,
  ids,
  scope,
  label = "rows",
  children,
}: {
  /** the table, for the save */
  table: string;
  /** the rows' ids in the server's order */
  ids: string[];
  /** client logos: which row these are */
  scope?: number;
  /** what the rows are, for screen readers: "questions" */
  label?: string;
  children: React.ReactNode;
}) {
  const [order, setOrder] = useState(ids);
  const [, startTransition] = useTransition();

  // the server's order wins whenever it changes
  const key = ids.join(",");
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setOrder(ids);
  }

  function move(id: string, to: number) {
    const from = order.indexOf(id);
    if (from < 0 || to < 0 || to >= order.length || from === to) return;
    const before = order;
    const next = arrayMove(order, from, to);
    setOrder(next);
    startTransition(async () => {
      try {
        await reorderRows(table, next, scope);
        toast("Order saved");
      } catch (e) {
        setOrder(before);
        toast(e instanceof Error && e.message ? e.message : "Couldn't save the order");
      }
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (e.over && e.active.id !== e.over.id) move(String(e.active.id), order.indexOf(String(e.over.id)));
  }

  const place = (id: string | number) => order.indexOf(String(id)) + 1;

  return (
    <Ctx.Provider value={{ order, move }}>
      <DndContext
        id={`list-${table}-${scope ?? 0}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: { draggable: "To reorder, press Space. Use the arrow keys to move, Space to drop, Escape to cancel." },
          announcements: {
            onDragStart: ({ active }) => `Picked up, place ${place(active.id)} of ${order.length} ${label}.`,
            onDragOver: ({ over }) => (over ? `Over place ${place(over.id)}.` : "Not over a place."),
            onDragEnd: ({ over }) => (over ? `Dropped at place ${place(over.id)}.` : "Dropped."),
            onDragCancel: () => "Cancelled.",
          },
        }}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className={`${styles.rows} ${admin.frame}`}>{children}</div>
        </SortableContext>
      </DndContext>
    </Ctx.Provider>
  );
}

export function Item({
  id,
  title,
  meta,
  thumb,
  editTitle,
  children,
}: {
  id: string;
  title: string;
  meta?: string;
  /** image or video url for the row thumbnail */
  thumb?: string | null;
  /** the dialog's title; "Edit <title>" otherwise */
  editTitle?: string;
  /** kept for older call sites; the list knows its table */
  table?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(Ctx);
  const index = ctx ? ctx.order.indexOf(id) : -1;
  const count = ctx?.order.length ?? 0;
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  const [open, setOpen] = useState(false);
  const bodyRef = useCloseOnSave(open, () => {
    setOpen(false);
    toast("Saved");
  });
  const isVideo = thumb ? /\.(mp4|webm|mov)($|\?)/i.test(thumb) : false;

  return (
    <div
      ref={setNodeRef}
      className={styles.row}
      data-dragging={isDragging || undefined}
      style={{ order: index, transform: CSS.Translate.toString(transform), transition }}
    >
      <button type="button" ref={setActivatorNodeRef} className={styles.handle} aria-label={`Reorder ${title}`} {...attributes} {...listeners}>
        <Icon icon={DragDropVerticalIcon} size={18} />
      </button>
      <span className={styles.place}>{index + 1}</span>

      {thumb &&
        (isVideo ? (
          <video className={styles.thumb} src={thumb} muted playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- an admin thumbnail, already small
          <img className={styles.thumb} src={thumb} alt="" loading="lazy" />
        ))}

      <button type="button" className={styles.main} onClick={() => setOpen(true)}>
        <span className={styles.title}>{title}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
      </button>

      {ctx && (
        <div className={styles.moves}>
          <button type="button" className={styles.iconBtn} disabled={index <= 0} onClick={() => ctx.move(id, 0)} title="Move to the top" aria-label={`Move ${title} to the top`}>
            <Icon icon={ArrowUpDoubleIcon} size={16} />
          </button>
          <button type="button" className={styles.iconBtn} disabled={index <= 0} onClick={() => ctx.move(id, index - 1)} title="Move up" aria-label={`Move ${title} up`}>
            <Icon icon={ArrowUp01Icon} size={16} />
          </button>
          <button type="button" className={styles.iconBtn} disabled={index >= count - 1} onClick={() => ctx.move(id, index + 1)} title="Move down" aria-label={`Move ${title} down`}>
            <Icon icon={ArrowDown01Icon} size={16} />
          </button>
          <button type="button" className={styles.iconBtn} disabled={index >= count - 1} onClick={() => ctx.move(id, count - 1)} title="Move to the bottom" aria-label={`Move ${title} to the bottom`}>
            <Icon icon={ArrowDownDoubleIcon} size={16} />
          </button>
        </div>
      )}

      <button type="button" className={styles.edit} onClick={() => setOpen(true)}>
        <Icon icon={PencilEdit02Icon} size={16} />
        <span>Edit</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={editTitle ?? `Edit ${title}`}>
        <div ref={bodyRef}>{children}</div>
      </Modal>
    </div>
  );
}

/** Optional fields, folded away so the common case stays short. */
export function More({ label = "More options", children }: { label?: string; children: React.ReactNode }) {
  return (
    <details className={styles.more}>
      <summary className={styles.moreHead}>{label}</summary>
      <div className={styles.moreBody}>{children}</div>
    </details>
  );
}
