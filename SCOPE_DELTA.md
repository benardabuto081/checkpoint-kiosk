# Scope Delta Analysis
**Checkpoint Kiosk — Solstice Events Co. — Meridian Pivot, Day 4-5**

## The Pivot

Solstice's badge-printer vendor deprecated its synchronous print API
with 48 hours' notice, no deadline extension. The kiosk service had
to be rebuilt around an asynchronous model: publish a print request
to the vendor's queue instead of calling and waiting, and receive
completion via a webhook instead of an immediate response.

## Dropped

- **Synchronous `/vendor/print` endpoint** — called the mock vendor
  and blocked until it responded. No longer viable once the vendor
  killed this model. Fully removed from the live codebase (not
  commented out) - original implementation preserved at commit
  `49ff915`.
- **Synchronous `/checkin` logic** — the version that waited for the
  vendor's response before updating attendee status. Replaced
  entirely by the async version below.

## Modified

- **`/checkin` endpoint** — same URL and method, completely different
  behavior. Before: blocked for ~1.5s, returned final success/failure.
  After: returns instantly with `{ accepted, status: "pending",
  requestId }`, actual result arrives later via webhook.
- **Duplicate-scan guard** — before, only blocked attendees already
  `checked_in`. After, also blocks attendees currently `pending`,
  since a first scan may still be in flight under the async model.
  This was a deliberate strengthening required by the pivot, not
  optional - without it, an attendee could trigger two concurrent
  print requests while the first was still processing.
- **Attendee status field** — gained a third state. Before: only
  `not_checked_in` / `checked_in`. After: `not_checked_in` / `pending`
  / `checked_in`.

## Added

- **`POST /vendor/print-jobs`** — accepts a print request instantly,
  queues it internally, does not block the caller.
- **In-memory queue worker** — processes queued jobs after a randomized
  delay (1-5s), deliberately variable so confirmations can arrive out
  of order, matching the real-world constraint the brief calls out.
- **`POST /webhooks/print-complete`** — the callback endpoint. Verifies
  a shared-secret signature before trusting any payload, then confirms
  the `requestId` matches a real, previously-issued request in the
  `print_requests` table before updating attendee status. This double
  check (signature + known request) is a real defense against both a
  forged sender and a stale/replayed callback for an unrelated request.
- **`print_requests` table** — tracks every published request by its
  unique ID, which is how confirmations get matched to the correct
  attendee regardless of arrival order.
- **`GET /checkin/:attendeeId/status`** — new endpoint for the
  frontend to poll, since results no longer arrive synchronously.

## Regression Check

Re-ran the original 3 test attendees under the new async model after
the pivot:
- A001 (fresh) - scanned, went pending, resolved to checked_in
  correctly via webhook.
- A002 (fresh) - same result, confirming a second concurrent
  request resolves independently and correctly.
- A003 (pre-seeded as checked_in) - still correctly blocked (409)
  under the new model, confirming already-checked-in attendees
  remain protected after the pivot.

Duplicate-scan protection verified specifically against the new
failure mode the pivot introduced: re-scanning while a request is
still `pending` (not just while `checked_in`) is correctly blocked.

Out-of-order confirmation handling verified live: two requests
published back-to-back resolved via webhook in a randomized, provably
non-arrival order, with each attendee correctly updated to match
their own request, not "whoever confirmed most recently."

## What This Cost

- Backend rebuild time: roughly approximately 3 hours, from first async endpoint through full regression testing
- No functional regression in the original 3 test cases
- Trade-off accepted: the mock vendor and webhook receiver live in
  the same process for this exercise (no real external vendor
  exists) - in a real deployment, the shared-secret signature check
  would need a more robust scheme (e.g. HMAC over the payload) rather
  than a static header value, since a real third party can't share
  process memory with us the way this simulation does.
