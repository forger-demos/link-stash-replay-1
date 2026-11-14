import {renderLink} from '/list.js';

const base = location.pathname.replace(/\/$/, '');
const empty = document.getElementById('empty');
const list = document.getElementById('links');
const filterEl = document.getElementById('filter');
const filterLabel = document.getElementById('filter-label');
const searchInput = document.getElementById('search');
const emptyText = empty.textContent;
let activeTag = '';
let activeText = '';
let latest = '';

function show(links) {
  list.replaceChildren(...links.map((link) => renderLink(link, load)));
  empty.textContent = activeText
    ? `No links match ${activeText}`
    : activeTag
      ? `No links tagged ${activeTag}`
      : emptyText;
  empty.hidden = links.length > 0;
  list.hidden = links.length === 0;
}

async function load(tag) {
  activeTag = tag;
  filterEl.hidden = !tag;
  filterLabel.textContent = tag ? `Showing links tagged ${tag}` : '';
  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);
  if (activeText) params.set('q', activeText);
  const query = params.size > 0 ? `?${params}` : '';
  latest = query;
  const links = (await (await fetch(`${base}/links${query}`)).json()).links;
  if (query === latest) show(links);
}

searchInput.addEventListener('input', () => {
  activeText = searchInput.value.trim();
  load(activeTag);
});
document.getElementById('clear-filter').addEventListener('click', () => load(''));
await load('');
