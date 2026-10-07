// Cloudflare Pages Function: fetches a public URL for the technical checkers.
// mode=text  -> status, headers and body (text types only)
// mode=chain -> follows redirects one step at a time and reports every hop
export async function onRequestGet({ request }) {
  const sp = new URL(request.url).searchParams;
  const u = parse(sp.get("url") || "");
  if (!u) return j({ error: "Enter a valid public URL, like https://example.com" }, 400);
  const H = { "User-Agent": "TechnicalSEOCheckBot/1.0 (free technical SEO checker)" };
  try {
    if (sp.get("mode") === "chain") {
      const hops = []; let cur = u;
      for (let i = 0; i < 10; i++) {
        const r = await fetch(cur, { redirect: "manual", headers: H, signal: AbortSignal.timeout(6000) });
        const loc = r.headers.get("location") || "";
        hops.push({ url: cur.href, status: r.status, location: loc });
        if (r.status < 300 || r.status >= 400 || !loc) break;
        let next; try { next = parse(new URL(loc, cur).href); } catch {}
        if (!next) { hops.push({ url: loc, status: 0, location: "Blocked: not a public address" }); break; }
        cur = next;
      }
      return j({ hops });
    }
    const r = await fetch(u, { redirect: "follow", headers: H, signal: AbortSignal.timeout(8000) });
    const headers = {}; r.headers.forEach((v, k) => { headers[k] = v; });
    const body = /text|xml|json|html/i.test(headers["content-type"] || "") ? (await r.text()).slice(0, 1500000) : "";
    return j({ finalUrl: r.url, status: r.status, headers, body });
  } catch {
    return j({ error: "Could not load that URL. Check it and try again." }, 502);
  }
}
// Public hostnames only: blocks IP addresses, localhost and internal names.
const parse = raw => {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
    return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(u.hostname) && !/\.(local|internal|localhost)$/i.test(u.hostname) ? u : null;
  } catch { return null; }
};
const j = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { "content-type": "application/json", "cache-control": "no-store" },
});
