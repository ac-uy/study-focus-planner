// Shrinks and brightens a photo in the browser before it is sent to the AI (nothing is stored).

// Stretch the brightness range so shadowed phone photos of paper become clearer.
function autoLevels(cx, w, h) {
  try {
    const img = cx.getImageData(0, 0, w, h), d = img.data, hist = new Uint32Array(256), n = w * h;
    let i;
    for (i = 0; i < d.length; i += 4) hist[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++;
    let lo = 0, hi = 255, acc = 0;
    const cut = n * 0.01;
    while (lo < 254 && (acc += hist[lo]) < cut) lo++;
    acc = 0;
    while (hi > lo + 1 && (acc += hist[hi]) < cut) hi--;
    if (hi - lo < 40) return;
    const k = 255 / (hi - lo);
    for (i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, Math.min(255, (d[i] - lo) * k));
      d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] - lo) * k));
      d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] - lo) * k));
    }
    cx.putImageData(img, 0, 0);
  } catch (e) { /* keep the original pixels */ }
}

// Resolves with a data URL (image/jpeg). Rejects if the file is not a readable image.
export function fileToJpeg(file, maxDim, quality, levels) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const scale = Math.min(1, (maxDim || 1568) / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0, c.width, c.height);
      if (levels !== false) autoLevels(cx, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality || 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}
