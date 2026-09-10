/**
 * Resolve organization logo to a buffer for PDFKit `doc.image`.
 * Supports data URLs and http(s) URLs (server-side fetch).
 */
export async function logoBufferFromUrl(logoUrl: string | null | undefined): Promise<Buffer | null> {
  if (!logoUrl?.trim()) return null;
  const u = logoUrl.trim();
  if (u.startsWith("data:image")) {
    const i = u.indexOf("base64,");
    if (i === -1) return null;
    try {
      return Buffer.from(u.slice(i + 7), "base64");
    } catch {
      return null;
    }
  }
  if (u.startsWith("http://") || u.startsWith("https://")) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) return null;
      const ab = await r.arrayBuffer();
      return Buffer.from(ab);
    } catch {
      return null;
    }
  }
  return null;
}
