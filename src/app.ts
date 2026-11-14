import type {Database} from 'bun:sqlite';
import {health} from './health';
import {addLink, listLinks} from './storage';
import {parseNewLink} from './validate';

const publicDir = new URL('../public/', import.meta.url);

const json = (body: unknown, status = 200): Response => Response.json(body, {status});

export async function handle(req: Request, db: Database): Promise<Response> {
  const {pathname} = new URL(req.url);
  if (pathname === '/api/links' && req.method === 'POST') {
    const parsed = parseNewLink(await req.json().catch(() => null));
    if (!parsed.ok) return json({field: 'url', error: parsed.error}, 400);
    return json(addLink(db, parsed.link.url, parsed.link.title), 201);
  }
  if (req.method !== 'GET') return json({error: 'method not allowed'}, 405);
  if (pathname === '/api/health') return json(health());
  if (pathname === '/api/links') return json({links: listLinks(db)});
  if (pathname.startsWith('/api/')) return json({error: 'not found'}, 404);

  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (name.split('/').includes('..')) return json({error: 'not found'}, 404);
  const file = Bun.file(new URL(name, publicDir));
  return (await file.exists()) ? new Response(file) : json({error: 'not found'}, 404);
}
