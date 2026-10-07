const WHATSAPP = "923232327154"; // WhatsApp number with country code, no + or zeros. Empty hides the button.
const $ = s => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const row = (s, l, d) => ({ s, l, d });
const LABEL = { ok: "Pass", warn: "Check", bad: "Fix", info: "Info" };
const raw = async (u, mode) => {
  const res = await fetch(`/api/raw?mode=${mode}&url=` + encodeURIComponent(u));
  const c = await res.json();
  if (c.error) throw new Error(c.error);
  return c;
};
const origin = u => new URL(/^https?:\/\//i.test(u) ? u : "https://" + u).origin;
const doc = (r, type) => new DOMParser().parseFromString(r.body, type);
const norm = x => x.replace(/#.*$/, "").replace(/\/$/, "");
// ROBOTS-LOGIC-START
const parseRobots = txt => {
  const groups = [], sitemaps = []; let cur = null;
  txt.split(/\r?\n/).forEach(line => {
    const m = line.replace(/#.*/, "").match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/);
    if (!m) return;
    const k = m[1].toLowerCase(), v = m[2];
    if (k === "user-agent") { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); }
    else if (k === "sitemap") sitemaps.push(v);
    else if ((k === "allow" || k === "disallow") && cur) cur.rules.push({ allow: k === "allow", path: v });
  });
  return { groups, sitemaps };
};
const allowed = (rules, path) => {
  let best = null;
  rules.forEach(r => {
    if (!r.path) return;
    const re = new RegExp("^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (re.test(path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  });
  return best ? best.allow : true;
};
// ROBOTS-LOGIC-END

const T = {
  async robots({ u, p }) {
    const o = origin(u), r = await raw(o + "/robots.txt", "text"), rows = [row("info", "File", o + "/robots.txt")];
    if (r.status === 404) return [...rows, row("warn", "robots.txt", "Not found (404). Crawlers will crawl everything. Add one to control crawling and list your sitemap.")];
    if (r.status >= 400) return [...rows, row("bad", "robots.txt", `Returned status ${r.status}. A server error can stop Google crawling your site.`)];
    const { groups, sitemaps } = parseRobots(r.body), star = groups.find(g => g.agents.includes("*"));
    const block = star && star.rules.some(x => !x.allow && x.path === "/");
    rows.push(row("ok", "robots.txt", `Found (status ${r.status}), ${groups.length} user-agent group(s).`),
      row(block ? "bad" : "ok", "Blocks whole site", block ? "User-agent * has Disallow: / so crawlers are told not to crawl anything." : "No rule blocks the whole site."),
      row(sitemaps.length ? "ok" : "warn", "Sitemap line", sitemaps.length ? sitemaps.join(", ") : "None. Add a Sitemap line so crawlers find your sitemap."));
    if (p) {
      const g = groups.find(x => x.agents.includes("googlebot")) || star, path = p.startsWith("/") ? p : "/" + p, ok = g ? allowed(g.rules, path) : true;
      rows.push(row(ok ? "ok" : "bad", "Path " + path, ok ? "Allowed for Googlebot." : "Blocked for Googlebot."));
    }
    return rows;
  },
  async sitemap({ u }) {
    const r = await raw(u, "text");
    if (r.status >= 400) return [row("bad", "Sitemap", `Could not load it. Status ${r.status}.`)];
    const d = doc(r, "application/xml");
    if (d.querySelector("parsererror")) return [row("bad", "XML", "The file is not valid XML.")];
    const root = d.documentElement.localName, locs = [...d.getElementsByTagName("loc")].map(x => x.textContent.trim());
    const dup = locs.length - new Set(locs).size, http = locs.filter(x => /^http:/i.test(x)).length;
    const host = h => { try { return new URL(h).hostname.replace(/^www\./, ""); } catch { return ""; } };
    const other = locs.filter(x => host(x) !== host(r.finalUrl)).length;
    return [
      row(root === "urlset" || root === "sitemapindex" ? "ok" : "bad", "Type", root === "sitemapindex" ? "Sitemap index (lists other sitemaps)" : root === "urlset" ? "URL sitemap" : "Unexpected root element: " + root),
      row(locs.length ? "ok" : "bad", "Entries", `${locs.length} found.`),
      row(locs.length > 50000 ? "bad" : "ok", "Size limit", locs.length > 50000 ? "Over 50,000 URLs. Split into several sitemaps." : "Within the 50,000 URL limit."),
      row(dup ? "warn" : "ok", "Duplicates", dup ? `${dup} duplicate URL(s).` : "No duplicates."),
      row(http ? "warn" : "ok", "HTTPS", http ? `${http} URL(s) use http.` : "All URLs use https."),
      row(other ? "warn" : "ok", "Host", other ? `${other} URL(s) are on a different host than the sitemap.` : "All URLs are on the same host."),
      row("info", "Last modified dates", `${d.getElementsByTagName("lastmod").length} entries have a lastmod date.`),
      ...locs.slice(0, 10).map(x => row("info", "URL", x)),
    ];
  },
  async redirect({ u }) {
    const h = (await raw(u, "chain")).hops, n = h.filter(x => x.status >= 300 && x.status < 400).length, last = h[h.length - 1];
    const loop = new Set(h.map(x => x.url)).size < h.length;
    const rows = [row(loop || n > 3 ? "bad" : n > 1 ? "warn" : "ok", "Redirects", loop ? "Redirect loop detected." : n === 0 ? "No redirect. The URL loads directly." : `${n} redirect(s).${n > 1 ? " Shorten the chain to a single redirect." : ""}`)];
    if ([302, 303, 307].includes(h[0].status)) rows.push(row("warn", "Redirect type", "The first redirect is temporary. Use 301 or 308 for permanent moves."));
    h.forEach((x, i) => rows.push(row(x.status === 0 || x.status >= 400 ? "bad" : x.status >= 300 ? "info" : "ok", `Step ${i + 1}: ${x.status}`, x.location ? `${x.url} to ${x.location}` : x.url)));
    if (h.length >= 10 && last.status >= 300) rows.push(row("bad", "Too many redirects", "Stopped after 10 steps."));
    return rows;
  },
  async headers({ u }) {
    const r = await raw(u, "text"), H = r.headers, xr = H["x-robots-tag"];
    const rows = [row(r.status < 400 ? "ok" : "bad", "Status code", String(r.status)), row("info", "Final URL", r.finalUrl),
      row(/noindex/i.test(xr || "") ? "bad" : "ok", "X-Robots-Tag", xr || "Not set. Headers do not block indexing.")];
    [["strict-transport-security", "Strict-Transport-Security"], ["content-security-policy", "Content-Security-Policy"], ["x-content-type-options", "X-Content-Type-Options"],
      ["x-frame-options", "X-Frame-Options"], ["referrer-policy", "Referrer-Policy"]].forEach(([k, l]) => rows.push(row(H[k] ? "ok" : "warn", l, H[k] ? H[k].slice(0, 160) : "Missing.")));
    return rows.concat(Object.entries(H).slice(0, 40).map(([k, v]) => row("info", k, v.slice(0, 160))));
  },
  async schema({ u }) {
    const r = await raw(u, "text"), blocks = [...doc(r, "text/html").querySelectorAll('script[type="application/ld+json"]')];
    const rows = [row(blocks.length ? "ok" : "warn", "JSON-LD blocks", blocks.length ? `${blocks.length} found.` : "None found. Add structured data where it fits the page.")];
    const need = { Article: ["headline"], NewsArticle: ["headline"], BlogPosting: ["headline"], Product: ["name"], Organization: ["name"], Person: ["name"],
      LocalBusiness: ["name", "address"], FAQPage: ["mainEntity"], BreadcrumbList: ["itemListElement"], Recipe: ["name"], Event: ["name", "startDate"] };
    const walk = n => Array.isArray(n) ? n.flatMap(walk) : n && typeof n === "object" ? [n, ...(n["@graph"] ? walk(n["@graph"]) : [])] : [];
    blocks.forEach((b, i) => {
      let j; try { j = JSON.parse(b.textContent); } catch { rows.push(row("bad", `Block ${i + 1}`, "Invalid JSON. Fix the syntax.")); return; }
      walk(j).forEach(n => [].concat(n["@type"] || []).forEach(t => {
        const miss = (need[t] || []).filter(k => !n[k]);
        rows.push(row(miss.length ? "warn" : "ok", "Type: " + t, miss.length ? "Missing: " + miss.join(", ") + "." : "Has the main required properties."));
      }));
    });
    return rows;
  },
  async hreflang({ u }) {
    const r = await raw(u, "text"), ls = [...doc(r, "text/html").querySelectorAll('link[rel~="alternate"][hreflang]')];
    if (!ls.length) return [row("info", "Hreflang", "No hreflang tags found. They are only needed for pages with language or region versions.")];
    const codes = ls.map(l => l.getAttribute("hreflang").toLowerCase()), hrefs = ls.map(l => l.getAttribute("href") || "");
    const invalid = codes.filter(c => !/^(x-default|[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?)$/.test(c)), dup = new Set(codes).size < codes.length;
    return [
      row("ok", "Tags found", String(ls.length)),
      row(dup ? "bad" : "ok", "Duplicates", dup ? "Some language codes appear more than once." : "No duplicate codes."),
      row(invalid.length ? "bad" : "ok", "Language codes", invalid.length ? "Invalid: " + invalid.join(", ") : "All codes look valid."),
      row(codes.includes("x-default") ? "ok" : "warn", "x-default", codes.includes("x-default") ? "Present." : "Missing. Add an x-default fallback."),
      row(hrefs.some(h => norm(h) === norm(r.finalUrl)) ? "ok" : "warn", "Self-reference", hrefs.some(h => norm(h) === norm(r.finalUrl)) ? "This page lists itself." : "This page does not list itself."),
      row(hrefs.every(h => /^https?:\/\//i.test(h)) ? "ok" : "bad", "Absolute URLs", hrefs.every(h => /^https?:\/\//i.test(h)) ? "All links are absolute." : "Some links are relative. Use full URLs."),
      ...ls.slice(0, 40).map(l => row("info", l.getAttribute("hreflang"), l.getAttribute("href") || "")),
    ];
  },
};

const draw = r => {
  const b = el("div", "row " + r.s);
  b.append(el("b", "", LABEL[r.s]), el("span", "", r.l + ": " + r.d));
  return b;
};
const form = $("#f");
const offer = (n, url) => {
  const to = form.dataset.contact, q = encodeURIComponent, subject = "Fix technical SEO issues on " + url;
  const body = "Hi, I used your checker on " + url + " and it found " + n + " issue(s). Please send me a quote.";
  const b = el("div", "offer"), a = el("a", "", `Fix these issues for you: ${form.dataset.price}`);
  a.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${q(to)}&su=${q(subject)}&body=${q(body)}`;
  a.target = "_blank"; a.rel = "noopener";
  const m = el("a", "alt", "Use another email app");
  m.href = `mailto:${to}?subject=${q(subject)}&body=${q(body)}`;
  const c = el("button", "alt", "Copy email address"); c.type = "button";
  c.onclick = () => navigator.clipboard.writeText(to).then(() => { c.textContent = "Copied: " + to; });
  const alt = el("p", "small"); alt.append(m, " or ", c);
  const w = WHATSAPP ? el("a", "wa", "Message on WhatsApp") : document.createTextNode("");
  if (WHATSAPP) { w.href = `https://wa.me/${WHATSAPP}?text=${q(body)}`; w.target = "_blank"; w.rel = "noopener"; }
  const pay = el("p", "small", "Payment by Payoneer, bank transfer or crypto. Details are sent after you get in touch.");
  b.append(el("h2", "", `${n} issue${n > 1 ? "s" : ""} found`), el("p", "", "We fix every issue found here for one price. One site check, technical SEO only. Send a message to start."), a, w, alt, pay);
  return b;
};
form.addEventListener("submit", async e => {
  e.preventDefault();
  const out = $("#out"), btn = form.querySelector("button"), url = $("#u").value.trim();
  btn.disabled = true;
  out.replaceChildren(el("p", "msg", "Checking..."));
  try {
    const rows = await T[form.dataset.tool]({ u: url, p: ($("#p")?.value || "").trim() });
    out.replaceChildren(el("p", "msg", "Results for " + url), ...rows.map(draw));
    const n = rows.filter(r => r.s === "bad" || r.s === "warn").length;
    if (n && form.dataset.contact) out.append(offer(n, url));
  } catch (x) {
    out.replaceChildren(el("p", "msg bad", x.message || "Something went wrong. Try again."));
  }
  btn.disabled = false;
});
