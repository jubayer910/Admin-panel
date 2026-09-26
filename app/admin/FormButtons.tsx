"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import styles from "./admin.module.css";

/**
 * Save, with feedback: "Saving…" while the action runs, "Saved" for a moment
 * after. The form's own status, so it works in every admin form unchanged.
 */
export function SaveButton({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  const [was, setWas] = useState(pending);
  const [done, setDone] = useState(false);

  // pending just went from true to false: the save landed
  if (was !== pending) {
    setWas(pending);
    if (!pending) setDone(true);
  }

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1800);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={pending} data-state={pending ? "saving" : done ? "saved" : undefined}>
      {pending ? "Saving…" : done ? "Saved ✓" : label}
    </button>
  );
}

/**
 * Sits inside the same form as Save and submits to the delete action instead
 * (a nested <form> is invalid HTML; the form already carries the row id).
 * The first click only arms it, so a slip next to Save deletes nothing.
 */
export function DeleteButton({
  action,
  label = "Delete",
}: {
  action: (formData: FormData) => void;
  /** kept for call sites that pass it; the id comes from the form */
  id?: string;
  label?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      className={`${styles.btn} ${styles.btnDanger}`}
      type="submit"
      formAction={action}
      data-delete
      data-armed={armed || undefined}
      onClick={(e) => {
        if (armed) return;
        e.preventDefault();
        setArmed(true);
      }}
    >
      {armed ? "Click again to delete" : label}
    </button>
  );
}
