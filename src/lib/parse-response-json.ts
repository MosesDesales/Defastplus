/**
 * Parse fetch Response as JSON without throwing on empty or invalid bodies
 * (avoids SyntaxError when proxies/dev servers return empty 200/500 HTML).
 */
export async function parseResponseJson<T>(res: Response, fallback: T): Promise<T> {
  const text = await res.text();
  if (!text?.trim()) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
