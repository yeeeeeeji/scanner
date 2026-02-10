let ws = null;

function connectWebSocket() {
  try {
    ws = new WebSocket(`ws://${location.host}`);

    ws.addEventListener("open", () => {
      console.log("WebSocket connected");
    });

    ws.addEventListener("error", (err) => {
      console.error("WebSocket error:", err);
    });

    ws.addEventListener("close", () => {
      console.log("WebSocket closed, reconnecting...");
      setTimeout(connectWebSocket, 1000);
    });

    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg.type === "scan-start") {
        startScanAnimation();
      }
      if (msg.type === "scan-end") {
        stopScanAnimation();
        printBtn.classList.remove("pressed");
        printBtn.blur();
        setPrintBusy(false);
      }
    });
  } catch (err) {
    console.error("Failed to create WebSocket:", err);
    setTimeout(connectWebSocket, 1000);
  }
}

connectWebSocket();

const $ = (id) => document.getElementById(id);

const printBtn = $("print");
let printTimeout = null;

function setPrintBusy(isBusy) {
  printBtn.disabled = isBusy;
  printBtn.setAttribute("aria-busy", String(isBusy));
  if (isBusy) {
    if (printTimeout) clearTimeout(printTimeout);

    printTimeout = setTimeout(() => {
      setPrintBusy(false);
    }, 8000);
  } else if (printTimeout) {
    clearTimeout(printTimeout);
    printTimeout = null;
  }
}

function startScanAnimation() {
  const dot = document.querySelector(".dot");
  if (dot) {
    dot.classList.add("scanning");
  }
}

function stopScanAnimation() {
  const dot = document.querySelector(".dot");
  if (dot) {
    dot.classList.remove("scanning");
  }
}

printBtn.addEventListener("click", (e) => {
  if (printBtn.disabled) return;
  if (ws && ws.readyState === WebSocket.OPEN) {
    setPrintBusy(true);

    printBtn.classList.add("pressed");
    ws.send(JSON.stringify({ type: "print" }));
  }
});
