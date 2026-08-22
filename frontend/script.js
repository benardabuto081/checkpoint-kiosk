const API_BASE = "http://localhost:4000"; // placeholder - confirm real port/URL with Wakaro

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
    body: JSON.stringify({ attendeeId })
  });

  if (!response.ok) {
    throw new Error("Server responded with status " + response.status);
  }

  return response.json();
}

scanBtn.addEventListener("click", async () => {
  const attendeeId = attendeeInput.value.trim();

  if (!attendeeId) {
    setStatus("Please enter an attendee ID.", "error");
    return;
  }

  setStatus("Checking in...", "idle");

  try {
    const result = await checkIn(attendeeId);

    if (result.success) {
      setStatus("Checked In: " + attendeeId, "success");
    } else {
      setStatus(result.status || "Check-in failed.", "error");
    }
  } catch (err) {
    setStatus("Error: could not reach check-in service.", "error");
    console.error(err);
  }
});
