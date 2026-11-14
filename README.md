# link-stash

Save links, tag them, search them and share a list read-only.

A sample product built by the forger work loop. Owner requests are GitHub issues
labelled `ready-for-agent`, and the loop builds each one on its own branch. A PR
merges only when the gates in `.forger/workloop.config.json` and CI pass.

## What it does

- Save a link from the form on `/`: an address (http or https only) and an optional title.
- The list shows saved links newest first; a link with no title is listed by its address.
- Tag a link with a comma-separated field on save; tags are stored lower-case and trimmed and shown on each link. Selecting a tag filters the list to links carrying it, and "Clear filter" removes the filter.
- `POST /api/links` saves a link; `GET /api/links` lists them, and `GET /api/links?tag=x` lists only the links with that tag. A refused address returns the field name and a message, and nothing is stored.

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
