# Checkpoint Kiosk — Architecture, Blueprint & Roadmap
**Solstice Events Co. — PLP Group 90, Meridian Pivot — Individual Submission (Bernard)**

## What this is

An event check-in kiosk for a multi-day tech conference. Staff scan
an attendee's QR code (simulated via ID entry for this MVP), the
system checks them in, and triggers a badge print.

**Current state: fully async (post-pivot).** The system was
originally built against a synchronous vendor API, then rebuilt
around a message-queue + webhook model after a non-negotiable
mid-sprint client pivot. The synchronous version is preserved in git
history (commit 49ff915) but is no longer part of the live system -
see SCOPE_DELTA.md for full details on what changed and why.

## Tech Stack

- Node.js + Express — backend, mock vendor, webhook receiver
- PostgreSQL — attendee/check-in data, in-flight print request tracking
- Plain HTML/CSS/JS — kiosk frontend, no framework
- No real message broker — the vendor's "queue" is simulated as an
  in-process array with a randomized-delay worker (setTimeout-based),
  realistic enough to prove the concept and test out-of-order
  confirmations without real infrastructure

## Live System — Data Flow

    Staff scans QR code (frontend)
          |
    Frontend -> POST /checkin { attendeeId }
          |
    Backend: duplicate-scan guard (blocks if status is PENDING or
    checked_in - a first scan may still be in flight)
          |
    Backend generates a unique requestId, records it in
    print_requests, publishes to mock vendor:
      POST /vendor/print-jobs { attendeeId, requestId }
      -> immediate { accepted: true }, backend does NOT wait
          |
    Backend marks attendee "pending", responds to frontend right away
          |
    Frontend shows "Pending", begins polling GET /checkin/:id/status
    every 2 seconds
          |
    [TIME PASSES - randomized 1-5s delay in mock vendor's worker,
    deliberately variable so confirmations can arrive out of order]
          |
    Mock vendor's worker "finishes printing", calls the webhook:
      POST /webhooks/print-complete { requestId, attendeeId, success }
      + x-webhook-secret header
          |
    Webhook handler verifies the secret, confirms requestId is a
    real, known request in print_requests (defense against a forged
    or stale callback), then updates the correct attendee BY
    requestId - never by "whoever scanned most recently"
          |
    Frontend's next poll picks up the updated status, shows
    "Checked In" (or reverts to "not_checked_in" with an error
    message if the print failed)

## Live Endpoints

    GET  /health
      -> 200 { status: "ok" }

    POST /checkin
      Request:  { attendeeId }
      Response: 200 { accepted: true, status: "pending", requestId }
                404 { error: "Attendee not found" }
                409 { error: "...", status: "checked_in"|"pending" }

    GET  /checkin/:attendeeId/status
      Response: 200 { status: "pending"|"checked_in"|"not_checked_in" }
                404 { error: "Attendee not found" }

    POST /vendor/print-jobs   (internal - mock vendor)
      Request:  { attendeeId, requestId }
      Response: 200 { accepted: true }

    POST /webhooks/print-complete   (internal - mock vendor calls this)
      Headers:  x-webhook-secret
      Request:  { requestId, attendeeId, success }
      Response: 200 { received: true }
                401 { error: "Invalid webhook signature" }
                404 { error: "Unknown print request" }

## Database Schema

### attendees
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(20) PRIMARY KEY | attendee identifier |
| name | VARCHAR(100) | |
| status | VARCHAR(20) | not_checked_in / pending / checked_in |
| last_updated | TIMESTAMP | |

### print_requests
| Column | Type | Notes |
|---|---|---|
| request_id | VARCHAR(50) PRIMARY KEY | matches vendor callback |
| attendee_id | VARCHAR(20) REFERENCES attendees(id) | |
| status | VARCHAR(20) | pending / completed / failed |
| created_at | TIMESTAMP | |

## What Was Removed (Day 4 Pivot)

- Synchronous `POST /vendor/print` (called vendor, waited for response)
- Synchronous `POST /checkin` (blocked ~1.5s per scan)

Full details and regression-check results: see SCOPE_DELTA.md.

## Known, Deliberate Simplifications

- No real message broker (Redis/RabbitMQ) - in-process simulation only
- No real QR scanning - attendee ID entered directly
- No real badge printer - fully simulated vendor
- Webhook signature is a static shared secret, not a real HMAC scheme
  - acceptable for this simulation since the "vendor" and "receiver"
  share a process, but noted as a real-world gap in SCOPE_DELTA.md

## Related Documents

- SCOPE_DELTA.md - what changed because of the pivot, and why
- frontend/README.md - frontend-specific status and setup
- backend/.env.example - required environment variables
