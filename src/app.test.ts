import {expect, test} from 'bun:test';
import {handle} from './app';
import {Database} from 'bun:sqlite';
import {listLinks, migrate, openDatabase} from './storage';

const get = (path: string, method = 'GET', db = openDatabase(':memory:')) =>
  handle(new Request(`http://test${path}`, {method}), db);

const post = (db: Database, body: string) =>
  handle(new Request('http://test/api/links', {method: 'POST', body}), db);

test('health returns ok', async () => {
  const res = await get('/api/health');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ok: true});
});

test('links are listed empty at first', async () => {
  expect(await (await get('/api/links')).json()).toEqual({links: []});
});

test('a saved link is returned first by GET /api/links', async () => {
  const db = openDatabase(':memory:');
  expect((await post(db, JSON.stringify({url: 'https://a.test', title: 'A'}))).status).toBe(201);
  await post(db, JSON.stringify({url: 'https://b.test', title: 'B'}));
  const {links} = (await (await get('/api/links', 'GET', db)).json()) as {links: {url: string}[]};
  expect(links.map((l) => l.url)).toEqual(['https://b.test', 'https://a.test']);
});

test('an address that is not http or https is refused and nothing is stored', async () => {
  const db = openDatabase(':memory:');
  const res = await post(db, JSON.stringify({url: 'ftp://a.test'}));
  expect(res.status).toBe(400);
  const body = (await res.json()) as {field: string; error: string};
  expect(body.field).toBe('url');
  expect(body.error).toContain('Address');
  expect((await post(db, 'not json')).status).toBe(400);
  expect(listLinks(db)).toEqual([]);
});

test('a link saved with no title is listed by its address', async () => {
  const db = openDatabase(':memory:');
  await post(db, JSON.stringify({url: 'https://a.test'}));
  expect(await (await get('/api/links', 'GET', db)).text()).toContain('"title":""');
  const html = await (await get('/app.js')).text();
  expect(html).toContain('link.title || link.url');
});

test('unknown api paths are 404', async () => {
  expect((await get('/api/nope')).status).toBe(404);
});

test('non-GET requests are rejected', async () => {
  expect((await get('/nope', 'DELETE')).status).toBe(405);
});

test('root serves the Link stash page with its empty state', async () => {
  const res = await get('/');
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain('<title>Link stash</title>');
  expect(html).toContain('No links saved yet');
});

test('static assets are served from public', async () => {
  expect((await get('/style.css')).status).toBe(200);
});

test('missing files and path traversal are 404', async () => {
  expect((await get('/missing.txt')).status).toBe(404);
  expect((await get('/../package.json')).status).toBe(404);
});

test('GET /api/links with a tag returns only the links that carry it', async () => {
  const db = openDatabase(':memory:');
  await post(db, JSON.stringify({url: 'https://a.test', tags: 'Rust, Web'}));
  await post(db, JSON.stringify({url: 'https://b.test', tags: 'web'}));
  await post(db, JSON.stringify({url: 'https://c.test'}));
  const urls = async (q: string) =>
    ((await (await get(`/api/links${q}`, 'GET', db)).json()) as {links: {url: string}[]}).links.map((l) => l.url);
  expect(await urls('?tag=rust')).toEqual(['https://a.test']);
  expect(await urls('?tag=WEB')).toEqual(['https://b.test', 'https://a.test']);
  expect(await urls('?tag=none')).toEqual([]);
  expect(await urls('')).toHaveLength(3);
});

test('a link saved before tags existed is listed with no tags', () => {
  const db = new Database(':memory:');
  db.run("CREATE TABLE links (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  db.run("INSERT INTO links (url) VALUES ('https://old.test')");
  db.run('PRAGMA user_version = 1');
  migrate(db);
  expect(listLinks(db).map((l) => [l.url, l.tags])).toEqual([['https://old.test', []]]);
});

const countLinks = (db: Database) => listLinks(db).length;

test('saving the same address twice is refused with status 409 and the stored link', async () => {
  const db = openDatabase(':memory:');
  await post(db, JSON.stringify({url: 'https://a.test/x', title: 'First'}));
  const res = await post(db, JSON.stringify({url: 'https://a.test/x', title: 'Second'}));
  expect(res.status).toBe(409);
  const body = (await res.json()) as {error: string; link: {title: string; url: string}};
  expect(body.link.title).toBe('First');
  expect(body.error).toMatch(/^Already saved: First, on \d{4}-\d{2}-\d{2}$/);
});

test('addresses that differ only in host case, a trailing slash or a fragment count as the same', async () => {
  const db = openDatabase(':memory:');
  await post(db, JSON.stringify({url: 'https://a.test/x'}));
  for (const url of ['https://A.TEST/x', 'https://a.test/x/', 'https://a.test/x#frag']) {
    expect((await post(db, JSON.stringify({url}))).status).toBe(409);
  }
});

test('addresses that differ in their path or query are both saved', async () => {
  const db = openDatabase(':memory:');
  for (const url of ['https://a.test/x', 'https://a.test/y', 'https://a.test/x?q=1']) {
    expect((await post(db, JSON.stringify({url}))).status).toBe(201);
  }
  expect(countLinks(db)).toBe(3);
});

test('a refused duplicate stores nothing', async () => {
  const db = openDatabase(':memory:');
  await post(db, JSON.stringify({url: 'https://a.test', tags: 'x'}));
  await post(db, JSON.stringify({url: 'https://a.test/', tags: 'y'}));
  expect(countLinks(db)).toBe(1);
  expect(listLinks(db)[0]?.tags).toEqual(['x']);
  expect((db.query('SELECT count(*) AS n FROM link_tags').get() as {n: number}).n).toBe(1);
});
