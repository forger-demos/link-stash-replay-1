# link-stash

Save links, tag them, search them and share a list read-only.

A sample product built by the forger work loop. Owner requests are GitHub issues
labelled `ready-for-agent`, and the loop builds each one on its own branch. A PR
merges only when the gates in `.forger/workloop.config.json` and CI pass.

## What it does

- Save a link from the form on `/`: an address (http or https only) and an optional title.
- The list shows saved links newest first; a link with no title is listed by its address.
- Tag a link with a comma-separated field on save; tags are stored lower-case and trimmed and shown on each link. Selecting a tag filters the list to links carrying it, and "Clear filter" removes the filter.
- A search field above the list shows links whose title or any tag contains the text. Case is ignored. It combines with the tag filter, and an empty search shows every link. A search that matches nothing says "No links match" and the text.
- `POST /api/links` saves a link and `GET /api/links` lists them.
- `GET /api/links?tag=x` lists only the links with that tag.
- `GET /api/links?q=text` lists only the links matching the search text, and it combines with `tag`.
- Saving an address that is already stored is refused with status 409. The reply names the stored link by title and save date. Addresses that differ only in scheme or host case, a trailing slash or a fragment are the same. A refused address returns the field name and a message, and nothing is stored.
- "Make a share address" on `/` creates a path with a long random token (`/s/<token>`) and shows it. The page there lists the links with their tags and search. It has no form and no control that changes anything. Making another share address stops the old one, and an unknown token answers 404.
- `POST /api/share` makes a share address and `GET /api/share` returns the current one. Under `/s/`, `GET <share>/links` lists links (with `tag` and `q`), and every other method is refused with 405 and stores nothing.

## Develop

```
bun install
bun run check
bun run start
```

`bun run start` serves the page at `/` and the JSON API under `/api/` from one
Bun server, with SQLite (`bun:sqlite`) as the only database.

| Variable | Default | Meaning |
|----------|---------|---------|
| `LINK_STASH_DB` | `link-stash.db` | Path of the SQLite database file |
| `PORT` | `3000` | Port the server listens on |

The schema is created by numbered migrations in `src/storage.ts`. Tests use an
in-memory database and call the request handler directly, so they open no port.
