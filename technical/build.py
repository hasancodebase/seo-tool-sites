"""Builds the site into dist/.  Usage: python3 build.py https://YOUR-PROJECT.pages.dev"""
import sys, shutil, pathlib
SITE = (sys.argv[1] if len(sys.argv) > 1 else "https://technicalseochecker.pages.dev").rstrip("/")
NAME = "Technical SEO Checker"
CONTACT = "dev.naeemhasan@gmail.com"   # your email address. Leave empty to hide the "fix these issues" offer.
PRICE = "$25"
OTHER = "https://seosnippetchecker.pages.dev"   # your on-page tools site, linked once in the footer
OUT = pathlib.Path("dist"); shutil.rmtree(OUT, ignore_errors=True); OUT.mkdir()
ONE = [("u", "Page URL", "https://example.com/page", 1)]

TOOLS = [
 dict(slug="robots-txt-checker", tool="robots", short="Robots.txt checker", title="Robots.txt Checker and Tester - Free Online Tool", h1="Robots.txt checker and tester",
  desc="Check a site's robots.txt, see whether it blocks crawlers, and test whether a path is allowed for Googlebot.",
  intro="Enter a website address to read its robots.txt. Add a path to test whether Googlebot may crawl it.",
  fields=[("u", "Website URL", "https://example.com", 1), ("p", "Path to test (optional)", "/private/page", 0)],
  what="Loads the robots.txt file, checks that it exists, that it does not block the whole site, and that it lists a sitemap.",
  tips=["Never leave Disallow: / on a live site you want in search.", "Add a Sitemap line pointing to your sitemap.xml.", "Use robots.txt to block crawling, and a noindex tag to keep a page out of results."],
  faq=[("Does robots.txt remove a page from Google?", "No. It only asks crawlers not to crawl. A blocked page can still be indexed if other sites link to it. Use a noindex tag instead."),
       ("Where must robots.txt be?", "At the root of the site, for example https://example.com/robots.txt.")]),
 dict(slug="sitemap-validator", tool="sitemap", short="Sitemap validator", title="XML Sitemap Validator - Free Online Tool", h1="XML sitemap validator",
  desc="Validate an XML sitemap: check the format, count URLs and find duplicates, http links and URLs on other hosts.",
  intro="Enter the address of a sitemap to check that it is valid and clean.", fields=[("u", "Sitemap URL", "https://example.com/sitemap.xml", 1)],
  what="Loads the sitemap, checks it is valid XML, counts the URLs and looks for duplicates, http links and URLs on another host.",
  tips=["Keep each sitemap under 50,000 URLs, or use a sitemap index.", "List only canonical, indexable URLs that return 200.", "Use https URLs on the same host as the sitemap."],
  faq=[("What is a sitemap?", "An XML file that lists the pages you want search engines to find."),
       ("Do I need a sitemap?", "Small sites with good internal links may not, but a sitemap helps Google find new pages faster.")]),
 dict(slug="redirect-checker", tool="redirect", short="Redirect checker", title="Redirect Checker - 301 and 302 Chain Tester", h1="Redirect checker",
  desc="Follow a URL's redirects step by step and find long chains, loops and temporary redirects.",
  intro="Enter a URL to see every redirect hop and the final status code.", fields=ONE,
  what="Follows the URL one redirect at a time, up to 10 steps, and shows each status code and destination.",
  tips=["Redirect straight to the final URL in one step.", "Use 301 or 308 for permanent moves.", "Fix loops and update internal links so they skip redirects."],
  faq=[("What is the difference between 301 and 302?", "301 is a permanent redirect. 302 is temporary, so search engines may keep the old URL."),
       ("Are redirect chains bad?", "Each extra hop slows the page and can waste crawl budget. Aim for one redirect at most.")]),
 dict(slug="http-header-checker", tool="headers", short="HTTP header checker", title="HTTP Header Checker - Status Code and Security Headers", h1="HTTP header checker",
  desc="See a URL's status code and response headers, including X-Robots-Tag and common security headers.",
  intro="Enter a URL to see its status code and headers, and check for a noindex header.", fields=ONE,
  what="Fetches the URL and shows the status code, the X-Robots-Tag header and five common security headers.",
  tips=["Make sure important pages return status 200.", "Remove any X-Robots-Tag noindex from pages that should rank.", "Add HSTS and X-Content-Type-Options for basic protection."],
  faq=[("What does X-Robots-Tag do?", "It sends indexing instructions in the HTTP header, such as noindex, instead of in the page HTML."),
       ("Are security headers a ranking factor?", "Not directly, but they protect visitors and show a well-maintained site.")]),
 dict(slug="schema-checker", tool="schema", short="Schema checker", title="Structured Data (Schema) Checker - JSON-LD", h1="Structured data checker",
  desc="Find JSON-LD structured data on a page, catch invalid JSON and missing key properties.",
  intro="Enter a page URL to find its JSON-LD structured data and check the basics.", fields=ONE,
  what="Reads the JSON-LD blocks, checks the JSON is valid and looks for the main required properties of common types.",
  tips=["Fix invalid JSON first, because Google ignores broken blocks.", "Fill every required property for the type you use.", "Only mark up content that is visible on the page."],
  faq=[("What is JSON-LD?", "A way to add structured data to a page so search engines understand its content."),
       ("Does this replace Google's Rich Results Test?", "No. It is a quick basic check. Use Google's tool to confirm eligibility for rich results.")]),
 dict(slug="hreflang-checker", tool="hreflang", short="Hreflang checker", title="Hreflang Checker - Free Online Tool", h1="Hreflang checker",
  desc="Check a page's hreflang tags for duplicates, invalid codes, a missing x-default and a missing self-reference.",
  intro="Enter a page URL to check its hreflang tags.", fields=ONE,
  what="Reads the hreflang link tags in the page and checks the codes, duplicates, x-default and self-reference.",
  tips=["Include a self-referencing tag on every language version.", "Add an x-default for visitors who match no language.", "Use full URLs and valid codes such as en-us or fr."],
  faq=[("When do I need hreflang?", "When you have the same content in several languages or for several regions."),
       ("Must the pages link back to each other?", "Yes. Each version should list all the others, and this tool checks only the page you enter.")]),
]
nav = "".join(f'<a href="/{t["slug"]}">{t["short"]}</a>' for t in TOOLS)

