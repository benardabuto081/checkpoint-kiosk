# Checkpoint Kiosk - Frontend

Kiosk check-in interface for Solstice Events Co.'s conference
check-in system. Staff enter/select an attendee ID (simulating a QR
scan), the app calls the backend check-in service and displays the
result.

## Current Status: Live, Async (Post-Pivot)

- `/checkin` returns immediately with a "pending" status - it no
  longer blocks waiting for the print job to finish
- On "pending", the UI polls `GET /checkin/:attendeeId/status` every
  2 seconds until it resolves to "checked_in" or "not_checked_in"
- Duplicate-scan protection works for both "checked_in" and "pending"
  attendees - trying to scan someone mid-process is correctly blocked
- Tested live, end-to-end, in a real browser against the real backend

## Tech Stack

Plain HTML, CSS, and vanilla JavaScript - no framework.

- `index.html` - page structure
- `style.css` - styling, including distinct visual states for idle,
  pending, success, and error
- `script.js` - scan handling, API calls, and status polling

## How to run it

1. Make sure the backend is running (`node src/server.js` from the
   `backend/` folder, port 3000)
2. Open `index.html` directly in a browser

## API Contract

    POST http://localhost:3000/checkin
    Body: { "attendeeId": "A001" }
    Success (202-style, still 200): { "accepted": true, "status": "pending", "requestId": "..." }
    Duplicate (409): { "error": "...", "status": "checked_in" | "pending" }
    Not found (404): { "error": "Attendee not found" }

    GET http://localhost:3000/checkin/:attendeeId/status
    Response: { "status": "pending" | "checked_in" | "not_checked_in" }

## History

This originally called a synchronous `/checkin` that blocked until
the print job finished. That version is preserved in git history
(commit 49ff915) - see the root ARCHITECTURE.md and SCOPE_DELTA.md
for the full story of the Day 4 pivot.
