# Checkpoint Kiosk - Frontend

Kiosk check-in interface for Solstice Events Co.'s conference check-in
system. Staff select/enter an attendee ID to simulate a QR scan; the
app calls the backend check-in service and displays the result.

## Tech Stack

Plain HTML, CSS, and vanilla JavaScript - no framework, per the
team's MVP-simplicity approach. No build step required.

## Running Locally

1. Clone the repo and navigate to the `frontend` folder.
2. Open `index.html` directly in a browser, or serve it with any
   static file server (e.g. VS Code's Live Server extension).
3. The app expects a backend running at the URL set in `API_BASE`
   inside `script.js` (currently a placeholder - see Status below).

## Files

- `index.html` - page structure (attendee input, scan button, status display)
- `style.css` - kiosk-style dark theme, large touch targets
- `script.js` - scan logic and API calls

## Status (Phase A - Synchronous Check-In)

- Kiosk UI is built and functional: attendee ID input, Scan button,
  and status display all render and update correctly.
- Client-side validation works: an empty attendee ID shows an error
  without attempting a network call.
- The scan flow correctly calls `POST /checkin` and handles both
  success and failure responses.

## Known Limitations

- **No live backend yet.** `API_BASE` in `script.js` currently points
  to `http://localhost:4000` as a placeholder. This has not been
  confirmed with Wakaro and will need to be updated once his
  `/checkin` endpoint is live.
- **Success path is untested against a real backend.** Error handling
  has been manually verified (empty input, unreachable server), but
  the actual "Checked In" success state has only been reviewed
  visually, not tested against a real API response.
- **Phase B (async/pending state) not yet implemented.** The UI does
  not yet show a "Pending" status or poll a status endpoint - this is
  planned once the pivot to the webhook-based backend is confirmed
  ready.
- **No real QR scanning.** Attendee ID is entered/selected manually,
  per the MVP scope agreed with the team.
