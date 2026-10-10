// Forensic parsers. No DOM access here, so every function can be tested in Node.
const L1 = new TextDecoder("latin1");
const str = (u, a = 0, b = u.length) => L1.decode(u.subarray(a, b));
const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const sniff = u => {
  if (u[0] === 0xFF && u[1] === 0xD8 && u[2] === 0xFF) return "jpeg";
  if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4E && u[3] === 0x47) return "png";
  if (str(u, 0, 4) === "RIFF" && str(u, 8, 12) === "WEBP") return "webp";
  if (str(u, 0, 3) === "GIF") return "gif";
  if (str(u, 4, 8) === "ftyp") return "mp4";
  if (str(u, 0, 3) === "ID3" || (u[0] === 0xFF && (u[1] & 0xE0) === 0xE0)) return "mp3";
  return "unknown";
};
const SIGS = [
  ["ai", "Stable Diffusion", /Stable[ -]Diffusion/i], ["ai", "Midjourney", /Midjourney/i], ["ai", "DALL-E", /DALL[^A-Za-z]{0,3}E\b/i],
  ["ai", "Adobe Firefly", /Firefly/i], ["ai", "ComfyUI", /ComfyUI/i], ["ai", "InvokeAI", /InvokeAI/i], ["ai", "NovelAI", /NovelAI/i],
  ["ai", "Leonardo.Ai", /Leonardo\.?Ai/i], ["ai", "Runway", /Runway(ML)?\b/], ["ai", "OpenAI", /OpenAI/i], ["ai", "Sora", /\bSora\b/],
  ["ai", "Google Imagen or Gemini", /\b(Imagen|Gemini)\b/], ["ai", "Ideogram", /Ideogram/i],
  ["edit", "Adobe Photoshop", /Photoshop/i], ["edit", "Adobe Lightroom", /Lightroom/i], ["edit", "GIMP", /\bGIMP\b/], ["edit", "Canva", /\bCanva\b/],
  ["edit", "Adobe Premiere or After Effects", /Premiere|After Effects/i], ["edit", "DaVinci Resolve", /DaVinci/i], ["edit", "CapCut", /CapCut/i],
  ["edit", "FFmpeg (re-encoded)", /Lavf\d|Lavc\d|FFmpeg/i], ["edit", "HandBrake", /HandBrake/i], ["edit", "Final Cut Pro", /Final Cut/i],
];
const scanSigs = text => SIGS.flatMap(([kind, name, re]) => {
  const m = re.exec(text);
  return m ? [{ kind, name, at: text.slice(Math.max(0, m.index - 30), m.index + 50).replace(/[^\x20-\x7e]+/g, " ").trim() }] : [];
});
const val = (dv, type, cnt, vo, le) => {
  if (type === 2) { let s = ""; for (let i = 0; i < cnt; i++) { const c = dv.getUint8(vo + i); if (!c) break; s += String.fromCharCode(c); } return s.trim(); }
  if (type === 3) return dv.getUint16(vo, le);
  if (type === 4) return dv.getUint32(vo, le);
  if (type === 5) { const r = []; for (let i = 0; i < cnt; i++) r.push(dv.getUint32(vo + 8 * i, le) / (dv.getUint32(vo + 8 * i + 4, le) || 1)); return r; }
  return null;
};
const EXIF_NAMES = { 0x010F: "Camera make", 0x0110: "Camera model", 0x0131: "Software", 0x0132: "Date modified", 0x013B: "Artist", 0x8298: "Copyright", 0x9003: "Date taken", 0x9004: "Date digitized", 0xA434: "Lens model", 0xA431: "Body serial number" };
function readIFD(dv, off, le, out, kind) {
  if (off + 2 > dv.byteLength) return;
  const n = dv.getUint16(off, le);
  for (let i = 0; i < n; i++) {
    const e = off + 2 + i * 12;
    if (e + 12 > dv.byteLength) break;
    const tag = dv.getUint16(e, le), type = dv.getUint16(e + 2, le), cnt = dv.getUint32(e + 4, le);
    const size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 }[type] || 1) * cnt, vo = size <= 4 ? e + 8 : dv.getUint32(e + 8, le);
    if (kind === "main" && (tag === 0x8769 || tag === 0x8825)) { readIFD(dv, dv.getUint32(e + 8, le), le, out, tag === 0x8769 ? "exif" : "gps"); continue; }
    if (vo + size > dv.byteLength) continue;
    const v = val(dv, type, cnt, vo, le);
    if (kind === "gps") { out.gpsRaw[tag] = v; continue; }
    if (EXIF_NAMES[tag] && v !== null && v !== "") out.tags[EXIF_NAMES[tag]] = v;
  }
}
const parseExif = u => {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), le = dv.getUint16(0) === 0x4949, out = { tags: {}, gpsRaw: {}, gps: null };
  try { readIFD(dv, dv.getUint32(4, le), le, out, "main"); } catch (e) {}
  const g = out.gpsRaw, dms = a => a[0] + a[1] / 60 + a[2] / 3600;
  if (g[2] && g[4]) out.gps = { lat: (g[1] === "S" ? -1 : 1) * dms(g[2]), lon: (g[3] === "W" ? -1 : 1) * dms(g[4]) };
  return out;
};
const jpegExif = u => {
  let i = 2;
  while (i + 4 < u.length && u[i] === 0xFF) {
    const m = u[i + 1], len = (u[i + 2] << 8) | u[i + 3];
    if (m === 0xDA) break;
    if (m === 0xE1 && str(u, i + 4, i + 10) === "Exif\0\0") return parseExif(u.subarray(i + 10, i + 2 + len));
    i += 2 + len;
  }
  return null;
};
const pngChunks = u => {
  const out = [], dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let i = 8;
  while (i + 12 <= u.length) {
    const len = dv.getUint32(i), type = str(u, i + 4, i + 8);
    out.push({ type, data: u.subarray(i + 8, i + 8 + len) });
    i += 12 + len;
  }
  return out;
};
async function inflate(u) {
  const ds = new DecompressionStream("deflate"), w = ds.writable.getWriter();
  w.write(u); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
async function pngTexts(chunks) {
  const out = [];
  for (const c of chunks) {
    try {
      const d = c.data, z = d.indexOf(0);
      if (c.type === "tEXt") out.push({ key: str(d, 0, z), value: str(d, z + 1) });
      else if (c.type === "zTXt") out.push({ key: str(d, 0, z), value: str(await inflate(d.subarray(z + 2))) });
      else if (c.type === "iTXt") {
        let p = z + 3; p = d.indexOf(0, p) + 1; p = d.indexOf(0, p) + 1;
        const body = d.subarray(p);
        out.push({ key: str(d, 0, z), value: new TextDecoder().decode(d[z + 1] ? await inflate(body) : body) });
      }
    } catch (e) {}
  }
  return out;
}
const parseXmp = s => {
  const m = /<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/.exec(s);
  if (!m) return null;
  const x = m[0], get = n => [...x.matchAll(new RegExp(n + '\\s*=\\s*"([^"]*)"|<' + n + '[^>]*>([^<]+)<', "g"))].map(a => (a[1] || a[2] || "").trim()).filter(Boolean);
  return { creatorTool: get("xmp:CreatorTool"), create: get("xmp:CreateDate"), modify: get("xmp:ModifyDate"), sourceType: get("Iptc4xmpExt:DigitalSourceType"),
    agents: get("stEvt:softwareAgent"), actions: get("stEvt:action"), when: get("stEvt:when"), docId: get("xmpMM:DocumentID"), origId: get("xmpMM:OriginalDocumentID") };
};
const c2paInfo = text => {
  const i = text.indexOf("c2pa");
  if (i < 0) return null;
  const region = text.slice(Math.max(0, i - 200), i + 60000), uniq = a => [...new Set(a)];
  return {
    sourceTypes: uniq([...region.matchAll(/cv\.iptc\.org\/newscodes\/digitalsourcetype\/(\w+)/g)].map(m => m[1])),
    actions: uniq([...region.matchAll(/c2pa\.(created|edited|converted|placed|opened|published|filtered|cropped|drawing|color_adjustments|resized|transcoded|repackaged)/g)].map(m => "c2pa." + m[1])),
    names: ["Adobe", "OpenAI", "DALL", "Firefly", "Google", "Gemini", "Microsoft", "Bing", "Midjourney", "Truepic", "Sora", "Leica", "Sony", "Nikon", "Canon", "Samsung", "Meta", "Runway", "Stability", "BBC", "Amazon"].filter(n => region.includes(n)),
  };
};
async function parseMp4(read, size) {
  const out = { brand: "", boxes: [], c2pa: false, created: null, modified: null, seconds: null, moov: null };
  let off = 0, n = 0;
  while (off + 8 <= size && n++ < 400) {
    const h = await read(off, 16), dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
    let len = dv.getUint32(0), hdr = 8; const type = str(h, 4, 8);
    if (len === 1 && h.length >= 16) { len = Number(dv.getBigUint64(8)); hdr = 16; } else if (len === 0) len = size - off;
    if (len < 8) break;
    out.boxes.push(type);
    if (type === "ftyp") out.brand = str(await read(off + 8, 4));
    if (type === "uuid") { const id = await read(off + hdr, 16); if (id[0] === 0xd8 && id[1] === 0xfe && id[2] === 0xc3 && id[3] === 0xd6) out.c2pa = true; }
    if (type === "moov" && len < 64 * 1024 * 1024) out.moov = await read(off, len);
    off += len;
  }
  if (out.moov) {
    const m = out.moov, dv = new DataView(m.buffer, m.byteOffset, m.byteLength), at = str(m).indexOf("mvhd");
    if (at >= 0) {
      const p = at + 4, v = m[p], conv = t => (t > 0 ? new Date((Number(t) - 2082844800) * 1000).toISOString() : null);
      if (v === 0) { out.created = conv(dv.getUint32(p + 4)); out.modified = conv(dv.getUint32(p + 8)); out.seconds = dv.getUint32(p + 16) / (dv.getUint32(p + 12) || 1); }
      else { out.created = conv(dv.getBigUint64(p + 4)); out.modified = conv(dv.getBigUint64(p + 12)); out.seconds = Number(dv.getBigUint64(p + 24)) / (dv.getUint32(p + 20) || 1); }
    }
  }
  return out;
}
const syncsafe = (u, i) => ((u[i] & 127) << 21) | ((u[i + 1] & 127) << 14) | ((u[i + 2] & 127) << 7) | (u[i + 3] & 127);
const id3Text = d => {
  const enc = d[0], b = d.subarray(1);
  return (enc === 1 || enc === 2 ? new TextDecoder("utf-16le").decode(b) : enc === 3 ? new TextDecoder().decode(b) : str(b)).replace(/^\uFEFF/, "").replace(/\u0000+$/, "").replace(/\u0000/g, ": ");
};
const parseId3 = u => {
  const out = { version: "", frames: [], v1: null };
  if (str(u, 0, 3) === "ID3") {
    const ver = u[3], end = Math.min(u.length, 10 + syncsafe(u, 6)), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    out.version = "2." + ver;
    let i = 10;
    while (i + 10 <= end) {
      const id = str(u, i, i + 4);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const len = ver === 4 ? syncsafe(u, i + 4) : dv.getUint32(i + 4), d = u.subarray(i + 10, i + 10 + len);
      let text = "(" + len + " bytes)";
      if (d.length && id[0] === "T") text = id3Text(d);
      else if (d.length > 4 && id === "COMM") text = id3Text(new Uint8Array([d[0], ...d.subarray(4)]));
      out.frames.push({ id, text: text.slice(0, 300) });
      i += 10 + len;
    }
  }
  if (u.length > 128 && str(u, u.length - 128, u.length - 125) === "TAG") out.v1 = str(u, u.length - 125, u.length - 95).replace(/\0+$/, "").trim();
  return out;
};
const INVIS = { "\u200B": "Zero width space", "\u200C": "Zero width non-joiner", "\u200D": "Zero width joiner", "\u2060": "Word joiner", "\uFEFF": "Zero width no-break space", "\u00AD": "Soft hyphen", "\u200E": "Left-to-right mark", "\u200F": "Right-to-left mark" };
const ODD_SPACE = { "\u00A0": "No-break space", "\u202F": "Narrow no-break space", "\u2009": "Thin space" };
const ARTIFACTS = [
  ["Link tracking tag from a chatbot (utm_source=chatgpt.com or openai)", /utm_source=(chatgpt\.com|openai)/i], ["Chatbot citation marker (oaicite or contentReference)", /oaicite|contentReference/i],
  ["Bracketed citation marker such as 【4:0†source】", /【\d+[:†][^】]*】/], ["Phrase: \"As an AI language model\"", /\bAs an AI( language)? model\b/i],
  ["Phrase: \"I'm sorry, but I can't\"", /\bI('m| am) sorry, but I (can('|no)?t|cannot)\b/i], ["Phrase: \"as of my last knowledge update\"", /\bas of my (last )?(knowledge )?(cutoff|update)\b/i],
  ["Interface text: \"Regenerate response\"", /Regenerate response/i], ["Opening such as \"Certainly! Here is\"", /\bCertainly! Here('s| is)\b/],
];
const scanText = t => {
  const find = map => Object.entries(map).flatMap(([c, name]) => { const k = [...t].filter(x => x === c).length; return k ? [{ name, count: k, at: t.indexOf(c) }] : []; });
  const words = t.toLowerCase().match(/[a-z\u00C0-\u024F']+/g) || [], sents = (t.match(/[^.!?]+[.!?]+/g) || []).map(s => (s.match(/[a-z\u00C0-\u024F']+/gi) || []).length).filter(Boolean);
  const mean = sents.length ? sents.reduce((a, b) => a + b, 0) / sents.length : 0;
  return {
    chars: t.length, words: words.length, invisible: find(INVIS), spaces: find(ODD_SPACE),
    artifacts: ARTIFACTS.filter(([, re]) => re.test(t)).map(([name]) => name),
    markdown: (t.match(/\*\*[^*\n]+\*\*/g) || []).length + (t.match(/^#{1,4} /gm) || []).length,
    sentences: sents.length, meanLen: mean, sdLen: sents.length ? Math.sqrt(sents.reduce((a, b) => a + (b - mean) ** 2, 0) / sents.length) : 0,
    ttr: words.length ? new Set(words).size / words.length : 0,
  };
};
if (typeof module !== "undefined") module.exports = { sniff, scanSigs, parseExif, jpegExif, pngChunks, pngTexts, parseXmp, c2paInfo, parseMp4, parseId3, scanText, toHex, str };