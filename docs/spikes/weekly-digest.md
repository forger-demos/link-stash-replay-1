## Question

"How should the product send a weekly digest."

## Findings

**What exists.** The product stores links (address, title, tags) with the time each was saved, in one SQLite database behind one Bun server. Nothing sends anything: there is no outbound network call, no scheduler, no notion of a person, and no email address anywhere in the stored shapes. A read-only share address (`/s/<token>`) already exists, as a capability URL.

**What the digest holds.** The links saved in the previous seven days, newest first, each with title (address when untitled), tags and the address itself. A header states the period covered. A week with no new links sends nothing: an empty digest is noise and costs a send. A long week is cut to a fixed maximum of links, with a line saying how many more exist and a link to the shared list.

**Who it goes to.** There are no accounts, so the recipient is whoever the owner of the list names. One subscription holds an email address, a confirmed flag and a random unsubscribe token. Subscribing sends a confirmation message first, and nothing else is sent until the address is confirmed. Every digest carries a one-click unsubscribe link that works with no login, the same capability-token pattern as the share address. Subscriptions are never shown on the shared read-only page.

**How it is sent.** Three options were weighed.

| Option | For | Against |
|---|---|---|
| Hosted transactional email API called over HTTPS | No mail server to run; handles deliverability, bounces and signing | A secret key to hold; an external dependency; a per-message cost beyond a free tier |
| SMTP relay from the server | Provider-neutral | Deliverability, retries and bounce handling become ours |
| Self-hosted mail server | No third party | Highest operating burden; poor deliverability for a small sender |

Recommendation: a hosted transactional email API behind a small `Mailer` interface (`send(to, subject, text, html)`), injected like the other seams so tests use a recording double and no test touches the network. The API key comes from an environment variable and is documented next to `LINK_STASH_DB` and `PORT` in the README; with the variable unset the digest feature is off and the server behaves as today.

**How it is scheduled.** The server process is not guaranteed to be running at a given hour, so an in-process timer alone is not enough. Recommendation: the send is a single idempotent command, `bun src/digest.ts`, run by an external scheduler (system cron or the host's scheduled job) once a week. It records, per subscription, the end of the last period it sent, so running it twice in a week, or after a missed week, never double-sends and never skips links: the next send covers everything since the recorded time, capped as above. The period boundary is computed by a pure function of "now" and the last-sent time so it is tested without a clock. Times are stored and compared in UTC; the send hour is a deployment choice, not product behaviour.

**What it costs to run.** One scheduled invocation per week plus one confirmation message per new subscription. The work per run is one indexed query on the saved time per subscription and one message per subscription with something to send; this is trivial against SQLite at this scale. The real cost is the email provider's per-message price above any free tier, which grows only with subscriptions, not with links. A saved-time index is the only schema addition needed for the query.

**What must exist first.**

1. A stored `saved_at` that is reliable for every link, including imported ones. Verify before building, since an import may stamp the import time rather than the bookmark's own time; the digest should treat the stored time as the truth and say so.
2. A subscription table and the `Mailer` seam.
3. A decision on the sending domain and its sender and reply addresses, which only the owner can supply, and the provider account and key.
4. A public base URL setting, so links to the shared list and to unsubscribe are absolute.

**Risks.** Sending to an address nobody confirmed (mitigated by confirmation first); a leaked unsubscribe token (it can only unsubscribe, never read links); a scheduler that fires twice (mitigated by the recorded period end); the provider being down (the run exits non-zero and the next run covers the missed period, since the period end only advances after a successful send).

## Thresholds

| Quantity | Value | Unit | Tolerance | Source |
|---|---|---|---|---|
| `period` | 7 | days | 0 | Owner request: "weekly" |
| `max-links` | 50 | links per digest | 0 | Decision of this spike; keeps a message readable, remainder is a count and a link |
| `min-links` | 1 | links needed to send | 0 | Decision of this spike; an empty week sends nothing |
| `sends-per-subscription` | 1 | digests per period | 0 | Decision of this spike; enforced by the recorded period end |
| `confirm-before-send` | 0 | digests sent to an unconfirmed address | 0 | Decision of this spike |
| `unsubscribe-effect` | 0 | digests sent after unsubscribing | 0 | Decision of this spike; applies from the next run |
| `network-in-tests` | 0 | real network calls in the test run | 0 | Existing practice: seams are injected, tests use doubles |

A build ticket's criterion cites a row by its quantity, as in "within the `max-links` row of the thresholds table in the spike".

## Build tickets

Each ticket is a vertical slice. The owner must first supply the provider choice, sender address and base URL (the "what must exist first" list); until then the tickets that send are blocked on the owner.

1. **Subscribe by email address, with confirmation.**
   - Test: `POST /api/subscriptions` with a valid address returns 201 and stores an unconfirmed subscription; a malformed address returns 400 and stores nothing.
   - Test: a confirmation message is handed to the recording `Mailer` double exactly once per subscribe, and following its confirmation link marks the subscription confirmed.
   - Test: per the `confirm-before-send` row, an unconfirmed subscription receives no digest.
   - Test: the shared read-only page and `GET /api/links` never include any subscription data.
   - Command: `bun run check` exits 0.

2. **Build the digest from the saved links (pure).**
   - Test: given links with saved times, `buildDigest(links, now)` includes exactly the links saved within the `period` row, newest first, and none outside it.
   - Test: more links than the `max-links` row yields that many entries plus a count of the rest.
   - Test: fewer links than the `min-links` row yields no digest.
   - Test: an untitled link is listed by its address, and titles and tags are escaped in the HTML part.

3. **Send the digest once per period.**
   - Test: `bun src/digest.ts` against a database with one confirmed subscription and links in the period hands one message to the `Mailer` double and records the period end; running it again immediately sends nothing, per the `sends-per-subscription` row.
   - Test: when the `Mailer` double fails, the command exits non-zero and the period end is unchanged, so the next run covers the same links.
   - Test: with the provider key unset, the command exits 0 and sends nothing.
   - Test: per the `network-in-tests` row, the run makes no real network call.
   - Docs: README documents the command, the scheduler line to use and the new environment variables.

4. **Unsubscribe with one click.**
   - Test: `GET /unsubscribe/<token>` marks the subscription ended and answers 200 with a page that has no other control; an unknown token answers 404.
   - Test: per the `unsubscribe-effect` row, the next run of the command sends that address nothing.
   - Test: every digest body contains the unsubscribe link for its own subscription and no other.

5. **Verify stored save times for imported links** (precondition, may be closed as no change).
   - Command: a test imports a bookmarks file whose entries carry `ADD_DATE` and asserts which time is stored; the ticket's criterion is that the digest's period is judged on the same time the list shows as the save date.
