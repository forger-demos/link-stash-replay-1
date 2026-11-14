export function sameAddressKey(address: string): string {
  const u = new URL(address);
  u.hash = '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  const href = u.href;
  return u.pathname === '/' && u.search === '' ? href.replace(/\/$/, '') : href;
}
