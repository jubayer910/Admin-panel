"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./admin.module.css";

/** Say something briefly at the foot of the screen ("Project added"). */
export function toast(text: string) {
  dispatchEvent(new CustomEvent("admin-toast", { detail: text }));
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const id = ++n;
      setItems((all) => [...all.slice(-2), { id, text: String((e as CustomEvent).detail) }]);
      setTimeout(() => setItems((all) => all.filter((t) => t.id !== id)), 2600);
    };
    addEventListener("admin-toast", on);
    return () => removeEventListener("admin-toast", on);
  }, []);
  return (
    <div className={styles.toaster} role="status" aria-live="polite">
      {items.map((t) => (
        <p key={t.id} className={styles.toast}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 12.5L10.5 15L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t.text}
        </p>
      ))}
    </div>
  );
}

/**
 * A centred dialog for a form: title, a line under it, the form scrolling
 * inside, its buttons pinned to the foot. Native <dialog>, so focus stays
 * in, Escape closes, and focus returns to what opened it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.modal}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // a click on the dim backdrop, outside the box, closes it
        const r = e.currentTarget.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (e.target === e.currentTarget && !inside) e.currentTarget.close();
      }}
    >
      <div className={styles.modalInner}>
        <header className={styles.modalHead}>
          <div>
            <h2 className={styles.modalTitle}>{title}</h2>
            {description && <p className={styles.modalNote}>{description}</p>}
          </div>
          <button type="button" className={styles.iconBtn} onClick={() => ref.current?.close()} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M19 5L5 19M5 5L19 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </dialog>
  );
}

/**
 * Close the dialog once its form has gone through. React resets a form after
 * its action succeeds, so the reset is the signal; a failed save leaves the
 * dialog open with what was typed.
 */
export function useCloseOnSave(open: boolean, onSaved: () => void) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const saved = useRef(onSaved);
  useEffect(() => {
    saved.current = onSaved;
  });
  useEffect(() => {
    const form = bodyRef.current?.querySelector("form");
    if (!open || !form) return;
    const onReset = () => saved.current();
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [open]);
  return bodyRef;
}

/**
 * A small button that opens a form in a dialog: "Add project", "Add a
 * question". Closes itself and says so once the form has saved.
 */
export function FormModal({
  label,
  title,
  description,
  done = "Saved",
  defaultOpen = false,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  /** the toast after a save */
  done?: string;
  /** open on arrival, for links like /admin/works?add=1 */
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const close = () => {
    setOpen(false);
    // drop the ?add=1 that opened it, so a reload does not open it again
    const url = new URL(location.href);
    if (url.searchParams.has("add")) {
      url.searchParams.delete("add");
      history.replaceState(history.state, "", url);
    }
  };
  const bodyRef = useCloseOnSave(open, () => {
    close();
    toast(done);
  });

  return (
    <>
      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 4V20M20 12H4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </button>
      <Modal open={open} onClose={close} title={title} description={description}>
        <div ref={bodyRef}>{children}</div>
      </Modal>
    </>
  );
}

/** A button that opens a dialog which stays open (the uploader shows its results). */
export function DialogButton({
  label,
  title,
  description,
  primary = true,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`${styles.btn} ${primary ? styles.btnPrimary : ""}`} onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 4V20M20 12H4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <div style={{ paddingBottom: 22 }}>{children}</div>
      </Modal>
    </>
  );
}

