import {expect, test} from 'bun:test';
import {parseNewLink} from './validate';

test('an http address with a title is accepted and trimmed', () => {
  expect(parseNewLink({url: ' http://a.test/x ', title: ' T '})).toEqual({
    ok: true,
    link: {url: 'http://a.test/x', title: 'T', tags: []},
  });
});

test('a missing title becomes empty', () => {
  expect(parseNewLink({url: 'https://a.test'})).toEqual({
    ok: true,
    link: {url: 'https://a.test', title: '', tags: []},
  });
});

test('other schemes, junk and non-objects are refused with a message naming the address', () => {
  for (const body of [{url: 'ftp://a.test'}, {url: 'javascript:alert(1)'}, {url: 'nope'}, {url: 5}, {}, null, 'x']) {
    const result = parseNewLink(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Address');
  }
});

test('tags are stored lower-case and trimmed, with no empty tag', () => {
  const result = parseNewLink({url: 'https://a.test', tags: ' Read , RUST,, ,read '});
  expect(result.ok && result.link.tags).toEqual(['read', 'rust']);
  expect(parseNewLink({url: 'https://a.test'})).toEqual({ok: true, link: {url: 'https://a.test', title: '', tags: []}});
});
