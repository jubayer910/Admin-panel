"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./admin.module.css";

/**
 * Stops a form going off half-done: while a file is still uploading, or
 * when none of `requireOneOf` has a value (a project needs a cover or a
 * video). Delete buttons pass straight through.
 */
export function FormGuard({ requireOneOf = [], message }: { requireOneOf?: string[]; message?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [error, setError] = useState("");
  const names = requireOneOf.join("|");

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const fields = names ? names.split("|") : [];

    const onSubmit = (e: SubmitEvent) => {
      if ((e.submitter as HTMLElement | null)?.hasAttribute("data-delete")) return;
      let why = "";
      if (form.querySelector("[data-uploading]")) why = "Wait for the upload to finish, then save.";
      else if (
        fields.length &&
        fields.every((n) => {
          const el = form.elements.namedItem(n);
          return !(el instanceof HTMLInputElement) || !el.value.trim();
        })
      ) {
        why = message || "Fill in the required field first.";
      }
      if (why) {
        e.preventDefault();
        e.stopPropagation();
        setError(why);
      }
    };
    const clear = () => setError("");

    form.addEventListener("submit", onSubmit);
    form.addEventListener("input", clear);
    form.addEventListener("change", clear);
    return () => {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("input", clear);
      form.removeEventListener("change", clear);
    };
  }, [names, message]);

  return (
    <span ref={ref} className={styles.guard} role="alert">
      {error}
    </span>
  );
}
