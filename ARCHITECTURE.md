# Checkpoint Kiosk — Architecture, Blueprint & Roadmap
**Solstice Events Co. — PLP Group 90, Meridian Pivot — Individual Submission (Bernard)**

## What this is

An event check-in kiosk for a multi-day tech conference. Staff scan
an attendee's QR code, the system triggers a badge print, and shows
"Checked In" once printing succeeds. Built first against a
synchronous vendor API, then rebuilt around an asynchronous
message-queue + webhook model after a non-negotiable mid-sprint
client pivot.

This is solo, full-stack work — I own every layer: backend, database,
mock vendor, webhook receiver, and frontend.

## Tech Stack

- Node.js + Express — backend, mock vendor, webhook receiver
- PostgreSQL — attendee/check-in data
- Plain HTML/CSS/JS — kiosk frontend, no framework
- No real message broker — the vendor's "queue" is simulated as an
  in-process array with a delayed worker (setTimeout), realistic
  enough to prove the concept without real infrastructure

## Phase A — Original Spec (Synchronous)

    Staff scans QR code
          |
    Frontend -> POST /checkin { attendeeId }
          |
    Backend: duplicate-scan guard (blocks if already checked_in)
          |
    Backend -> POST /vendor/print { attendeeId }  [WAITS for response]
          |
    Mock vendor simulates a delay, responds { success }
          |
    If success: attendee marked checked_in, response sent to frontend
          |
    Frontend shows "Checked In"

### Phase A Contracts

POST /checkin
  Request:  { attendeeId }
  Response: { success: true/false, status }

POST /vendor/print
  Request:  { attendeeId }
  Response: { success: true/false }

## Phase B — After the Pivot (Asynchronous)

    Staff scans QR code
          |
    Frontend -> POST /checkin { attendeeId }
          |
    Backend: duplicate-scan guard (now blocks if PENDING or
    checked_in - a first scan may still be in flight)
          |
    Backend generates a unique requestId, publishes to mock vendor's
    queue: POST /vendor/print-jobs { attendeeId, requestId }
      -> immediate { accepted: true }, backend does NOT wait
          |
    Backend marks attendee "pending", responds to frontend right away
          |
    Frontend shows "Pending", begins polling for status
          |
    [TIME PASSES - simulated delay in mock vendor's worker]
          |
    Mock vendor's worker "finishes printing", calls own webhook:
      POST /webhooks/print-complete { requestId, attendeeId, success }
      + signature header (self-verified against a shared secret)
          |
    Webhook handler verifies signature, then updates the correct
    attendee BY requestId (not "whoever scanned last" - confirmations
    can arrive out of order)
          |
    Frontend polling picks up the updated status, shows "Checked In"

### Phase B Contracts

POST /checkin
  Request:  { attendeeId }
  Response: { accepted: true, status: "pending" }

GET /checkin/:attendeeId/status
  Response: { status: "pending" | "checked_in" | "not_checked_in" }

POST /vendor/print-jobs
  Request:  { attendeeId, requestId }
  Response: { accepted: true }

POST /webhooks/print-complete
  Headers:  signature (shared secret, self-defined)
  Request:  { requestId, attendeeId, success }
  Response: 200 if verified and processed, 401 if signature invalid

## Database Schema (planned)

### attendees
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR/SERIAL PRIMARY KEY | attendee identifier |
| name | VARCHAR(100) | |
| status | VARCHAR(20) | not_checked_in / pending / checked_in |
| last_updated | TIMESTAMP | |

### print_requests (Phase B - tracks in-flight requests)
| Column | Type | Notes |
|---|---|---|
| request_id | VARCHAR PRIMARY KEY | matches vendor callback |
| attendee_id | VARCHAR REFERENCES attendees(id) | |
| status | VARCHAR(20) | pending / completed / failed |
| created_at | TIMESTAMP | |

## Roadmap (in order — do not skip ahead)

1. Repo setup (README, .gitignore) — DONE
2. Design & create attendee + print_requests schema
3. Seed 3+ test attendees
4. Build mock vendor sync endpoint — POST /vendor/print
5. Build POST /checkin (sync) — calls vendor, waits, updates on success
6. Build duplicate-scan guard (sync — blocks if checked_in)
7. Build frontend: scan trigger + "Checked In" display
8. TEST Phase A end-to-end: 3+ attendees incl. duplicate scan
9. Remove/deprecate the synchronous vendor-calling code
10. Build mock vendor async queue — POST /vendor/print-jobs + delayed worker
11. Build POST /webhooks/print-complete — signature verification + status update by requestId
12. Rebuild POST /checkin (async) — publish instead of call-and-wait
13. Update duplicate-scan guard for pending state
14. Update frontend — "Pending" state + polling for status updates
15. TEST Phase B end-to-end, including deliberately out-of-order confirmations
16. Write Scope Delta Analysis (dropped/modified/added)
17. Final live end-to-end test on a fresh checkout before submission

## Known, Deliberate Simplifications

- No real message broker (Redis/RabbitMQ) — in-process simulation only
- No real QR scanning — attendee ID entered/selected directly
- No real badge printer — fully simulated vendor
