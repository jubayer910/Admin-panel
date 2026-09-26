"use client";

import { all, env, mediaUrl, useDatabase } from "@/lib/db";
import { DialogButton } from "../Modal";
import { PageHead } from "../ui";
import { formatLabel } from "../format";
import { MediaBrowser, type MediaItem } from "./MediaBrowser";
import { Uploader } from "./Uploader";

type Row = {
  id: string;
  key: string;
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  original_size: number | null;
  fallback_key: string | null;
  fallback_size: number | null;
  optimized: number;
  created_at: string;
};

const kb = (n: number) =>
  n > 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(n / 1024)} KB`;

export default function MediaPage() {
  useDatabase();
  const [files, e] = [
    // each WebM carries its MP4 along; the MP4 is not listed on its own
    all<Row>(
      `SELECT m.*, f.size AS fallback_size FROM media m
         LEFT JOIN media f ON f.key = m.fallback_key
        WHERE m.key NOT IN (SELECT fallback_key FROM media WHERE fallback_key IS NOT NULL)
        ORDER BY m.created_at DESC`,
    ),
    env(),
  ] as const;
  const base = e.MEDIA_BASE_URL || undefined;

  const items: MediaItem[] = files.map((f) => {
    const url = mediaUrl(f.key, base);
    const ext = f.key.split(".").pop()?.toLowerCase() ?? "";
    const kind: MediaItem["kind"] = f.mime.startsWith("video/")
      ? "video"
      : ext === "gif"
        ? "gif"
        : ext === "svg"
          ? "svg"
          : f.mime.startsWith("image/")
            ? "image"
            : "other";
    const saved = f.original_size && f.original_size > f.size ? `-${Math.round((1 - f.size / f.original_size) * 100)}%` : null;
    return {
      id: f.id,
      key: f.key,
      url,
      // a resized copy for the grid; GIFs and SVGs as they are
      thumb: url && kind === "image" && url.startsWith("/media/") ? `${url}?w=384` : url,
      filename: f.filename,
      kind,
      meta: [
        formatLabel(f.mime),
        f.width && f.height ? `${f.width}×${f.height}` : null,
        kb(f.size),
        f.fallback_key ? `+ MP4 ${kb(f.fallback_size ?? 0)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      type: formatLabel(f.mime),
      dims: f.width && f.height ? `${f.width}×${f.height}` : null,
      size: kb(f.size) + (f.fallback_key ? ` + MP4 ${kb(f.fallback_size ?? 0)}` : ""),
      bytes: f.size + (f.fallback_size ?? 0),
      // D1 keeps "YYYY-MM-DD HH:MM:SS" in UTC
      added: Date.parse(`${f.created_at.replace(" ", "T")}Z`) || 0,
      saved,
      optimized: !!f.optimized,
    };
  });

  return (
    <>
      <PageHead
        title="Media library"
        note="Everything uploaded, converted for the web on the way in: images to WebP, GIFs kept as GIFs, videos to WebM with an MP4 for older Safari."
      >
        <DialogButton label="Upload files" title="Upload files" description="Drop in several at once. Each is converted before it is stored.">
          <Uploader />
        </DialogButton>
      </PageHead>

      <MediaBrowser items={items} />
    </>
  );
}
