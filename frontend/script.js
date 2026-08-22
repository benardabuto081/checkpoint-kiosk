const API_BASE = "http://localhost:3000";

const attendeeInput = document.getElementById("attendeeId");
const scanBtn = document.getElementById("scanBtn");
const statusArea = document.getElementById("statusArea");

function setStatus(message, state) {
  statusArea.textContent = message;
  statusArea.className = "status status--" + state;
}

async function checkIn(attendeeId) {
  const response = await fetch(API_BASE + "/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attendeeId }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Includes the duplicate-scan case (409) and not-found (404) -
    // the server's error message is customer-facing enough to show
    const err = new Error(data.error || "Check-in failed");
    err.status = response.status;
    throw err;
  }

  return data;
}

async function pollStatus(attendeeId) {
  const response = await fetch(API_BASE + "/checkin/" + attendeeId + "/status");
  const data = await response.json();
  return data.status;
}

/**
 * After a check-in request is accepted as "pending", we don't know
 * the real result yet - the vendor's webhook hasn't fired. Poll the
 * status endpoint every 2 seconds until it resolves to checked_in
 * (or we give up after a reasonable timeout).
 */
function startPolling(attendeeId) {
  const maxAttempts = 15; // ~30 seconds at 2s intervals
  let attempts = 0;

  const intervalId = setInterval(async () => {
    attempts++;

    try {
      const status = await pollStatus(attendeeId);

      if (status === "checked_in") {
        setStatus("Checked In: " + attendeeId, "success");
        clearInterval(intervalId);
      } else if (status === "not_checked_in") {
        // Vendor reported a failure - webhook set it back
        setStatus("Print failed - please try scanning again.", "error");
        clearInterval(intervalId);
      }
      // if still "pending", just keep polling silently
    } catch (err) {
      console.error("Polling error:", err);
    }

    if (attempts >= maxAttempts) {
      setStatus("Still processing - taking longer than expected.", "idle");
      clearInterval(intervalId);
    }
  }, 2000);
}

scanBtn.addEventListener("click", async () => {
  const attendeeId = attendeeInput.value.trim();

  if (!attendeeId) {
    setStatus("Please enter an attendee ID.", "error");
    return;
  }

  setStatus("Submitting check-in...", "idle");

  try {
    const result = await checkIn(attendeeId);

    if (result.status === "pending") {
      setStatus("Pending - printing badge...", "pending");
      startPolling(attendeeId);
    }
  } catch (err) {
    // err.status lets us distinguish duplicate/pending (409) from
    // not-found (404) from a real server error, if we want to later -
    // for now, the server's message is descriptive enough to show directly
    setStatus(err.message, "error");
    console.error(err);
  }
});
