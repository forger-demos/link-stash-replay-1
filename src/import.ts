import type {Database} from 'bun:sqlite';
import type {Bookmark} from './bookmarks';
import {addLink, findSavedLink} from './storage';
import {parseNewLink} from './validate';

export type ImportResult = {added: number; skipped: {duplicate: number; invalidAddress: number}};

export function importBookmarks(db: Database, bookmarks: Bookmark[]): ImportResult {
  const result: ImportResult = {added: 0, skipped: {duplicate: 0, invalidAddress: 0}};
  db.transaction(() => {
    for (const b of bookmarks) {
      const parsed = parseNewLink({url: b.address, title: b.title, tags: b.tags});
      if (!parsed.ok) result.skipped.invalidAddress++;
      else if (findSavedLink(db, parsed.link.url)) result.skipped.duplicate++;
      else {
        addLink(db, parsed.link.url, parsed.link.title, parsed.link.tags);
        result.added++;
      }
    }
  })();
  return result;
}
