"""Builds the site into dist/.  Usage: python3 build.py https://YOUR-PROJECT.pages.dev"""
import sys, shutil, pathlib
SITE = (sys.argv[1] if len(sys.argv) > 1 else "https://productphototools.pages.dev").rstrip("/")
NAME = "Product Photo Tools"
CONTACT = ""   # your email address, shown on the About page. Leave empty to hide.
OUT = pathlib.Path("dist"); shutil.rmtree(OUT, ignore_errors=True); OUT.mkdir()
PRIV = "Your images are processed on your device and are never uploaded."
FMT3 = '<option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option>'

TOOLS = [
 dict(slug="image-converter", tool="convert", short="Image converter", title="Image Converter - PNG to JPG, JPG to WebP and More", h1="Image converter",
  desc="Convert images between JPG, PNG and WebP in your browser. Fast, free and private. Nothing is uploaded.", button="Convert",
  intro="Choose one or more images, pick a format, and download the result.",
  opts=f'<div class="opts"><div><label for="fmt">Convert to</label><select id="fmt">{FMT3}</select></div><div><label for="q">Quality: <span id="qv"></span></label><input id="q" type="range" min="40" max="100" value="90"></div></div>',
  how=["Choose your images.", "Pick the format you want: JPG, PNG or WebP.", "Click Convert, then download each file."],
  good=["Transparent areas become white when you convert to JPG, because JPG has no transparency.", "WebP saving needs Chrome, Edge or Firefox. Safari may not be able to save WebP."],
  faq=[("How do I convert PNG to JPG?", "Choose your PNG, select JPG as the format and click Convert. Transparent areas turn white."),
       ("Is my image uploaded?", "No. The conversion happens in your browser, so the picture never leaves your device.")]),
 dict(slug="image-compressor", tool="compress", short="Image compressor", title="Compress Image to a Smaller Size - JPG and WebP", h1="Image compressor",
  desc="Make image files smaller, or compress an image to a target size such as 100 KB. Free, private, in your browser.", button="Compress",
  intro="Choose images and make them smaller. You can also ask for a target size in KB.",
  opts='<div class="opts"><div><label for="fmt">Save as</label><select id="fmt"><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></div><div><label for="q">Quality: <span id="qv"></span></label><input id="q" type="range" min="20" max="95" value="75"></div><div><label for="target">Target size in KB (optional)</label><input id="target" type="number" min="5" placeholder="for example 100"></div></div>',
  how=["Choose your images.", "Pick a quality, or type a target size in KB.", "Click Compress and download the smaller files."],
  good=["With a target size, the tool lowers quality and, if needed, the picture size until it fits.", "Very small targets can make a picture look blurry. Check the result before you use it."],
  faq=[("How do I compress an image to 100 KB?", "Type 100 in the target size box and click Compress. The tool finds the best quality that fits."),
       ("Does compression lose quality?", "Yes, a little. Lower quality means a smaller file, so choose the balance that looks fine to you.")]),
 dict(slug="image-resizer", tool="resize", short="Image resizer", title="Resize Image to Exact Pixels - Free Online Tool", h1="Image resizer",
  desc="Resize images to an exact width and height in pixels, or keep the proportions. Free and private.", button="Resize",
  intro="Choose images and enter a width, a height, or both.",
  opts='<div class="opts"><div><label for="w">Width (pixels)</label><input id="w" type="number" min="1" placeholder="for example 1200"></div><div><label for="h">Height (pixels)</label><input id="h" type="number" min="1" placeholder="leave empty to keep proportions"></div></div><p><label><input id="keep" type="checkbox" checked> Keep proportions when both are filled in</label></p>',
  how=["Choose your images.", "Enter a width, a height, or both.", "Click Resize and download the files."],
  good=["Enlarging a small picture makes it blurry. Resizing down gives the best quality.", "The file type stays the same: JPG stays JPG, PNG stays PNG."],
  faq=[("How do I resize an image to 1000x1000?", "Enter 1000 for the width and 1000 for the height, untick Keep proportions, and click Resize. The picture will be stretched if it is not square."),
       ("Will resizing change my original file?", "No. You download a new copy and your original stays as it is.")]),
 dict(slug="white-background-maker", tool="whitebg", short="White background maker", title="Make Product Photo Background White - Free Online Tool", h1="White background maker for product photos",
  desc="Turn a plain background white, or transparent, and center your product on a square canvas such as 2000x2000. Private and free.", button="Make white background",
  intro="Choose product photos taken on a plain background. The tool makes the background pure white and centers the product.",
  opts='<div class="opts"><div><label for="size">Canvas size</label><select id="size"><option value="2000">2000 x 2000 (Amazon style)</option><option value="2048">2048 x 2048 (Shopify style)</option><option value="1600">1600 x 1600 (eBay style)</option><option value="1000">1000 x 1000</option></select></div><div><label for="fill">Product fills: <span id="fillv"></span>%</label><input id="fill" type="range" min="60" max="98" value="85"></div><div><label for="tol">Background sensitivity: <span id="tolv"></span></label><input id="tol" type="range" min="10" max="90" value="40"></div></div><p><label><input id="clear" type="checkbox"> Make the background transparent instead of white (PNG)</label></p>',
  how=["Choose your product photos, ideally on a plain or light background.", "Pick a canvas size. Raise the sensitivity if background is left, lower it if the product is being cut.", "Click the button, check the result, and download it."],
  good=["It works best on plain backgrounds. Busy backgrounds are not removed.", "A white product on a white background cannot be separated. Use a darker backdrop when you take the photo.", "Marketplace rules change, so check your marketplace's current image rules before you upload."],
  faq=[("How do I make a product photo background white?", "Photograph the product on a plain background, upload it here, and the tool turns that background pure white and centers the product."),
       ("Does it remove complicated backgrounds?", "No. This version removes plain, even backgrounds. Photos with patterns, people or busy scenes need a different tool.")]),
]
nav = "".join(f'<a href="/{t["slug"]}">{t["short"]}</a>' for t in TOOLS)

