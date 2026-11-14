import {expect, test} from 'bun:test';
import {handle} from './app';
import type {Database} from 'bun:sqlite';
import {listLinks, openDatabase} from './storage';

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
