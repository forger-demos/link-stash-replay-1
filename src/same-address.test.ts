import {expect, test} from 'bun:test';
import {sameAddressKey} from './same-address';

test('addresses that differ only in host case, a trailing slash or a fragment count as the same', () => {
  const base = sameAddressKey('https://a.test/x');
  expect(sameAddressKey('HTTPS://A.Test/x')).toBe(base);
  expect(sameAddressKey('https://a.test/x/')).toBe(base);
  expect(sameAddressKey('https://a.test/x#top')).toBe(base);
  expect(sameAddressKey('https://A.test')).toBe(sameAddressKey('https://a.test/#frag'));
});

test('addresses that differ in their path or query are different', () => {
  const keys = ['https://a.test/x', 'https://a.test/y', 'https://a.test/x?q=1', 'https://a.test/x?q=2', 'http://a.test/x'];
  expect(new Set(keys.map(sameAddressKey)).size).toBe(keys.length);
});
