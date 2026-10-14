// Pure image helpers. They work on RGBA arrays (like canvas ImageData.data), so they can be tested in Node.
const colDist = (d, i, c) => Math.hypot(d[i] - c[0], d[i + 1] - c[1], d[i + 2] - c[2]);
function borderColor(d, w, h) {
  const r = [], g = [], b = [];
  const add = (x, y) => { const i = (y * w + x) * 4; if (d[i + 3] > 200) { r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]); } };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { add(0, y); add(w - 1, y); }
  const med = a => a.sort((p, q) => p - q)[a.length >> 1];
  return r.length ? [med(r), med(g), med(b)] : null;
}
// Makes a plain background transparent by flooding inward from the edges. Changes d in place.
function removePlainBackground(d, w, h, tol) {
  let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) clear++;
  if (clear > (w * h) * 0.02) return { status: "alpha", ratio: clear / (w * h) };
  const bg = borderColor(d, w, h);
  if (!bg) return { status: "none", ratio: 0 };
  const mask = new Uint8Array(w * h), stack = new Int32Array(w * h);
  let sp = 0, count = 0;
  const seed = (x, y) => { const p = y * w + x; if (!mask[p] && colDist(d, p * 4, bg) <= tol) { mask[p] = 1; stack[sp++] = p; count++; } };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (sp) {
    const p = stack[--sp], x = p % w, y = (p / w) | 0;
    if (x > 0) seed(x - 1, y); if (x < w - 1) seed(x + 1, y); if (y > 0) seed(x, y - 1); if (y < h - 1) seed(x, y + 1);
  }
  for (let p = 0; p < w * h; p++) {
    const i = p * 4, x = p % w, y = (p / w) | 0;
    if (mask[p]) { d[i + 3] = 0; continue; }
    const edge = (x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || (y > 0 && mask[p - w]) || (y < h - 1 && mask[p + w]);
    if (edge) d[i + 3] = Math.round(d[i + 3] * Math.min(1, colDist(d, i, bg) / (tol * 2)));
  }
  const ratio = count / (w * h);
  return { status: ratio < 0.02 ? "none" : ratio > 0.97 ? "all" : "ok", ratio };
}
function alphaBounds(d, w, h, thr = 10) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
const fitInside = (sw, sh, bw, bh) => { const s = Math.min(bw / sw, bh / sh); return { w: Math.max(1, Math.round(sw * s)), h: Math.max(1, Math.round(sh * s)) }; };
// encode(q) returns a Promise of something with a .size. Finds the highest quality that fits the target size.
async function searchQuality(encode, target) {
  let lo = 0.05, hi = 0.95, best = null;
  for (let i = 0; i < 7; i++) {
    const q = (lo + hi) / 2, b = await encode(q);
    if (b.size <= target) { best = { q, blob: b }; lo = q; } else hi = q;
  }
  return best;
}
if (typeof module !== "undefined") module.exports = { removePlainBackground, alphaBounds, fitInside, searchQuality };
