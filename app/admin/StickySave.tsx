"use client";

import { useEffect, useRef, useState } from "react";
import { SaveButton } from "./FormButtons";
import { toast } from "./Modal";
import styles from "./Sections.module.css";

/**
 * The save bar for a long settings form: pinned to the foot of the screen,
 * it says whether anything is unsaved, can put the form back, and warns
 * before the tab is closed with edits in it. React resets the form after a
 * successful save, which is when it goes quiet again.
 */
export function StickySave({ label = "Save changes" }: { label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const mark = (e: Event) => {
      // the media picker's search box is not part of what gets saved
      if ((e.target as HTMLElement | null)?.closest("[data-nodirty]")) return;
      setDirty(true);
    };
    const onSubmit = () => {
      pending.current = true;
    };
    const onReset = () => {
      setDirty(false);
      if (pending.current) toast("Changes saved");
      pending.current = false;
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!form.dataset.dirty) return;
      e.preventDefault();
    };
    form.addEventListener("input", mark);
    form.addEventListener("change", mark);
    form.addEventListener("submit", onSubmit);
    form.addEventListener("reset", onReset);
    addEventListener("beforeunload", onLeave);
    return () => {
      form.removeEventListener("input", mark);
      form.removeEventListener("change", mark);
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("reset", onReset);
      removeEventListener("beforeunload", onLeave);
    };
  }, []);

  // the leave warning reads this off the form
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (form) form.toggleAttribute("data-dirty", dirty);
  }, [dirty]);

  return (
    <div ref={ref} className={styles.saveBar} data-dirty={dirty || undefined}>
      <span className={styles.saveState}>
        <span className={styles.saveDot} aria-hidden />
        {dirty ? "Unsaved changes" : "All changes saved"}
      </span>
      <button
        type="button"
        className={styles.discard}
        disabled={!dirty}
        onClick={() => {
          pending.current = false;
          ref.current?.closest("form")?.reset();
        }}
      >
        Discard
      </button>
      <SaveButton label={label} />
    </div>
  );
}
