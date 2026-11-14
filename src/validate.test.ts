import {expect, test} from 'bun:test';
import {parseNewLink} from './validate';

test('an http address with a title is accepted and trimmed', () => {
  expect(parseNewLink({url: ' http://a.test/x ', title: ' T '})).toEqual({
    ok: true,
    link: {url: 'http://a.test/x', title: 'T'},
  });
});

test('a missing title becomes empty', () => {
  expect(parseNewLink({url: 'https://a.test'})).toEqual({ok: true, link: {url: 'https://a.test', title: ''}});
});

test('other schemes, junk and non-objects are refused with a message naming the address', () => {
  for (const body of [{url: 'ftp://a.test'}, {url: 'javascript:alert(1)'}, {url: 'nope'}, {url: 5}, {}, null, 'x']) {
    const result = parseNewLink(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Address');
  }
});
