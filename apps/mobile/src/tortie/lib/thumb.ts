const YT =
  /^(https?:\/\/i\.ytimg\.com\/vi(?:_webp)?\/[^/]+\/)[^/?]+\.(?:jpg|webp)(\?.*)?$/;

/**
 * Smaller image for a rendered width. YouTube thumbnails are rewritten to
 * `hqdefault.jpg` (480×360); maxres often 404s so it is never requested. Other
 * hosts are returned untouched, since expo-image already decodes to view size.
 */
export function thumbFor(url: string, width?: number): string {
  if (!width || width > 480) return url;
  const m = YT.exec(url);
  return m ? `${m[1]}hqdefault.jpg${m[2] ?? ''}` : url;
}
