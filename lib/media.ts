import { one, run } from "./db";

/*
 * Files. The real admin stores them in Cloudflare R2 and converts images with
 * Cloudflare Images; in the demo an upload stays in the browser as a blob:
 * URL (app/admin/upload-client.ts) and deleting it just forgets it.
 */

/** Remove a file and the MP4 that stands in for it. */
export async function deleteMediaEverywhere(key: string): Promise<void> {
  const row = one<{ fallback_key: string | null }>("SELECT fallback_key FROM media WHERE key = ?", key);
  for (const k of [key, ...(row?.fallback_key ? [row.fallback_key] : [])]) {
    if (k.startsWith("blob:")) URL.revokeObjectURL(k);
    run("DELETE FROM media WHERE key = ?", k);
  }
}
