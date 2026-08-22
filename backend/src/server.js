const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

app.use(express.json());
app.use(cors());

app.get("/health", function (req, res) {
  res.status(200).json({ status: "ok" });
});

// ============================================================
// PHASE A (SYNC) - REMOVED per Day 4 pivot.
// The synchronous /checkin and /vendor/print endpoints (which
// called the vendor and waited for a response) are deprecated -
// the vendor killed that model. Full original implementation is
// preserved in git history: commit 49ff915.
// See ARCHITECTURE.md and SCOPE_DELTA.md for details.
// ============================================================

// ============================================================
// PHASE B - ASYNC MOCK VENDOR QUEUE
// ============================================================

let printQueue = [];

app.post("/vendor/print-jobs", function (req, res) {
  const { attendeeId, requestId } = req.body;

  if (!attendeeId || !requestId) {
    return res.status(400).json({ error: "attendeeId and requestId are required" });
  }

  const delayMs = 1000 + Math.random() * 4000;

  printQueue.push({
    attendeeId,
    requestId,
    readyAt: Date.now() + delayMs,
  });

  res.status(200).json({ accepted: true });
});

setInterval(async function () {
  const now = Date.now();
  const readyJobs = printQueue.filter((job) => job.readyAt <= now);
  printQueue = printQueue.filter((job) => job.readyAt > now);

  for (const job of readyJobs) {
    const success = Math.random() > 0.1;

    try {
      await fetch("http://localhost:" + PORT + "/webhooks/print-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          requestId: job.requestId,
          attendeeId: job.attendeeId,
          success,
        }),
      });
    } catch (err) {
      console.error("Failed to deliver webhook:", err);
    }
  }
}, 300);

// ============================================================
// PHASE B - ASYNC CHECK-IN (replaces removed sync /checkin)
// ============================================================
app.post("/checkin", async function (req, res) {
  const { attendeeId } = req.body;

  if (!attendeeId) {
    return res.status(400).json({ error: "attendeeId is required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, status FROM attendees WHERE id = $1",
      [attendeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Attendee not found" });
    }

    const attendee = result.rows[0];

    // Duplicate-scan guard now also blocks PENDING, not just
    // checked_in - a first scan may still be in flight
    if (attendee.status === "checked_in" || attendee.status === "pending") {
      return res.status(409).json({
        error: "Attendee already checked in or check-in in progress",
        status: attendee.status,
      });
    }

    const requestId = crypto.randomUUID();

    await pool.query(
      "INSERT INTO print_requests (request_id, attendee_id, status) VALUES ($1, $2, 'pending')",
      [requestId, attendeeId]
    );

    await fetch("http://localhost:" + PORT + "/vendor/print-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendeeId, requestId }),
    });

    await pool.query(
      "UPDATE attendees SET status = 'pending', last_updated = NOW() WHERE id = $1",
      [attendeeId]
    );

    res.status(200).json({ accepted: true, status: "pending", requestId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ============================================================
// PHASE B - WEBHOOK RECEIVER
// ============================================================
app.post("/webhooks/print-complete", async function (req, res) {
  const signature = req.headers["x-webhook-secret"];

  if (signature !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  const { requestId, attendeeId, success } = req.body;

  if (!requestId || !attendeeId) {
    return res.status(400).json({ error: "requestId and attendeeId are required" });
  }

  try {
    // Confirm this requestId is one we actually issued and it
    // matches the attendee it claims to - guards against a forged
    // or stale callback even with a valid signature
    const requestCheck = await pool.query(
      "SELECT * FROM print_requests WHERE request_id = $1 AND attendee_id = $2",
      [requestId, attendeeId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: "Unknown print request" });
    }

    const newAttendeeStatus = success ? "checked_in" : "not_checked_in";
    const newRequestStatus = success ? "completed" : "failed";

    await pool.query(
      "UPDATE attendees SET status = $1, last_updated = NOW() WHERE id = $2",
      [newAttendeeStatus, attendeeId]
    );

    await pool.query(
      "UPDATE print_requests SET status = $1 WHERE request_id = $2",
      [newRequestStatus, requestId]
    );

    console.log(
      "Webhook processed: requestId=" + requestId +
      " attendeeId=" + attendeeId +
      " success=" + success
    );

    res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ============================================================
// PHASE B - STATUS CHECK (for frontend polling)
// ============================================================
app.get("/checkin/:attendeeId/status", async function (req, res) {
  const { attendeeId } = req.params;

  try {
    const result = await pool.query(
      "SELECT status FROM attendees WHERE id = $1",
      [attendeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Attendee not found" });
    }

    res.status(200).json({ status: result.rows[0].status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, function () {
  console.log("Server is running on http://localhost:" + PORT);
});
