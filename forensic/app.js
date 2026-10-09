const $ = s => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const row = (s, l, d) => ({ s, l, d });
const sec = h => ({ h });
const LABEL = { ok: "None found", warn: "Indicator", bad: "Declared AI", info: "Info" };
const VERSION = "0.1";
const draw = r => {
  if (r.h) return el("h3", "sec", r.h);
  const b = el("div", "row " + r.s);
  b.append(el("b", "", LABEL[r.s]), el("span", "", r.l + ": " + r.d));
  return b;
};
const show = (rows, meta) => {
  const out = $("#out"), dl = el("button", "", "Download report (JSON)"), pr = el("button", "", "Print report"), box = el("p", "actions");
  dl.type = pr.type = "button";
  dl.onclick = () => {
    const report = { tool: "Media Provenance Inspector", version: VERSION, analysedAtUtc: new Date().toISOString(), ...meta,
      results: rows.filter(r => !r.h).map(r => ({ status: r.s, check: r.l, detail: r.d })),
      notice: "Indicators only. Absence of indicators does not prove authenticity. Metadata can be removed or forged." };
    const a = el("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    a.download = "provenance-report.json"; a.click();
  };
  pr.onclick = () => window.print();
  box.append(dl, pr);
  out.replaceChildren(...rows.map(draw), box);
};
const CAUTION = row("info", "Important", "Metadata can be removed or forged. A file with no AI indicators is not proven authentic, and an indicator is a lead to investigate, not proof.");

async function analyzeFile(file) {
  const rows = [], add = (...x) => rows.push(...x), declared = [];
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer()), kind = sniff(head);
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const extKind = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp", gif: "gif", mp4: "mp4", mov: "mp4", m4v: "mp4" }[ext];
  add(sec("File"), row("info", "Name", file.name), row("info", "Size", file.size.toLocaleString() + " bytes"),
    row("info", "Format (from file signature)", kind === "unknown" ? "Not recognised" : kind.toUpperCase()),
    row("info", "File system date of this copy", new Date(file.lastModified).toISOString() + " (not necessarily the original creation date)"));
  if (extKind && kind !== "unknown" && extKind !== kind) add(row("warn", "Extension", `The name says .${ext} but the content is ${kind.toUpperCase()}.`));
  let u = null, sha = "";
  add(sec("Integrity"));
  if (file.size <= 100 * 1024 * 1024) {
    const buf = await file.arrayBuffer(); u = new Uint8Array(buf);
    sha = toHex(await crypto.subtle.digest("SHA-256", buf));
    add(row("info", "SHA-256", sha), row("info", "Use", "Record this value. Any change to the file changes it, so it shows that two copies are identical."));
  } else add(row("warn", "SHA-256", "File is over 100 MB, so it was not hashed in the browser. Hash it with another tool."));
  let text = "", c2 = null, exif = null, xmp = null, texts = [];
  if (["jpeg", "png", "webp", "gif"].includes(kind) && u) {
    text = str(u, 0, Math.min(u.length, 30e6));
    if (kind === "jpeg") exif = jpegExif(u);
    if (kind === "png") {
      const ch = pngChunks(u), ex = ch.find(c => c.type === "eXIf");
      if (ex) exif = parseExif(ex.data);
      texts = await pngTexts(ch);
    }
    xmp = parseXmp(new TextDecoder().decode(u.subarray(0, Math.min(u.length, 5e6))));
    c2 = c2paInfo(text);
  } else if (kind === "mp4") {
    const m = await parseMp4((o, l) => file.slice(o, o + l).arrayBuffer().then(b => new Uint8Array(b)), file.size);
    text = m.moov ? str(m.moov, 0, Math.min(m.moov.length, 4e6)) : "";
    c2 = m.c2pa ? { sourceTypes: [], actions: [], names: [], boxOnly: true } : c2paInfo(text);
    add(sec("Video container"), row("info", "Brand", m.brand || "unknown"), row("info", "Top-level boxes", m.boxes.slice(0, 14).join(", ")),
      row("info", "Creation date stored in file", m.created || "none stored"), row("info", "Modification date stored in file", m.modified || "none stored"),
      row("info", "Duration", m.seconds ? m.seconds.toFixed(2) + " s" : "unknown"));
    if (m.created && m.modified && m.created !== m.modified) add(row("info", "Dates", "Creation and modification dates differ, so the file may have been saved again."));
  } else add(row("warn", "Format", "This version analyses JPEG, PNG, WebP, GIF, MP4 and MOV. Only the file hash was computed."));

  add(sec("Provenance (Content Credentials, C2PA)"));
  if (c2) {
    add(row("info", "Manifest", "Found. The file carries signed provenance data. This tool does not validate the signature, so check it at contentcredentials.org/verify before relying on it."));
    c2.sourceTypes.forEach(t => {
      if (/trainedAlgorithmicMedia/i.test(t)) { declared.push("Content Credentials source type: " + t); add(row("bad", "Declared source type", t + " (AI-generated or AI-composited, as stated by the manifest)")); }
      else add(row("info", "Declared source type", t));
    });
    if (c2.actions.length) add(row("info", "Actions recorded", c2.actions.join(", ")));
    if (c2.names.length) add(row("info", "Names found near the manifest", c2.names.join(", ") + " (strings only, not validated)"));
  } else add(row("ok", "Manifest", "None found. Most files carry none, and many platforms and editors remove them."));

  add(sec("Embedded metadata"));
  if (exif && Object.keys(exif.tags).length) Object.entries(exif.tags).forEach(([k, v]) => add(row("info", "EXIF " + k, String(v))));
  if (exif && exif.gps) add(row("warn", "GPS location", `${exif.gps.lat.toFixed(5)}, ${exif.gps.lon.toFixed(5)} (a location is stored in the file; handle it as sensitive)`));
  if (exif && exif.tags["Date taken"] && exif.tags["Date modified"] && exif.tags["Date taken"] !== exif.tags["Date modified"]) add(row("info", "Dates", "Date taken and date modified differ, so the file may have been saved again after capture."));
  if (xmp) {
    const f = (l, a) => a.length && add(row("info", "XMP " + l, [...new Set(a)].join("; ")));
    f("creator tool", xmp.creatorTool); f("create date", xmp.create); f("modify date", xmp.modify); f("history actions", xmp.actions);
    f("history software", xmp.agents); f("history times", xmp.when); f("document ID", xmp.docId); f("original document ID", xmp.origId);
    xmp.sourceType.forEach(t => {
      if (/trainedAlgorithmicMedia/i.test(t)) { declared.push("XMP digital source type: " + t.split("/").pop()); add(row("bad", "XMP digital source type", t.split("/").pop() + " (declares AI-generated or AI-composited content)")); }
      else add(row("info", "XMP digital source type", t.split("/").pop()));
    });
  }
  texts.forEach(t => {
    const v = t.value.length > 400 ? t.value.slice(0, 400) + "..." : t.value;
    if ((t.key === "parameters" && /Steps:\s*\d+/.test(t.value)) || (/prompt|workflow/i.test(t.key) && /class_type/.test(t.value)) || /invokeai|sd-metadata/i.test(t.key)) {
      declared.push("PNG generation parameters (" + t.key + ")"); add(row("bad", "PNG text: " + t.key, "Generation parameters left by an AI image tool: " + v));
    } else add(row("info", "PNG text: " + t.key, v));
  });
  if (!(exif && Object.keys(exif.tags).length) && !xmp && !texts.length && !c2 && text) add(row("info", "Result", "No embedded metadata found. This is common after sharing through social media or messaging apps, and after generation or editing. It proves nothing by itself."));

  add(sec("Tool names found inside the file"));
  const hits = scanSigs(text);
  if (!hits.length) add(row("ok", "AI and editing tool names", "None found."));
  hits.forEach(h => add(h.kind === "ai" ? row("warn", "AI tool name: " + h.name, "…" + h.at + "…") : row("info", "Editing software name: " + h.name, "…" + h.at + "… (shows the file passed through this software, not what was changed)")));

  const flagged = hits.filter(h => h.kind === "ai").length;
  const top = [sec("Summary")];
  if (declared.length) top.push(row("bad", "AI involvement declared", declared.join("; ")));
  else if (flagged) top.push(row("warn", "Indicators found", flagged + " AI tool name(s) appear in the file. Review the details below."));
  else top.push(row("ok", "No AI indicators found in the file's data", "Only embedded data was checked. Image and video content were not analysed."));
  top.push(CAUTION);
  show([...top, ...rows], { file: { name: file.name, size: file.size, type: file.type, formatDetected: kind, fileSystemModified: new Date(file.lastModified).toISOString() }, sha256: sha });
}

