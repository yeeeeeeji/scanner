const ws = new WebSocket(`ws://${location.host}`);
const row = document.getElementById("row");
const laserScan = document.getElementById("laser-scan");

let step = 0;

function connectWebSocket() {
  ws.addEventListener("open", () => {
    console.log("WebSocket connected");
  });

  ws.addEventListener("error", (err) => {
    console.error("WebSocket error:", err);
  });

  ws.addEventListener("close", () => {
    console.log("WebSocket closed, reconnecting...");
    setTimeout(() => {
      location.reload();
    }, 1000);
  });

  ws.addEventListener("message", async (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }

    if (msg.type === "print") {
      await doLaserScan();
      await printImage(true);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "scan-end" }));
      }
    }
  });
}

function doLaserScan() {
  return new Promise((resolve) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "scan-start" }));
    }

    laserScan.style.top = "0px";
    laserScan.style.height = "100vh";
    laserScan.style.left = "0px";
    laserScan.classList.remove("hidden");

    let position = 0;
    const screenWidth = window.innerWidth;
    const forwardWidth = laserScan.getBoundingClientRect().width;
    const returnWidth = Math.max(1, Math.round(forwardWidth / 2));

    const scanInterval = setInterval(() => {
      position += 16;
      laserScan.style.left = `${position}px`;

      if (position >= screenWidth + forwardWidth) {
        clearInterval(scanInterval);

        laserScan.style.width = `${returnWidth}px`;
        let returnPosition = screenWidth + returnWidth;
        const returnInterval = setInterval(() => {
          returnPosition -= 16;
          laserScan.style.left = `${returnPosition}px`;

          if (returnPosition <= -returnWidth) {
            clearInterval(returnInterval);
            setTimeout(() => {
              laserScan.classList.add("hidden");
              laserScan.style.width = "";

              resolve();
            }, 200);
          }
        }, 16);
      }
    }, 16);
  });
}

async function printImage(animateFromLeft = false) {
  const img = new Image();
  img.src = `/manual.png?t=${Date.now()}`;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => {
      console.error("Failed to load manual.png");
      reject(new Error("Failed to load manual.png"));
    };
  });

  const { width: cardWidth, height: cardHeight } = getCardSize();

  const originalAspectRatio = img.width / img.height;
  const cardAspectRatio = cardWidth / cardHeight;

  let displayWidth, displayHeight;
  let offsetX = 0,
    offsetY = 0;

  if (originalAspectRatio > cardAspectRatio) {
    displayWidth = cardWidth;
    displayHeight = cardWidth / originalAspectRatio;
    offsetY = (cardHeight - displayHeight) / 2;
  } else {
    displayHeight = cardHeight;
    displayWidth = cardHeight * originalAspectRatio;
    offsetX = (cardWidth - displayWidth) / 2;
  }

  const resizeCanvas = document.createElement("canvas");
  resizeCanvas.width = cardWidth;
  resizeCanvas.height = cardHeight;
  const resizeCtx = resizeCanvas.getContext("2d");
  resizeCtx.drawImage(img, offsetX, offsetY, displayWidth, displayHeight);

  const resizedImg = new Image();
  resizedImg.src = resizeCanvas.toDataURL("image/png");

  await new Promise((resolve) => {
    resizedImg.onload = async () => {
      const pixelatedSrc = await pixelateImage(
        resizedImg,
        step + 1,
        cardWidth,
        cardHeight,
      );

      const cards = row.querySelectorAll(".card");

      const screenWidth = 1920;
      const screenHeight = 1080;

      let finalX;
      let finalY;

      if (animateFromLeft) {
        finalX = (screenWidth - cardWidth) / 2;
        finalY = (screenHeight - cardHeight) / 2;
      } else {
        const minX = 0;
        const maxX = screenWidth - cardWidth;
        finalX = minX + Math.random() * (maxX - minX);

        const minY = 0;
        const maxY = screenHeight - cardHeight;
        finalY = minY + Math.random() * (maxY - minY);
      }

      await addImageCard(img.src, finalX, finalY, false, animateFromLeft);

      resolve();
    };
  });
}

