export function renderLink(link, onTag) {
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
      chip.addEventListener('click', () => onTag(tag));
      tags.append(chip);
    }
    item.append(tags);
  }
  return item;
}
