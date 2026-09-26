/* Shared by the server-rendered library page and the upload widgets; kept
   apart from upload-client.ts so the server never pulls in the video encoder. */

/** "video/webm; codecs=\"av01…\"" → "WebM (AV1)", "image/webp" → "WebP" */
export function formatLabel(mime: string): string {
  const [type, params = ""] = mime.split(";");
  const sub = type.split("/")[1] ?? type;
  const name = ({ webp: "WebP", webm: "WebM", mp4: "MP4", png: "PNG", jpeg: "JPEG", gif: "GIF", "svg+xml": "SVG", avif: "AVIF" } as Record<string, string>)[sub] ?? sub.toUpperCase();
  const codec = /av01/i.test(params) ? " (AV1)" : /vp9/i.test(params) ? " (VP9)" : "";
  return name + codec;
}