function pixelateImage(img, pixelationLevel, targetWidth, targetHeight) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    const minResolution = 0.001;
    const decreasePerStep = 0.01;
    const maxSteps = Math.floor((1.0 - minResolution) / decreasePerStep);

    const cycleStep = ((pixelationLevel - 1) % maxSteps) + 1;
    const calculatedScale = 1.0 - (cycleStep - 1) * decreasePerStep;
    const resolutionScale = Math.max(minResolution, calculatedScale);

    const smallWidth = Math.max(1, Math.floor(targetWidth * resolutionScale));
    const smallHeight = Math.max(1, Math.floor(targetHeight * resolutionScale));

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = smallWidth;
    tempCanvas.height = smallHeight;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.imageSmoothingEnabled = false;

    tempCtx.drawImage(img, 0, 0, smallWidth, smallHeight);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      tempCanvas,
      0,
      0,
      smallWidth,
      smallHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    );

    resolve(canvas.toDataURL("image/png"));
  });
}

function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function getCardSize() {
  const a3AspectRatio = 420 / 297;

  const cardWidth = (window.innerWidth * 60) / 100;
  const cardHeight = cardWidth / a3AspectRatio;
  return { width: cardWidth, height: cardHeight };
}

async function addImageCard(
  imageSrc,
  targetX,
  targetY,
  skipPixelation = false,
  animateFromLeft = false,
) {
  if (!skipPixelation) {
    step += 1;
  }

  const card = document.createElement("div");
  card.className = "card";

  const { width: cardWidth, height: cardHeight } = getCardSize();

  const cards = row.querySelectorAll(".card");
  const cardCount = cards.length;

  const screenWidth = 1920;
  const screenHeight = 1080;

  const minX = 0;
  const maxX = screenWidth - cardWidth;
  const fallbackX = minX + Math.random() * (maxX - minX);

  const minY = 0;
  const maxY = screenHeight - cardHeight;
  const fallbackY = minY + Math.random() * (maxY - minY);

  const finalX = Number.isFinite(targetX) ? targetX : fallbackX;
  const finalY = Number.isFinite(targetY) ? targetY : fallbackY;

  const rotation = animateFromLeft ? 0 : (Math.random() - 0.5) * 10;

  if (animateFromLeft) {
    const startX = -cardWidth - 80;
    card.style.left = `${startX}px`;
    card.style.top = `${finalY}px`;
  } else {
    card.style.left = `${finalX}px`;
    card.style.top = `${finalY}px`;
  }
  card.style.transform = `rotate(${rotation}deg)`;
  card.style.zIndex = skipPixelation ? 0 : step;

  const img = new Image();
  img.src = imageSrc;

  await new Promise((resolve) => {
    img.onload = async () => {
      const { width: cardWidth, height: cardHeight } = getCardSize();

      const originalAspectRatio = img.width / img.height;
      const cardAspectRatio = cardWidth / cardHeight;

      let displayWidth, displayHeight;
      let offsetX = 0,
        offsetY = 0;

      if (originalAspectRatio > cardAspectRatio) {
        displayWidth = cardWidth;
        displayHeight = cardWidth / originalAspectRatio;
        offsetY = (cardHeight - displayHeight) / 2;
      } else {
        displayHeight = cardHeight;
        displayWidth = cardHeight * originalAspectRatio;
        offsetX = (cardWidth - displayWidth) / 2;
      }

      let finalImageSrc;

      if (skipPixelation) {
        const resizeCanvas = document.createElement("canvas");
        resizeCanvas.width = cardWidth;
        resizeCanvas.height = cardHeight;
        const resizeCtx = resizeCanvas.getContext("2d");
        resizeCtx.imageSmoothingEnabled = true;
        resizeCtx.imageSmoothingQuality = "high";
        resizeCtx.drawImage(img, offsetX, offsetY, displayWidth, displayHeight);

        finalImageSrc = resizeCanvas.toDataURL("image/png", 1.0);
      } else {
        const resizeCanvas = document.createElement("canvas");
        resizeCanvas.width = cardWidth;
        resizeCanvas.height = cardHeight;
        const resizeCtx = resizeCanvas.getContext("2d");
        resizeCtx.imageSmoothingEnabled = false;
        resizeCtx.drawImage(img, offsetX, offsetY, displayWidth, displayHeight);
        const resizedImg = new Image();
        resizedImg.src = resizeCanvas.toDataURL("image/png");

        await new Promise((resolve2) => {
          resizedImg.onload = async () => {
            finalImageSrc = await pixelateImage(
              resizedImg,
              step,
              cardWidth,
              cardHeight,
            );
            resolve2();
          };
        });
      }

      const image = document.createElement("img");
      image.src = finalImageSrc;

      const metaContainer = document.createElement("div");
      metaContainer.className = "meta-container";

      const metaTime = document.createElement("div");
      metaTime.className = "meta meta-time";
      metaTime.textContent = getCurrentTime();

      metaContainer.appendChild(metaTime);

      const copyNumber = skipPixelation ? 0 : step;
      if (copyNumber > 0) {
        const metaCopy = document.createElement("div");
        metaCopy.className = "meta meta-copy";
        metaCopy.textContent = `copy no.${copyNumber}`;
        metaContainer.appendChild(metaCopy);
      }

      card.appendChild(image);
      card.appendChild(metaContainer);
      row.appendChild(card);

      if (animateFromLeft) {
        const driftX = 18;
        const driftY = 10;
        const settleRotation = (Math.random() - 0.5) * 6;

        if (window.anime) {
          const animation = window.anime({
            targets: card,
            left: [
              { value: finalX + driftX, duration: 1250 },
              { value: finalX, duration: 420 },
            ],
            top: [
              { value: finalY + driftY, duration: 1250 },
              { value: finalY, duration: 420 },
            ],
            rotate: [
              { value: settleRotation, duration: 800 },
              { value: settleRotation, duration: 520 },
            ],
            easing: "cubicBezier(0.22, 0.61, 0.36, 1)",
            complete: () => {
              resolve();
            },
          });

          if (!animation) {
            resolve();
          }
        } else {
          requestAnimationFrame(() => {
            card.style.left = `${finalX}px`;
            card.style.top = `${finalY}px`;
            resolve();
          });
        }
      } else {
        resolve();
      }
    };
  });

  const allCards = row.querySelectorAll(".card");
  if (allCards.length > 0) {
    let maxBottom = -Infinity;
    let minTop = Infinity;
    allCards.forEach((c) => {
      const cardTop = parseFloat(c.style.top) || 0;
      const cardBottom = cardTop + cardHeight;
      if (cardBottom > maxBottom) {
        maxBottom = cardBottom;
      }
      if (cardTop < minTop) {
        minTop = cardTop;
      }
    });

    const rowHeight = maxBottom - Math.min(0, minTop) + 200;
    row.style.minHeight = `${rowHeight}px`;

    if (minTop < 0) {
      row.style.paddingTop = `${Math.abs(minTop) + 50}px`;
    } else {
      row.style.paddingTop = "50px";
    }
  }
}

async function loadOriginalImage() {
  const screenWidth = 1920;
  const screenHeight = 1080;
  const { width: cardWidth, height: cardHeight } = getCardSize();
  const baseX = screenWidth / 2 - cardWidth / 2;
  const baseY = screenHeight / 2 - cardHeight / 2;
  await addImageCard(`/manual.png?t=${Date.now()}`, baseX, baseY, true);
}

connectWebSocket();

loadOriginalImage();
