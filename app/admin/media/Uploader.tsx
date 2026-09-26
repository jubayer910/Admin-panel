"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { fmtBytes, formatLabel, uploadMedia } from "../upload-client";
import { adminStyles as s } from "../ui";
import styles from "../MediaField.module.css";

/** Library upload: several files at once, each converted on the way in. */
export function Uploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement | null>(null);
  const [lines, setLines] = useState<{ name: string; text: string; error?: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function run(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setLines(files.map((f) => ({ name: f.name, text: "Waiting…" })));
    for (const [i, file] of files.entries()) {
      const set = (text: string, error = false) =>
        setLines((all) => all.map((l, j) => (j === i ? { ...l, text, error } : l)));
      try {
        const up = await uploadMedia(file, { onStatus: (t) => set(t) });
        set(
          [
            up.size < up.originalSize
              ? `${fmtBytes(up.originalSize)} → ${fmtBytes(up.size)} ${formatLabel(up.mime)}`
              : `${fmtBytes(up.size)}, already as small as it gets`,
            up.note,
          ]
            .filter(Boolean)
            .join(" · "),
        );
      } catch (e) {
        set(e instanceof Error ? e.message : "Upload failed", true);
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className={s.field}>
      <div
        className={styles.drop}
        data-empty
        data-dragging={dragging || undefined}
        role="button"
        tabIndex={0}
        onClick={() => !busy && input.current?.click()}
        onKeyDown={(e) => {
          if (!busy && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void run(Array.from(e.dataTransfer.files ?? []));
        }}
      >
        <span className={styles.placeholder}>
          {busy ? "Working…" : <>Drop files here, or <u>browse</u></>}
          <small>
            Images become WebP, videos become WebM with an MP4 for older Safari. Convert videos from Chrome.
          </small>
        </span>
      </div>
      <input
        ref={input}
        className={styles.hiddenInput}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif,video/mp4,video/webm,video/quicktime"
        onChange={(e) => {
          void run(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {lines.length > 0 && (
        <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
          {lines.map((l, i) => (
            <li key={i} className={l.error ? styles.error : styles.saved}>
              <b style={{ fontWeight: 500, color: "var(--ink-soft)" }}>{l.name}</b>: {l.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