function analyzeText(t) {
  const s = scanText(t), rows = [sec("Summary")];
  const n = s.invisible.length + s.artifacts.length;
  rows.push(n ? row("warn", "Markers found", n + " marker type(s) found. Review the details below.") : row("ok", "No markers found", "No hidden characters or chatbot artifacts were found."),
    row("info", "Important", "These are observable markers only. The tool does not decide whether text was written by AI, and no marker, or lack of one, proves it."),
    sec("Text"), row("info", "Characters and words", `${s.chars.toLocaleString()} characters, ${s.words.toLocaleString()} words`), sec("Hidden characters"));
  if (!s.invisible.length) rows.push(row("ok", "Zero-width and invisible characters", "None found."));
  s.invisible.forEach(i => rows.push(row("warn", i.name, `${i.count} found, first at position ${i.at}. Invisible characters can be added by editors, web pages and software, and can be used to mark text.`)));
  s.spaces.forEach(i => rows.push(row("info", i.name, `${i.count} found. Common in text copied from web pages and word processors.`)));
  rows.push(sec("Chatbot artifacts"));
  if (!s.artifacts.length) rows.push(row("ok", "Known chatbot artifacts", "None found."));
  s.artifacts.forEach(a => rows.push(row("warn", "Artifact", a + ". It can also appear in a quotation or in text about AI.")));
  rows.push(row("info", "Markdown formatting", s.markdown ? `${s.markdown} item(s) such as **bold** or # headings. It can come from a chatbot interface or from many other sources.` : "None."),
    sec("Descriptive statistics (not a detector)"),
    row("info", "Sentences", `${s.sentences}, average ${s.meanLen.toFixed(1)} words, spread ${s.sdLen.toFixed(1)}`),
    row("info", "Vocabulary variety", s.ttr.toFixed(2) + " (unique words divided by total words; it falls as text gets longer)"));
  show(rows, { text: { characters: s.chars, words: s.words } });
}
const ff = $("#ff"), tf = $("#tf");
if (ff) ff.addEventListener("submit", async e => {
  e.preventDefault();
  const f = $("#file").files[0], out = $("#out");
  if (!f) return out.replaceChildren(el("p", "msg bad", "Choose a file first."));
  out.replaceChildren(el("p", "msg", "Analysing in your browser..."));
  try { await analyzeFile(f); } catch (x) { out.replaceChildren(el("p", "msg bad", "Could not analyse this file: " + (x.message || "unknown error"))); }
});
if (tf) tf.addEventListener("submit", e => {
  e.preventDefault();
  const t = $("#t").value, out = $("#out");
  if (t.trim().length < 20) return out.replaceChildren(el("p", "msg bad", "Paste at least a sentence of text."));
  analyzeText(t);
});
