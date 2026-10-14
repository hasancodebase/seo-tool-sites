const $ = s => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const kb = n => n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(2) + " MB";
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const base = n => n.replace(/\.[^.]+$/, "");
const canvasOf = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const blobOf = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
const loadImg = async f => { const img = new Image(); img.src = URL.createObjectURL(f); await img.decode(); return img; };
const draw = (img, w, h, flat) => {
  const c = canvasOf(w, h), x = c.getContext("2d");
  if (flat) { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); }
  x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, w, h);
  return c;
};
const val = id => ($("#" + id) || {}).value;
const need = (b, type) => { if (b.type !== type) throw new Error("This browser cannot save " + type.split("/")[1].toUpperCase() + " files. Try Chrome or Edge."); return b; };

const TOOLS = {
  async convert(f) {
    const img = await loadImg(f), type = val("fmt"), w = img.naturalWidth, h = img.naturalHeight;
    const b = need(await blobOf(draw(img, w, h, type === "image/jpeg"), type, val("q") / 100), type);
    return { blob: b, name: base(f.name) + "." + EXT[type], note: `${kb(f.size)} to ${kb(b.size)}` };
  },
  async compress(f) {
    const img = await loadImg(f), type = val("fmt"), target = (+val("target") || 0) * 1024;
    let w = img.naturalWidth, h = img.naturalHeight, b, note = "";
    if (target) {
      for (let s = 1; s > 0.25; s *= 0.85) {
        const c = draw(img, Math.round(w * s), Math.round(h * s), type === "image/jpeg"), r = await searchQuality(q => blobOf(c, type, q), target);
        if (r) { b = r.blob; if (s < 1) note = ` (picture made ${Math.round(s * 100)}% of its size to fit)`; break; }
        b = await blobOf(c, type, 0.05);
      }
      if (b.size > target) note = " (could not reach the target size)";
    } else b = await blobOf(draw(img, w, h, type === "image/jpeg"), type, val("q") / 100);
    need(b, type);
    return { blob: b, name: base(f.name) + "-small." + EXT[type], note: `${kb(f.size)} to ${kb(b.size)} (${Math.round((1 - b.size / f.size) * 100)}% smaller)${note}` };
  },
  async resize(f) {
    const img = await loadImg(f), nw = img.naturalWidth, nh = img.naturalHeight;
    let w = +val("w") || 0, h = +val("h") || 0;
    if (w && !h) h = Math.round(nh * w / nw); else if (h && !w) w = Math.round(nw * h / nh);
    else if (w && h && $("#keep").checked) { const s = Math.min(w / nw, h / nh); w = Math.round(nw * s); h = Math.round(nh * s); }
    if (!w || !h) throw new Error("Enter a width or a height.");
    const type = EXT[f.type] ? f.type : "image/png", b = await blobOf(draw(img, w, h, type === "image/jpeg"), type, 0.92);
    return { blob: b, name: `${base(f.name)}-${w}x${h}.${EXT[type]}`, note: `${nw}x${nh} to ${w}x${h} pixels, ${kb(b.size)}` };
  },
  async whitebg(f) {
    const img = await loadImg(f), s = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const src = canvasOf(w, h), sx = src.getContext("2d", { willReadFrequently: true });
    sx.drawImage(img, 0, 0, w, h);
    const id = sx.getImageData(0, 0, w, h), r = removePlainBackground(id.data, w, h, +val("tol"));
    sx.putImageData(id, 0, 0);
    const bb = alphaBounds(id.data, w, h) || { x: 0, y: 0, w, h }, S = +val("size"), box = S * val("fill") / 100, fit = fitInside(bb.w, bb.h, box, box);
    const out = canvasOf(S, S), ox = out.getContext("2d"), clear = $("#clear").checked;
    if (!clear) { ox.fillStyle = "#fff"; ox.fillRect(0, 0, S, S); }
    ox.imageSmoothingQuality = "high";
    ox.drawImage(src, bb.x, bb.y, bb.w, bb.h, Math.round((S - fit.w) / 2), Math.round((S - fit.h) / 2), fit.w, fit.h);
    const type = clear ? "image/png" : "image/jpeg", b = await blobOf(out, type, 0.95);
    const msg = { ok: `Background removed (${Math.round(r.ratio * 100)}% of the picture).`, alpha: "The picture already had a transparent background.",
      none: "No plain background was found, so the picture was only resized. This tool works best on plain or white backgrounds.",
      all: "Almost the whole picture was treated as background. Lower the sensitivity." }[r.status];
    return { blob: b, name: `${base(f.name)}-${clear ? "transparent" : "white"}.${EXT[type]}`, note: `${S}x${S} pixels, ${kb(b.size)}. ${msg}`, warn: r.status === "none" || r.status === "all" };
  },
};
const form = $("#f");
if (form) {
  document.querySelectorAll("input[type=range]").forEach(r => { const t = $("#" + r.id + "v"); if (t) { t.textContent = r.value; r.oninput = () => { t.textContent = r.value; }; } });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const files = [...$("#files").files], out = $("#out"), btn = form.querySelector("button"), tool = TOOLS[form.dataset.tool];
    if (!files.length) return out.replaceChildren(el("p", "msg bad", "Choose at least one image first."));
    btn.disabled = true;
    const list = el("div", "results");
    out.replaceChildren(el("p", "msg", "Working..."), list);
    for (const [i, f] of files.entries()) {
      out.firstChild.textContent = `Working on image ${i + 1} of ${files.length}...`;
      const card = el("div", "card");
      try {
        const r = await tool(f), url = URL.createObjectURL(r.blob), im = el("img"), box = el("div"), a = el("a", "btn", "Download");
        im.src = url; im.alt = ""; a.href = url; a.download = r.name;
        box.append(el("div", "name", r.name), el("div", "note", r.note), a);
        if (r.warn) card.style.borderColor = "#a86a00";
        card.append(im, box);
      } catch (x) {
        card.className = "card err"; card.append(el("div"), el("div", "note", f.name + ": " + (x.message || "could not process this file.")));
      }
      list.append(card);
    }
    out.firstChild.textContent = "Done. Your images were processed on your device and were not uploaded.";
    btn.disabled = false;
  });
}
