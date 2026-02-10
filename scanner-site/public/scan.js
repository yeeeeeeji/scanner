export function applyScan(inputCanvas, params) {
  const { width, height } = inputCanvas;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;

  const ictx = inputCanvas.getContext("2d", { willReadFrequently: true });
  const octx = out.getContext("2d", { willReadFrequently: true });

  const img = ictx.getImageData(0, 0, width, height);
  const d = img.data;

  const contrast = params.contrast;     
  const exposure = params.exposure;     
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    let y = (0.2126 * r + 0.7152 * g + 0.0722 * b);
    y = (y - 128) * contrast + 128 + exposure;
    y = Math.max(0, Math.min(255, y));
    d[i] = d[i + 1] = d[i + 2] = y;
  }

  const thr = params.threshold; 
  for (let i = 0; i < d.length; i += 4) {
    const y = d[i];
    const v = y > thr ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }

  const noise = params.noise; 
  if (noise > 0) {
    for (let i = 0; i < d.length; i += 4) {
      if (Math.random() < noise) {
        const v = Math.random() < 0.6 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
  }

  const tmp = document.createElement("canvas");
  const s = Math.max(0.2, Math.min(1.0, params.resolution)); 
  tmp.width = Math.max(1, Math.floor(width * s));
  tmp.height = Math.max(1, Math.floor(height * s));

  const tctx = tmp.getContext("2d");
  octx.putImageData(img, 0, 0);

  tctx.imageSmoothingEnabled = false;
  octx.imageSmoothingEnabled = false;

  tctx.drawImage(out, 0, 0, tmp.width, tmp.height);
  octx.clearRect(0, 0, width, height);
  octx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, width, height);

  return out;
}