def page(title, desc, path, body, script=True):
    js = '<script src="/lib.js" defer></script><script src="/app.js" defer></script>' if script else ""
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}"><link rel="canonical" href="{SITE}{path}">
<link rel="stylesheet" href="/style.css"></head><body>
<header><a class="brand" href="/">{NAME}</a><nav>{nav}</nav></header>
<main>{body}</main>
<footer>{NAME}: free image tools. {PRIV} <a href="/about">About</a></footer>
{js}</body></html>'''

lst = lambda a: "<ul>" + "".join(f"<li>{x}</li>" for x in a) + "</ul>"
for t in TOOLS:
    body = f'''<h1>{t["h1"]}</h1><p class="lead">{t["intro"]}</p>
<form id="f" class="stack" data-tool="{t["tool"]}"><label for="files">Choose images</label><input id="files" type="file" accept="image/*" multiple>{t["opts"]}<button>{t["button"]}</button></form>
<div id="out" aria-live="polite"></div>
<section><h2>How it works</h2><ol>{"".join(f"<li>{x}</li>" for x in t["how"])}</ol><h2>Good to know</h2>{lst(t["good"])}</section>
<section><h2>Common questions</h2>{"".join(f"<h3>{q}</h3><p>{a}</p>" for q, a in t["faq"])}</section>'''
    (OUT / f'{t["slug"]}.html').write_text(page(t["title"], t["desc"], "/" + t["slug"], body))
items = "".join(f'<li><a href="/{t["slug"]}">{t["h1"]}</a><br>{t["desc"]}</li>' for t in TOOLS)
(OUT / "index.html").write_text(page(f"Free Image Converter, Compressor, Resizer and White Background Maker - {NAME}",
  "Free tools to convert, compress and resize images and to put product photos on a white background. Private: nothing is uploaded.", "/",
  f'<h1>Free image tools for product photos</h1><p class="lead">Convert, compress, resize and clean up images. {PRIV}</p><ul class="tools">{items}</ul>', script=False))
contact = f'<p>To report a problem, email <a href="mailto:{CONTACT}">{CONTACT}</a>.</p>' if CONTACT else ""
(OUT / "about.html").write_text(page(f"About {NAME}", f"About {NAME}.", "/about",
  f'<h1>About {NAME}</h1><p class="lead">Simple, free image tools that run in your browser.</p><p>{PRIV} The tools work on your computer or phone, so there is no waiting for an upload and no account to create.</p>'
  '<p>The white background tool removes plain, even backgrounds. It is not an AI cutout tool, so busy backgrounds need other software.</p>' + contact, script=False))
urls = ["/"] + ["/" + t["slug"] for t in TOOLS] + ["/about"]
(OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(f"<url><loc>{SITE}{u}</loc></url>" for u in urls) + "</urlset>")
(OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
for f in ("style.css", "app.js", "lib.js"): shutil.copy(f, OUT / f)
for f in pathlib.Path(".").glob("google*.html"): shutil.copy(f, OUT / f.name)
print("built", len(urls), "pages into dist/")
