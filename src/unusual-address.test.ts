import {afterAll, beforeAll, expect, test} from 'bun:test';
import {chromium, type Browser, type Page} from 'playwright';
import {handle} from './app';
import {addLink, openDatabase} from './storage';

const db = openDatabase(':memory:');
const server = Bun.serve({port: 0, fetch: (req) => handle(req, db)});
const origin = `http://localhost:${server.port}`;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({viewport: {width: 480, height: 800}});
});
afterAll(async () => {
  await browser.close();
  server.stop(true);
});

const listed = async (url: string, title: string) => {
  db.run('DELETE FROM links');
  addLink(db, url, title);
  await page.goto(origin);
  await page.waitForSelector('#links li a');
  return page.locator('#links li a').first();
};

test('a link whose address holds a quote, an angle bracket and an ampersand is listed with its address intact', async () => {
  const url = 'https://a.test/p?x="1"&y=<b>&z=a&amp;b';
  const a = await listed(url, '');
  expect(await a.textContent()).toBe(url);
  expect(await page.locator('#links li').count()).toBe(1);
  expect(await a.evaluate((el) => (el as HTMLAnchorElement).href)).toBe(new URL(url).href);
});

test('a link whose title holds markup is shown as text', async () => {
  const title = '<img src=x onerror="window.pwned=1"><b>bold</b> & "q"';
  const a = await listed('https://a.test/', title);
  expect(await a.textContent()).toBe(title);
  expect(await page.locator('#links img, #links b').count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as {pwned?: number}).pwned)).toBeUndefined();
});

test('a link with non-ASCII letters in its address opens the same address', async () => {
  const url = 'https://ex\u00e4mple.test/stra\u00dfe/\u65e5\u672c\u8a9e?q=\u00f1and\u00fa';
  const a = await listed(url, 'Unicode');
  const href = await a.evaluate((el) => (el as HTMLAnchorElement).href);
  expect(href).toBe(new URL(url).href);
  expect(decodeURIComponent(new URL(href).pathname)).toBe('/stra\u00dfe/\u65e5\u672c\u8a9e');
});

test('an address longer than the list is wide does not push the list out of its column', async () => {
  await listed(`https://a.test/${'a'.repeat(400)}`, '');
  const overflow = await page.evaluate(() => {
    const li = document.querySelector('#links li') as HTMLElement;
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      row: li.scrollWidth - li.clientWidth,
    };
  });
  expect(overflow.page).toBeLessThanOrEqual(0);
  expect(overflow.row).toBeLessThanOrEqual(0);
});
