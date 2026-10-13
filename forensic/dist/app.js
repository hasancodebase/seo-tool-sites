const $ = s => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const row = (s, l, d) => ({ s, l, d });
const sec = h => ({ h });
const LABEL = { ok: "None found", warn: "Indicator", bad: "Declared AI", info: "Info", unk: "Inconclusive" };
const VERSION = "0.2";
const STEPS_MEDIA = ["Ask where the file came from, and try to get the original, not a copy from chat or social media.",
  "Look for an AI label from the platform, or a statement from the creator.",
  "Search for the picture or video elsewhere (Google Lens, TinEye) to find the earliest copy.",
  "If it matters legally, keep the original unchanged, note its fingerprint (SHA-256) and ask a forensic expert."];
const STEPS_TEXT = ["Ask the writer for drafts or version history.", "Compare with their earlier writing, but do not treat a change in style as proof.",
  "Do not rely on AI-detector scores. They make errors, and they are often wrong about people who write English as a second language.",
  "If it matters formally, ask for the writer's own account and keep the original text."];
const draw = r => {
  if (r.h) return el("h3", "sec", r.h);
  const b = el("div", "row " + r.s);
  b.append(el("b", "", LABEL[r.s]), el("span", "", r.l + ": " + r.d));
  return b;
};
const makeCard = c => {
  const b = el("div", "verdict " + c.level);
  b.append(el("h2", "", c.title), el("p", "big", c.text));
  if (c.reasons.length) { const ul = el("ul"); c.reasons.forEach(r => ul.append(el("li", "", r))); b.append(ul); }
  if (c.facts.length) { const dl = el("dl", "facts"); c.facts.forEach(([k, v]) => dl.append(el("dt", "", k), el("dd", "", v))); b.append(el("h3", "sec", "Key facts"), dl); }
  const ol = el("ol"); c.steps.forEach(s => ol.append(el("li", "", s)));
  b.append(el("h3", "sec", "What to do next"), ol, el("p", "small", "This tool reads labels and data stored inside the file. It does not look at the picture, the sound or the writing style, and it cannot prove that something is real."));
  return b;
};
const show = (card, rows, meta) => {
  const out = $("#out"), dl = el("button", "", "Download report (JSON)"), pr = el("button", "", "Print report"), box = el("p", "actions");
  dl.type = pr.type = "button";
  dl.onclick = () => {
    const report = { tool: "Media Provenance Inspector", version: VERSION, analysedAtUtc: new Date().toISOString(), ...meta,
      result: { level: card.level, title: card.title, text: card.text, reasons: card.reasons, keyFacts: Object.fromEntries(card.facts) },
      details: rows.filter(r => !r.h).map(r => ({ status: r.s, check: r.l, detail: r.d })),
      notice: "Indicators only. Absence of indicators does not prove authenticity. Metadata can be removed or forged." };
    const a = el("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    a.download = "provenance-report.json"; a.click();
  };
  pr.onclick = () => window.print();
  box.append(dl, pr);
  out.replaceChildren(makeCard(card), el("h3", "sec", "Full technical details"), ...rows.map(draw), box);
};
const UNK = { level: "unk", title: "No AI marker found. We cannot tell.", text: "This file has no built-in label saying it is AI-made. That does not mean it is real. Most AI files lose their labels when they are saved, converted, edited or shared." };

async function analyzeFile(file) {
  const rows = [], add = (...x) => rows.push(...x), declared = [], reasons = [], facts = [];
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer()), kind = sniff(head);
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const extKind = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp", gif: "gif", mp4: "mp4", mov: "mp4", m4v: "mp4", mp3: "mp3" }[ext];
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
  facts.push(["File", `${kind === "unknown" ? "Unknown type" : kind.toUpperCase()}, ${(file.size / 1048576).toFixed(1)} MB`]);
  let text = "", c2 = null, exif = null, xmp = null, texts = [], mp = null, id3 = null;
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
    mp = await parseMp4((o, l) => file.slice(o, o + l).arrayBuffer().then(b => new Uint8Array(b)), file.size);
    text = mp.moov ? str(mp.moov, 0, Math.min(mp.moov.length, 4e6)) : "";
    c2 = mp.c2pa ? { sourceTypes: [], actions: [], names: [], boxOnly: true } : c2paInfo(text);
    add(sec("Video container"), row("info", "Brand", mp.brand || "unknown"), row("info", "Top-level boxes", mp.boxes.slice(0, 14).join(", ")),
      row("info", "Creation date stored in file", mp.created || "none stored"), row("info", "Modification date stored in file", mp.modified || "none stored"),
      row("info", "Duration", mp.seconds ? mp.seconds.toFixed(2) + " s" : "unknown"),
      row("info", "Compatible brands", mp.compat.join(", ") || "none listed"), row("info", "Video size", mp.sizes.join(", ") || "not found"),
      row("info", "Codecs", mp.codecs.join(", ") || "not found"), row("info", "Handler names", mp.handlers.join("; ") || "none stored"), row("info", "Encoder tag", mp.encoder.join("; ") || "none stored"));
    if (mp.created && mp.modified && mp.created !== mp.modified) add(row("info", "Dates", "Creation and modification dates differ, so the file may have been saved again."));
  } else if (kind === "mp3") {
    const a = u || new Uint8Array(await file.slice(0, 2e6).arrayBuffer());
    id3 = parseId3(a);
    text = str(a, 0, Math.min(a.length, 30e6)); c2 = c2paInfo(text);
    add(sec("Audio tags (ID3)"));
    if (id3.version) add(row("info", "ID3 version", id3.version));
    id3.frames.forEach(f => add(row("info", "ID3 " + f.id, f.text)));
    if (id3.v1) add(row("info", "ID3v1 title", id3.v1));
    if (!id3.version && !id3.v1) add(row("info", "ID3 tags", "None found."));
    add(row("info", "Audio content", "The sound itself was not analysed. AI voices and music are usually not marked inside the file."));
  } else add(row("warn", "Format", "This version analyses JPEG, PNG, WebP, GIF, MP4, MOV and MP3. Only the file hash was computed."));

  add(sec("Provenance (Content Credentials, C2PA)"));
  if (c2) {
    add(row("info", "Manifest", "Found. The file carries signed provenance data. This tool does not validate the signature, so check it at contentcredentials.org/verify before relying on it."));
    c2.sourceTypes.forEach(t => {
      if (/trainedAlgorithmicMedia/i.test(t)) { declared.push("The file's Content Credentials say it is AI-generated or AI-composited (" + t + ")."); add(row("bad", "Declared source type", t + " (AI-generated or AI-composited, as stated by the manifest)")); }
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
      if (/trainedAlgorithmicMedia/i.test(t)) { declared.push("The file's XMP data says it is AI-generated or AI-composited (" + t.split("/").pop() + ")."); add(row("bad", "XMP digital source type", t.split("/").pop() + " (declares AI-generated or AI-composited content)")); }
      else add(row("info", "XMP digital source type", t.split("/").pop()));
    });
  }
  texts.forEach(t => {
    const v = t.value.length > 400 ? t.value.slice(0, 400) + "..." : t.value;
    if ((t.key === "parameters" && /Steps:\s*\d+/.test(t.value)) || (/prompt|workflow/i.test(t.key) && /class_type/.test(t.value)) || /invokeai|sd-metadata/i.test(t.key)) {
      declared.push("The PNG contains AI image generation settings (" + t.key + ")."); add(row("bad", "PNG text: " + t.key, "Generation parameters left by an AI image tool: " + v));
    } else add(row("info", "PNG text: " + t.key, v));
  });
  if (kind !== "mp3" && !(exif && Object.keys(exif.tags).length) && !xmp && !texts.length && !c2 && text) add(row("info", "Result", "No embedded metadata found. This is common after sharing through social media or messaging apps, and after generation or editing. It proves nothing by itself. Converting a file (for example PNG to WebP) or exporting a video removes generation settings."));

  add(sec("Tool names found inside the file"));
  const hits = scanSigs(text), aiHits = hits.filter(h => h.kind === "ai"), edHits = hits.filter(h => h.kind === "edit");
  if (!hits.length) add(row("info", "AI and editing tool names", "None found. This does not mean none were used."));
  hits.forEach(h => add(h.kind === "ai" ? row("warn", "AI tool name: " + h.name, "…" + h.at + "…") : row("info", "Editing software name: " + h.name, "…" + h.at + "… (shows the file passed through this software, not what was changed)")));

  // Key facts and plain-language findings
  const cam = exif ? [exif.tags["Camera make"], exif.tags["Camera model"]].filter(Boolean).join(" ") : "";
  const when = (exif && (exif.tags["Date taken"] || exif.tags["Date modified"])) || (xmp && (xmp.create[0] || xmp.modify[0])) || (mp && mp.created) || "";
  const soft = (exif && exif.tags["Software"]) || (xmp && xmp.creatorTool[0]) || (mp && (mp.encoder[0] || mp.handlers[0])) || (id3 && (id3.frames.find(f => f.id === "TSSE") || {}).text) || "";
  if (mp) { if (mp.sizes.length) facts.push(["Video size", mp.sizes.join(", ")]); if (mp.seconds) facts.push(["Length", mp.seconds.toFixed(1) + " seconds"]); }
  facts.push(["Date stored in the file", when || "None"], ["Made or last saved by", soft || (edHits[0] && edHits[0].name) || "Not stated"]);
  if (kind !== "mp3") facts.push(["Camera or device", cam || "None found"]);
  if (exif && exif.gps) facts.push(["Location", "A GPS location is stored in the file (sensitive)"]);
  if (sha) facts.push(["Fingerprint (SHA-256)", sha.slice(0, 16) + "... (full value in the details)"]);
  if (kind === "mp4" || ["jpeg", "png", "webp", "gif"].includes(kind)) {
    if (cam) reasons.push("Camera data is present (" + cam + "). That is typical of a straight-from-the-device file, but camera data can be copied or faked.");
    else reasons.push("No camera or device data was found. This is not a straight-from-the-camera file, or its data was removed. AI-made, edited, downloaded, converted and screenshot files all look like this.");
  }
  if (mp && /Lavf|Lavc/.test(mp.encoder.join(" ") + text)) reasons.push("The file was last written by FFmpeg, a free tool used inside many editors, converters and online services. This is common for AI videos, edited videos and downloaded videos alike.");
  if (mp && !mp.created) reasons.push("No creation date is stored in the file.");
  let card;
  if (declared.length) card = { level: "ai", title: "AI marker found.", text: "This file says, in its own data, that it was made or changed with AI.", reasons: [...declared, ...reasons] };
  else if (aiHits.length) card = { level: "maybe", title: "The name of an AI tool appears in this file.", text: "Treat this as a lead, not proof. A name can be added by accident or on purpose.", reasons: [...aiHits.map(h => h.name + " appears in the file."), ...reasons] };
  else card = { ...UNK, reasons };
  Object.assign(card, { facts, steps: STEPS_MEDIA });
  show(card, rows, { file: { name: file.name, size: file.size, type: file.type, formatDetected: kind, fileSystemModified: new Date(file.lastModified).toISOString() }, sha256: sha });
}

