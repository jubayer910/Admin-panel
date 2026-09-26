import { mediaUrl, newId, run } from "@/lib/db";

/* One upload path for every media field and the library page.

   On the real site images go to the server, which converts them to WebP,
   and videos are converted in the browser first. In the demo the file stays
   in this browser: it is kept as a blob: URL and listed in the media
   library like any upload, until the page is refreshed. */

export type Uploaded = {
  key: string;
  url: string;
  mime: string;
  size: number;
  originalSize: number;
  optimized: boolean;
  note?: string;
};

/** An image's size in pixels, when the browser can read it. */
async function dimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return { width: null, height: null };
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

export async function uploadMedia(
  file: File,
  opts: { max?: number; onStatus?: (status: string) => void } = {},
): Promise<Uploaded> {
  opts.onStatus?.("Adding it to the demo's library…");
  const key = URL.createObjectURL(file);
  const { width, height } = await dimensions(file);
  const mime = file.type || "application/octet-stream";
  run(
    `INSERT INTO media (id, key, filename, mime, size, width, height, created_at, original_size, optimized)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 0)`,
    newId("media"),
    key,
    file.name,
    mime,
    file.size,
    width,
    height,
    file.size,
  );
  return {
    key,
    url: mediaUrl(key) ?? key,
    mime,
    size: file.size,
    originalSize: file.size,
    optimized: false,
    note: "Demo: the file stays in this browser, as it is. The real admin converts it for the web and stores it.",
  };
}

export const fmtBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export { formatLabel } from "./format";
