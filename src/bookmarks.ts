import {parseTags} from './validate';

export type Bookmark = {address: string; title: string; tags: string[]};

const entities: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'"};

const decode = (text: string): string => text.replace(/&(amp|lt|gt|quot|apos|#39);/gi, (_, name: string) => entities[name.toLowerCase()] as string);

const attribute = (attrs: string, name: string): string | undefined => {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === undefined ? undefined : decode(value);
};

// Browsers export folders as nested <DL> lists, each introduced by an <H3> heading.
const token = /<(\/?)(dl|h3|a)\b([^>]*)>|([^<]+)/gi;

export function parseBookmarks(html: string): Bookmark[] | undefined {
  const isExport = /<!DOCTYPE\s+NETSCAPE-Bookmark-file/i.test(html) || (/<dl\b/i.test(html) && /<a\s[^>]*href/i.test(html));
  if (!isExport) return undefined;

  const bookmarks: Bookmark[] = [];
  const folders: (string | undefined)[] = [];
  let pending: string | undefined;
  let open: {kind: 'h3' | 'a'; attrs: string; text: string} | undefined;

  for (const match of html.matchAll(token)) {
    const [, closing, rawName, attrs = '', text] = match;
    if (text !== undefined) {
      if (open) open.text += text;
      continue;
    }
    const name = (rawName as string).toLowerCase();
    if (name === 'dl') {
      if (closing) folders.pop();
      else {
        folders.push(pending);
        pending = undefined;
      }
    } else if (!closing) {
      open = {kind: name as 'h3' | 'a', attrs, text: ''};
    } else if (open?.kind === name) {
      const text = decode(open.text).trim();
      if (name === 'h3') pending = text;
      else bookmarks.push({address: (attribute(open.attrs, 'href') ?? '').trim(), title: text, tags: parseTags(folders.filter((f): f is string => !!f))});
      open = undefined;
    }
  }
  return bookmarks;
}
