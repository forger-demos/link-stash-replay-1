import {Database} from 'bun:sqlite';
import {sameAddressKey} from './same-address';

const migrations: readonly string[] = [
  `CREATE TABLE links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE link_tags (
    link_id INTEGER NOT NULL REFERENCES links(id),
    tag TEXT NOT NULL,
    PRIMARY KEY (link_id, tag)
  )`,
  `CREATE TABLE share (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    token TEXT NOT NULL
  )`,
];

export function migrate(db: Database): void {
  const current = (db.query('PRAGMA user_version').get() as {user_version: number}).user_version;
  for (let version = current; version < migrations.length; version++) {
    db.transaction(() => {
      db.run(migrations[version] as string);
      db.run(`PRAGMA user_version = ${version + 1}`);
    })();
  }
}

export function openDatabase(path: string): Database {
  const db = new Database(path);
  migrate(db);
  return db;
}

export type Link = {id: number; url: string; title: string; created_at: string; tags: string[]};

type LinkRow = Omit<Link, 'tags'> & {tags: string | null};

const toLink = (row: LinkRow): Link => ({...row, tags: row.tags ? row.tags.split(',') : []});

export function addLink(db: Database, url: string, title: string, tags: string[] = []): Link {
  return db.transaction(() => {
    const row = db
      .query('INSERT INTO links (url, title) VALUES (?, ?) RETURNING id, url, title, created_at')
      .get(url, title) as Omit<Link, 'tags'>;
    for (const tag of tags) db.run('INSERT INTO link_tags (link_id, tag) VALUES (?, ?)', [row.id, tag]);
    return {...row, tags};
  })();
}

export function listLinks(db: Database, tag?: string, text?: string): Link[] {
  const rows = db
    .query(
      `SELECT l.id, l.url, l.title, l.created_at,
         (SELECT group_concat(tag, ',') FROM (SELECT tag FROM link_tags WHERE link_id = l.id ORDER BY tag)) AS tags
       FROM links l
       WHERE (?1 IS NULL OR EXISTS (SELECT 1 FROM link_tags t WHERE t.link_id = l.id AND t.tag = ?1))
         AND (?2 IS NULL OR instr(lower(l.title), ?2) > 0
              OR EXISTS (SELECT 1 FROM link_tags t WHERE t.link_id = l.id AND instr(t.tag, ?2) > 0))
       ORDER BY l.id DESC`,
    )
    .all(tag ?? null, text ?? null) as LinkRow[];
  return rows.map(toLink);
}

export function findSavedLink(db: Database, url: string): Link | undefined {
  const key = sameAddressKey(url);
  return listLinks(db).find((l) => sameAddressKey(l.url) === key);
}

export function currentShareToken(db: Database): string | undefined {
  return (db.query('SELECT token FROM share WHERE id = 1').get() as {token: string} | null)?.token;
}

export function makeShareToken(db: Database): string {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  db.run('INSERT INTO share (id, token) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET token = excluded.token', [token]);
  return token;
}
