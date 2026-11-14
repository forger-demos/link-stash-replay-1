import {renderLink} from '/list.js';

const form = document.getElementById('save-form');
const urlInput = document.getElementById('url');
const titleInput = document.getElementById('title');
const button = document.getElementById('save');
const errorEl = document.getElementById('url-error');
const empty = document.getElementById('empty');
const list = document.getElementById('links');
const tagsInput = document.getElementById('tags');
const filterEl = document.getElementById('filter');
const filterLabel = document.getElementById('filter-label');
const clearButton = document.getElementById('clear-filter');
const emptyText = empty.textContent;
const searchInput = document.getElementById('search');
let activeTag = '';
let activeText = '';

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

let latest = '';

async function load(tag) {
  activeTag = tag;
  filterEl.hidden = !tag;
  filterLabel.textContent = tag ? `Showing links tagged ${tag}` : '';
  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);
  if (activeText) params.set('q', activeText);
  const query = params.size > 0 ? `?${params}` : '';
  latest = query;
  const links = (await (await fetch(`/api/links${query}`)).json()).links;
  if (query === latest) show(links);
}

searchInput.addEventListener('input', () => {
  activeText = searchInput.value.trim();
  load(activeTag);
});
clearButton.addEventListener('click', () => load(''));

const shareButton = document.getElementById('share');
const shareAddress = document.getElementById('share-address');
const showShare = (path) => {
  shareAddress.hidden = !path;
  if (!path) return;
  const url = new URL(path, location.origin).href;
  shareAddress.replaceChildren('Read-only address: ', Object.assign(document.createElement('a'), {href: url, textContent: url}));
  shareButton.textContent = 'Make a new share address';
};
showShare((await (await fetch('/api/share')).json()).path);
shareButton.addEventListener('click', async () => {
  shareButton.disabled = true;
  try {
    showShare((await (await fetch('/api/share', {method: 'POST'})).json()).path);
  } finally {
    shareButton.disabled = false;
  }
});
await load('');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  button.disabled = true;
  errorEl.textContent = '';
  try {
    const saved = await fetch('/api/links', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({url: urlInput.value, title: titleInput.value, tags: tagsInput.value}),
    });
    if (!saved.ok) {
      errorEl.textContent = (await saved.json()).error;
      return;
    }
    form.reset();
    await load(activeTag);
  } finally {
    button.disabled = false;
  }
});

const importInput = document.getElementById('import-file');
const importResult = document.getElementById('import-result');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
importInput.addEventListener('change', async () => {
  const file = importInput.files[0];
  if (!file) return;
  importInput.disabled = true;
  importResult.hidden = true;
  importResult.classList.remove('error');
  try {
    const res = await fetch('/api/import', {method: 'POST', body: await file.text()});
    const body = await res.json();
    if (!res.ok) {
      importResult.textContent = body.error;
      importResult.classList.add('error');
    } else {
      const {duplicate, invalidAddress} = body.skipped;
      const reasons = [];
      if (duplicate) reasons.push(`${plural(duplicate, 'was', 'were')} already saved`);
      if (invalidAddress) reasons.push(`${plural(invalidAddress, 'address was', 'addresses were')} not http or https`);
      const skipped = duplicate + invalidAddress;
      importResult.textContent = `${body.added} added, ${skipped} skipped${reasons.length ? `: ${reasons.join(', ')}` : ''}`;
      await load(activeTag);
    }
    importResult.hidden = false;
  } finally {
    importInput.value = '';
    importInput.disabled = false;
  }
});
