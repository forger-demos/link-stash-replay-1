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
let activeTag = '';

function render(link) {
  const item = document.createElement('li');
  const a = document.createElement('a');
  a.href = link.url;
  a.textContent = link.title || link.url;
  a.rel = 'noopener noreferrer';
  item.append(a);
  if (link.tags.length > 0) {
    const tags = document.createElement('span');
    tags.className = 'tags';
    for (const tag of link.tags) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tag';
      chip.textContent = tag;
      chip.addEventListener('click', () => load(tag));
      tags.append(chip);
    }
    item.append(tags);
  }
  return item;
}

function show(links) {
  list.replaceChildren(...links.map(render));
  empty.textContent = activeTag ? `No links tagged ${activeTag}` : emptyText;
  empty.hidden = links.length > 0;
  list.hidden = links.length === 0;
}

async function load(tag) {
  activeTag = tag;
  filterEl.hidden = !tag;
  filterLabel.textContent = tag ? `Showing links tagged ${tag}` : '';
  const query = tag ? `?tag=${encodeURIComponent(tag)}` : '';
  show((await (await fetch(`/api/links${query}`)).json()).links);
}

clearButton.addEventListener('click', () => load(''));
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