function analyzeText(t) {
  const s = scanText(t), rows = [sec("Hidden characters")], reasons = [];
  if (!s.invisible.length) rows.push(row("ok", "Zero-width and invisible characters", "None found."));
  s.invisible.forEach(i => { reasons.push(`${i.name}: ${i.count} found. Editors, web pages and software can add these, and they can be used to mark text.`); rows.push(row("warn", i.name, `${i.count} found, first at position ${i.at}.`)); });
  s.spaces.forEach(i => rows.push(row("info", i.name, `${i.count} found. Common in text copied from web pages and word processors.`)));
  rows.push(sec("Chatbot artifacts"));
  if (!s.artifacts.length) rows.push(row("ok", "Known chatbot artifacts", "None found."));
  s.artifacts.forEach(a => { reasons.push(a + ". It can also appear in a quotation or in text about AI."); rows.push(row("warn", "Artifact", a)); });
  rows.push(row("info", "Markdown formatting", s.markdown ? `${s.markdown} item(s) such as **bold** or # headings. It can come from a chatbot interface or from many other sources.` : "None."),
    sec("Descriptive statistics (not a detector)"), row("info", "Sentences", `${s.sentences}, average ${s.meanLen.toFixed(1)} words, spread ${s.sdLen.toFixed(1)}`),
    row("info", "Vocabulary variety", s.ttr.toFixed(2) + " (unique words divided by total words; it falls as text gets longer)"));
  const found = s.invisible.length + s.artifacts.length;
  const card = found
    ? { level: "maybe", title: "Chatbot traces found in this text.", text: "Hidden characters or chatbot leftovers were found. They are leads, not proof of who or what wrote the text.", reasons }
    : { level: "unk", title: "No chatbot traces found. We cannot tell who wrote this.", text: "No hidden characters or chatbot leftovers were found. That does not show the text was written by a person, and this tool gives no AI score on purpose.", reasons: [] };
  Object.assign(card, { facts: [["Length", `${s.chars.toLocaleString()} characters, ${s.words.toLocaleString()} words`], ["Sentences", String(s.sentences)]], steps: STEPS_TEXT });
  show(card, rows, { text: { characters: s.chars, words: s.words } });
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