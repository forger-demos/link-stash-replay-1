const form = document.getElementById('save-form');
const urlInput = document.getElementById('url');
const titleInput = document.getElementById('title');
const button = document.getElementById('save');
const errorEl = document.getElementById('url-error');
const empty = document.getElementById('empty');
const list = document.getElementById('links');

function render(link) {
  const item = document.createElement('li');
  const a = document.createElement('a');
  a.href = link.url;
  a.textContent = link.title || link.url;
  a.rel = 'noopener noreferrer';
  item.append(a);
  return item;
}

function show(links) {
  list.replaceChildren(...links.map(render));
  empty.hidden = links.length > 0;
  list.hidden = links.length === 0;
}

const res = await fetch('/api/links');
show((await res.json()).links);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  button.disabled = true;
  errorEl.textContent = '';
  try {
    const saved = await fetch('/api/links', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({url: urlInput.value, title: titleInput.value}),
    });
    if (!saved.ok) {
      errorEl.textContent = (await saved.json()).error;
      return;
    }
    show((await (await fetch('/api/links')).json()).links);
    form.reset();
  } finally {
    button.disabled = false;
  }
});
