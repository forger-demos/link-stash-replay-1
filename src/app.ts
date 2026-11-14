import type {Database} from 'bun:sqlite';
import {health} from './health';
import {addLink, findSavedLink, listLinks, type Link} from './storage';
import {parseNewLink} from './validate';

const publicDir = new URL('../public/', import.meta.url);

const json = (body: unknown, status = 200): Response => Response.json(body, {status});

const duplicateMessage = (link: Link): string =>
  `Already saved: ${link.title || link.url}, on ${link.created_at.slice(0, 10)}`;

export async function handle(req: Request, db: Database): Promise<Response> {
  const {pathname} = new URL(req.url);
  if (pathname === '/api/links' && req.method === 'POST') {
    const parsed = parseNewLink(await req.json().catch(() => null));
    if (!parsed.ok) return json({field: 'url', error: parsed.error}, 400);
    const saved = findSavedLink(db, parsed.link.url);
    if (saved) return json({field: 'url', error: duplicateMessage(saved), link: saved}, 409);
    return json(addLink(db, parsed.link.url, parsed.link.title, parsed.link.tags), 201);
  }
  if (req.method !== 'GET') return json({error: 'method not allowed'}, 405);
  if (pathname === '/api/health') return json(health());
  if (pathname === '/api/links') {
    const tag = new URL(req.url).searchParams.get('tag')?.trim().toLowerCase();
    return json({links: listLinks(db, tag || undefined)});
  }
  if (pathname.startsWith('/api/')) return json({error: 'not found'}, 404);

  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (name.split('/').includes('..')) return json({error: 'not found'}, 404);
  const file = Bun.file(new URL(name, publicDir));
  return (await file.exists()) ? new Response(file) : json({error: 'not found'}, 404);
}
