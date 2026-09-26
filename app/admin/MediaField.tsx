"use client";

import { useEffect, useRef, useState } from "react";
import { all, mediaUrl } from "@/lib/db";
import { fmtBytes, formatLabel, uploadMedia } from "./upload-client";
import styles from "./MediaField.module.css";

type LibraryFile = {
  key: string;
  url: string;
  filename: string;
  mime: string;
};

type Props = {
  label: string;
  name: string;
  defaultValue?: string | null;
  /** shown under the field */
  hint?: string;
  accept?: string;
  /** square preview for icons and avatars */
  shape?: "wide" | "square";
  /**
   * Longest side, in px, an uploaded image is stored at - about four times
   * the size it is shown at. Videos are always capped at 1920.
   */
  max?: number;
};

const isVideo = (v: string) => /\.(mp4|webm|mov)($|\?)/i.test(v);

/**
 * Pick an image, GIF or video - drop it, browse for it, or reuse something
 * already uploaded. The value written to the form is the stored key; nobody
 * has to handle URLs.
 */
export function MediaField({
  label,
  name,
  defaultValue,
  hint,
  accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif,video/mp4,video/webm",
  shape = "wide",
  max,
}: Props) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [preview, setPreview] = useState<string>(
    defaultValue ? toUrl(defaultValue) : "",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [library, setLibrary] = useState<LibraryFile[] | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function toUrl(v: string) {
    return mediaUrl(v) ?? v;
  }

  async function upload(file: File) {
    setBusy(true);
    setError("");
    setSaved("");
    setStatus("");
    try {
      const up = await uploadMedia(file, { max, onStatus: setStatus });
      setValue(up.key);
      setPreview(up.url ?? toUrl(up.key));
      setSaved(
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
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function openLibrary() {
    if (library) return setLibrary(null);
    // an MP4 that only stands in for a WebM is not something to pick
    const files = all<{ key: string; filename: string; mime: string }>(
      `SELECT key, filename, mime FROM media
        WHERE key NOT IN (SELECT fallback_key FROM media WHERE fallback_key IS NOT NULL)
        ORDER BY created_at DESC LIMIT 200`,
    );
    setLibrary(files.map((f) => ({ ...f, url: mediaUrl(f.key) ?? f.key })) as LibraryFile[]);
  }

  // re-sync when the server sends a different value (after a save), the
  // documented "adjust state during render" pattern rather than an effect
  const [seenDefault, setSeenDefault] = useState(defaultValue ?? "");
  if ((defaultValue ?? "") !== seenDefault) {
    setSeenDefault(defaultValue ?? "");
    setValue(defaultValue ?? "");
    setPreview(defaultValue ? toUrl(defaultValue) : "");
  }

  // after "Add project" goes through, React resets the form; the stored key
  // lives in state, so it has to go back to the field's own default too
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const defaultRef = useRef(defaultValue ?? "");
  useEffect(() => {
    defaultRef.current = defaultValue ?? "";
  }, [defaultValue]);
  useEffect(() => {
    const form = fieldRef.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      const d = defaultRef.current;
      setValue(d);
      setPreview(d ? toUrl(d) : "");
      setSaved("");
      setError("");
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const empty = !value;

  return (
    // data-uploading tells the form's guard to hold a save until this is done
    <div ref={fieldRef} className={styles.field} data-uploading={busy || undefined}>
      <span className={styles.label}>{label}</span>
      <input type="hidden" name={name} value={value} />

      <div
        className={`${styles.drop} ${shape === "square" ? styles.square : ""}`}
        data-empty={empty || undefined}
        data-dragging={dragging || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        onClick={() => empty && inputRef.current?.click()}
        role={empty ? "button" : undefined}
        tabIndex={empty ? 0 : undefined}
        onKeyDown={(e) => {
          if (empty && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {busy ? (
          <span className={styles.placeholder}>{status || "Uploading…"}</span>
        ) : empty ? (
          <span className={styles.placeholder}>
            Drop a file here, or <u>browse</u>
            <small>Image, GIF or video</small>
          </span>
        ) : isVideo(preview) ? (
          <video className={styles.preview} src={preview} muted loop playsInline autoPlay preload="metadata" />
        ) : (
          // plain <img>: arbitrary uploads, and GIFs must keep animating
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.preview} src={preview} alt="" />
        )}
      </div>

      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.miniBtn}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {empty ? "Upload" : "Replace"}
        </button>
        <button type="button" className={styles.miniBtn} onClick={openLibrary}>
          {library ? "Close library" : "Choose existing"}
        </button>
        {!empty && (
          <button
            type="button"
            className={`${styles.miniBtn} ${styles.danger}`}
            onClick={() => {
              setValue("");
              setPreview("");
            }}
          >
            Remove
          </button>
        )}
      </div>

      {error && <span className={styles.error}>{error}</span>}
      {saved && !error && <span className={styles.saved}>{saved}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}

      {library && (
        <div className={styles.library}>
          {library.length === 0 ? (
            <span className={styles.hint}>
              Nothing uploaded yet. Drop a file above.
            </span>
          ) : (
            library.map((f) => (
              <button
                key={f.key}
                type="button"
                className={styles.libItem}
                title={f.filename}
                onClick={() => {
                  setValue(f.key);
                  setPreview(f.url);
                  setLibrary(null);
                }}
              >
                {f.mime.startsWith("video/") ? (
                  <span className={styles.libVideo}>video</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt="" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
