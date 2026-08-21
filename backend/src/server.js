const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.get("/health", function (req, res) {
  res.status(200).json({ status: "ok" });
});

/**
 * MOCK VENDOR - simulates Solstice's real badge-printer vendor,
 * which doesn't exist for this exercise. Synchronous version:
 * caller sends the request and WAITS for this to respond.
 *
 * Simulates a short delay (like a real printer would take) and
 * responds with success/failure.
 */
app.post("/vendor/print", async function (req, res) {
  const { attendeeId } = req.body;

  if (!attendeeId) {
    return res.status(400).json({ error: "attendeeId is required" });
  }

  // Simulate the printer taking 1-2 seconds
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Simulate occasional failure (1 in 10) so failure handling is testable
  const success = Math.random() > 0.1;

  res.status(200).json({ success });
});

/**
 * POST /checkin - Phase A (synchronous)
 *
 * Calls the mock vendor and WAITS for the response before deciding
 * whether the attendee is checked in. Blocks duplicate scans.
 */
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

    if (attendee.status === "checked_in") {
      return res.status(409).json({
        error: "Attendee already checked in",
        status: "checked_in",
      });
    }

    // Call the mock vendor SYNCHRONOUSLY - wait for its response
    const vendorResponse = await fetch("http://localhost:" + PORT + "/vendor/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendeeId }),
    });
    const vendorResult = await vendorResponse.json();

    if (!vendorResult.success) {
      return res.status(502).json({
        error: "Print job failed",
        status: attendee.status,
      });
    }

    await pool.query(
      "UPDATE attendees SET status = 'checked_in', last_updated = NOW() WHERE id = $1",
      [attendeeId]
    );

    res.status(200).json({ success: true, status: "checked_in" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, function () {
  console.log("Server is running on http://localhost:" + PORT);
});
