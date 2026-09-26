"use client";

import { useState } from "react";
import s from "../admin.module.css";
import own from "./bookings.module.css";

/** A value to paste into Cal.com, with a button that copies it. */
export function Copy({ value, secret = false }: { value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);

  return (
    <div className={own.copy}>
      <code className={own.code}>{shown ? value : "•".repeat(Math.min(value.length, 32))}</code>
      {secret && (
        <button type="button" className={s.btn} onClick={() => setShown((v) => !v)}>
          {shown ? "Hide" : "Show"}
        </button>
      )}
      <button
        type="button"
        className={s.btn}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
