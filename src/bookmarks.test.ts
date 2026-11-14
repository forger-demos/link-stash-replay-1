import {expect, test} from 'bun:test';
import {handle} from './app';
import {parseBookmarks} from './bookmarks';
import {addLink, listLinks, openDatabase} from './storage';

const sample = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><A HREF="https://top.test/">Top &amp; level</A>
  <DT><H3>Dev</H3>
  <DL><p>
    <DT><A HREF="https://dev.test/a" ADD_DATE="1">Dev A</A>
    <DT><H3>Rust</H3>
    <DL><p>
      <DT><A HREF="https://rust.test/">Rust</A>
    </DL><p>
  </DL><p>
  <DT><H3>News</H3>
  <DL><p>
    <DT><A HREF="https://news.test/">News</A>
  </DL><p>
</DL><p>`;

const imp = (db: ReturnType<typeof openDatabase>, body: string) =>
  handle(new Request('http://test/api/import', {method: 'POST', body}), db);

test('a bookmarks file with nested folders imports each link with its folder names as tags', async () => {
  const db = openDatabase(':memory:');
  const res = await imp(db, sample);
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({added: 4, skipped: {duplicate: 0, invalidAddress: 0}});
  const byUrl = Object.fromEntries(listLinks(db).map((l) => [l.url, l]));
  expect(byUrl['https://top.test/']).toMatchObject({title: 'Top & level', tags: []});
  expect(byUrl['https://dev.test/a']?.tags).toEqual(['dev']);
  expect(byUrl['https://rust.test/']?.tags).toEqual(['dev', 'rust']);
  expect(byUrl['https://news.test/']?.tags).toEqual(['news']);
});

test('a bookmark already saved is skipped and counted', async () => {
  const db = openDatabase(':memory:');
  addLink(db, 'https://news.test', 'Saved');
  const res = await imp(db, sample + sample);
  expect(await res.json()).toEqual({added: 3, skipped: {duplicate: 5, invalidAddress: 0}});
  expect(listLinks(db)).toHaveLength(4);
  expect(listLinks(db).find((l) => l.url === 'https://news.test')?.title).toBe('Saved');
});

test('a bookmark whose address is not http or https is skipped and counted', async () => {
  const db = openDatabase(':memory:');
  const file = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><A HREF="javascript:alert(1)">Bad</A>
    <DT><A HREF="ftp://x.test/">Ftp</A>
    <DT><A>No address</A>
    <DT><A HREF='https://ok.test/'>Ok</A></DL>`;
  expect(await (await imp(db, file)).json()).toEqual({added: 1, skipped: {duplicate: 0, invalidAddress: 3}});
  expect(listLinks(db).map((l) => l.url)).toEqual(['https://ok.test/']);
});

test('a file that is not a bookmarks file is refused and nothing is stored', async () => {
  const db = openDatabase(':memory:');
  for (const body of ['', 'hello', '<html><body><a href="https://a.test">a</a></body></html>', '{"url":"https://a.test"}']) {
    const res = await imp(db, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({error: 'This is not a bookmarks file'});
  }
  expect(listLinks(db)).toEqual([]);
});

test('parseBookmarks accepts a list without the doctype and ignores stray markup', () => {
  expect(parseBookmarks('<dl><dt><a href="https://a.test">A</a><dl></dl></dl><!-- -->')).toEqual([
    {address: 'https://a.test', title: 'A', tags: []},
  ]);
});

test('the page offers an import control with its states', async () => {
  const db = openDatabase(':memory:');
  const html = await (await handle(new Request('http://test/'), db)).text();
  expect(html).toContain('id="import-file"');
  const js = await (await handle(new Request('http://test/app.js'), db)).text();
  expect(js).toContain('importInput.disabled = true');
  expect(js).toContain('added, ${skipped} skipped');
});