def page(title, desc, path, body, script=True):
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}"><link rel="canonical" href="{SITE}{path}">
<link rel="stylesheet" href="/style.css"></head><body>
<header><a class="brand" href="/">{NAME}</a><nav>{nav}</nav></header>
<main>{body}</main>
<footer>{NAME} offers free technical SEO checkers. Pages are fetched live and are not stored. <a href="/about">About and contact</a> | <a href="{OTHER}">On-page SEO tools</a></footer>
{'<script src="/app.js" defer></script>' if script else ''}</body></html>'''

def form(t):
    f = t["fields"]
    attrs = f'id="f" data-tool="{t["tool"]}" data-contact="{CONTACT}" data-price="{PRICE}"'
    if len(f) == 1:
        i, l, p, r = f[0]
        return f'<form {attrs}><label for="{i}">{l}</label><div class="bar"><input id="{i}" type="text" inputmode="url" placeholder="{p}" required><button>Check</button></div></form>'
    inputs = "".join(f'<label for="{i}">{l}</label><input id="{i}" type="text" placeholder="{p}"{" required" if r else ""}>' for i, l, p, r in f)
    return f'<form {attrs} class="stack">{inputs}<button>Check</button></form>'

for t in TOOLS:
    body = f'''<h1>{t["h1"]}</h1><p class="lead">{t["intro"]}</p>{form(t)}<div id="out" aria-live="polite"></div>
<section><h2>What this checks</h2><p>{t["what"]}</p><h2>How to fix common problems</h2><ul>{"".join(f"<li>{x}</li>" for x in t["tips"])}</ul></section>
<section><h2>Common questions</h2>{"".join(f"<h3>{q}</h3><p>{a}</p>" for q, a in t["faq"])}</section>'''
    (OUT / f'{t["slug"]}.html').write_text(page(t["title"], t["desc"], "/" + t["slug"], body))

items = "".join(f'<li><a href="/{t["slug"]}">{t["h1"]}</a><br>{t["desc"]}</li>' for t in TOOLS)
(OUT / "index.html").write_text(page(f"Free Technical SEO Checkers - {NAME}",
  "Free tools to check robots.txt, XML sitemaps, redirects, HTTP headers, structured data and hreflang tags.", "/",
  f'<h1>Free technical SEO checkers</h1><p class="lead">Enter a URL, get the result. No signup.</p><ul class="tools">{items}</ul>', script=False))
contact = f'<p>To ask for a quote or report a problem, email <a href="mailto:{CONTACT}">{CONTACT}</a>.</p>' if CONTACT else ""
(OUT / "about.html").write_text(page(f"About {NAME}", f"About {NAME}, a set of free technical SEO checkers.", "/about",
  f'<h1>About {NAME}</h1><p class="lead">Free tools to check the technical SEO of any public website.</p>'
  '<p>Enter a URL and the tool loads it, reads the response and shows what to fix. Pages are fetched live and are not stored.</p>'
  '<p>The checks follow common SEO guidelines, but they are guidance, not a guarantee of rankings.</p>' + contact, script=False))

urls = ["/"] + ["/" + t["slug"] for t in TOOLS] + ["/about"]
(OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  + "".join(f"<url><loc>{SITE}{u}</loc></url>" for u in urls) + "</urlset>")
(OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
for f in ("style.css", "app.js"): shutil.copy(f, OUT / f)
for f in pathlib.Path(".").glob("google*.html"): shutil.copy(f, OUT / f.name)  # Search Console verification file
print("built", len(urls), "pages into dist/")
