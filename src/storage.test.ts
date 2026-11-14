import {expect, test} from 'bun:test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {addLink, listLinks, migrate, openDatabase} from './storage';

test('opens an in-memory database with the schema migrated', () => {
  const db = openDatabase(':memory:');
  expect(listLinks(db)).toEqual([]);
  db.run("INSERT INTO links (url) VALUES ('https://example.com')");
  expect(listLinks(db)).toHaveLength(1);
});

test('migrating twice leaves the schema and data alone', () => {
  const db = openDatabase(':memory:');
  db.run("INSERT INTO links (url) VALUES ('https://example.com')");
  migrate(db);
  expect(listLinks(db)).toHaveLength(1);
  expect((db.query('PRAGMA user_version').get() as {user_version: number}).user_version).toBe(3);
});

test('links are listed newest first', () => {
  const db = openDatabase(':memory:');
  addLink(db, 'https://a.test', '');
  addLink(db, 'https://b.test', 'B');
  expect(listLinks(db).map((l) => l.url)).toEqual(['https://b.test', 'https://a.test']);
});

test('links stored before a restart are still listed', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'link-stash-')), 'test.db');
  const first = openDatabase(path);
  addLink(first, 'https://a.test', 'A');
  first.close();
  expect(listLinks(openDatabase(path)).map((l) => l.url)).toEqual(['https://a.test']);
});
