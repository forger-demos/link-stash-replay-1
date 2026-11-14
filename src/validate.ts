export type NewLink = {url: string; title: string};

export function parseNewLink(body: unknown): {ok: true; link: NewLink} | {ok: false; error: string} {
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const raw = typeof input.url === 'string' ? input.url.trim() : '';
  let valid = false;
  try {
    const protocol = new URL(raw).protocol;
    valid = protocol === 'http:' || protocol === 'https:';
  } catch {
    valid = false;
  }
  if (!valid) return {ok: false, error: 'Address must be a valid http or https address'};
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  return {ok: true, link: {url: raw, title}};
}
