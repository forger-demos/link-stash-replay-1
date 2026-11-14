import type {Database} from 'bun:sqlite';
import {health} from './health';
import {addLink, currentShareToken, findSavedLink, listLinks, makeShareToken, type Link} from './storage';
import {parseNewLink} from './validate';

const publicDir = new URL('../public/', import.meta.url);

const json = (body: unknown, status = 200): Response => Response.json(body, {status});

const sharePath = (token: string): string => `/s/${token}`;

const queryLinks = (db: Database, params: URLSearchParams): Link[] => {
  const tag = params.get('tag')?.trim().toLowerCase();
  const text = params.get('q')?.trim().toLowerCase();
  return listLinks(db, tag || undefined, text || undefined);
};

// A share address is a capability: the token must never reach another site, and no method but GET is served.
async function handleShared(req: Request, db: Database, rest: string[], params: URLSearchParams): Promise<Response> {
  const [token, ...tail] = rest;
  if (req.method !== 'GET') return json({error: 'This shared list is read-only'}, 405);
  if (!token || token !== currentShareToken(db)) return json({error: 'not found'}, 404);
  const headers = {'referrer-policy': 'no-referrer', 'cache-control': 'no-store'};
  if (tail.length === 0) return new Response(Bun.file(new URL('shared.html', publicDir)), {headers});
  if (tail.length === 1 && tail[0] === 'links') return Response.json({links: queryLinks(db, params)}, {headers});
  return json({error: 'not found'}, 404);
}

const duplicateMessage = (link: Link): string =>
  `Already saved: ${link.title || link.url}, on ${link.created_at.slice(0, 10)}`;

export async function handle(req: Request, db: Database): Promise<Response> {
  const {pathname, searchParams} = new URL(req.url);
  if (pathname.startsWith('/s/')) return handleShared(req, db, pathname.slice(3).split('/'), searchParams);
  if (pathname === '/api/links' && req.method === 'POST') {
    const parsed = parseNewLink(await req.json().catch(() => null));
    if (!parsed.ok) return json({field: 'url', error: parsed.error}, 400);
    const saved = findSavedLink(db, parsed.link.url);
    if (saved) return json({field: 'url', error: duplicateMessage(saved), link: saved}, 409);
    return json(addLink(db, parsed.link.url, parsed.link.title, parsed.link.tags), 201);
  }
  if (pathname === '/api/share' && req.method === 'POST') return json({path: sharePath(makeShareToken(db))}, 201);
  if (pathname === '/api/share' && req.method === 'POST') return json({path: sharePath(makeShareToken(db))}, 201);
  if (req.method !== 'GET') return json({error: 'method not allowed'}, 405);
  if (pathname === '/api/health') return json(health());
  if (pathname === '/api/links') return json({links: queryLinks(db, searchParams)});
  if (pathname === '/api/share') {
    const token = currentShareToken(db);
    return json({path: token ? sharePath(token) : null});
  }
  if (pathname.startsWith('/api/')) return json({error: 'not found'}, 404);

  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (name.split('/').includes('..')) return json({error: 'not found'}, 404);
  const file = Bun.file(new URL(name, publicDir));
  return (await file.exists()) ? new Response(file) : json({error: 'not found'}, 404);
}
