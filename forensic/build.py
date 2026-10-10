"""Builds the site into dist/.  Usage: python3 build.py https://YOUR-PROJECT.pages.dev"""
import sys, shutil, pathlib
SITE = (sys.argv[1] if len(sys.argv) > 1 else "https://mediaprovenance.pages.dev").rstrip("/")
NAME = "Media Provenance Inspector"
CONTACT = ""   # your email address, shown on the methodology page for error reports. Leave empty to hide.
OUT = pathlib.Path("dist"); shutil.rmtree(OUT, ignore_errors=True); OUT.mkdir()

TOOLS = [
 dict(slug="media-provenance-inspector", short="Media inspector", title="Image and Video Metadata and AI Provenance Inspector - Free Online Tool", h1="Media provenance inspector",
  desc="Read the hash, metadata, Content Credentials and AI tool signatures stored inside an image or video. The file never leaves your device.",
  intro="Choose an image, video or MP3 file. It is analysed in your browser and is never uploaded.", form="file",
  checks=["A SHA-256 hash, to record exactly which file you analysed.", "Camera, software, date and GPS fields (EXIF).", "Editing history and declared source type (XMP).",
          "Content Credentials (C2PA): whether they exist and what they state.", "Generation parameters that some AI image tools write into PNG files, such as Stable Diffusion and ComfyUI.",
          "Names of AI and editing tools found inside the file.", "Creation and modification dates stored in MP4 and MOV videos.", "ID3 tags in MP3 audio, such as encoder, dates and comments."],
  cannot=["Whether a file with no AI indicators is genuine. Social platforms and messaging apps remove most metadata, and metadata can be edited or forged.",
          "AI-made files whose metadata was lost, for example after converting PNG to WebP, exporting or re-encoding a video, taking a screenshot, or uploading to a platform.", "Which AI tool made a file that carries no provenance data.", "When a file was created, unless a date is stored in it. Stored dates can be changed.",
          "Whether pixels or frames were altered. This version does not analyse image or video content.", "Anything about the sound or pictures themselves, such as cloned voices or synthetic video, and invisible watermarks such as Google SynthID. WebM, MKV, AVI, WAV and other formats get only a file hash."],
  faq=[("Is my file uploaded?", "No. The analysis runs in your browser. You can check this by going offline after the page loads and running it again."),
       ("Can I use the result as evidence?", "Treat it as a lead. For formal or court use, keep the original file unchanged, record its hash, and ask an accredited forensic examiner."),
       ("Why is there no AI percentage score?", "Scores from detectors can be wrong in both directions. This tool reports only what can be read from the file itself.")]),
 dict(slug="text-artifact-scanner", short="Text scanner", title="Text Artifact Scanner - Hidden Characters and Chatbot Markers", h1="Text artifact scanner",
  desc="Find hidden characters, chatbot tracking tags, citation markers and stock phrases in pasted text. It does not guess whether AI wrote it.",
  intro="Paste text. It is analysed in your browser and is never uploaded.", form="text",
  checks=["Zero-width and other invisible characters.", "Unusual spaces such as no-break and narrow spaces.", "Chatbot artifacts: tracking tags, citation markers and stock phrases.",
          "Leftover Markdown formatting.", "Descriptive statistics such as sentence length and vocabulary variety."],
  cannot=["Whether the text was written by AI. No marker proves it, and a clean result proves nothing.", "Who wrote the text, or which tool produced it.",
          "Text that was retyped or edited after being copied from a chatbot."],
  faq=[("Why is there no AI detection score?", "AI text detectors make errors in both directions. Published research has found that they flag writing by non-native English speakers as AI-written far more often. A wrong accusation can do real harm, so this tool shows only observable markers."),
       ("Is my text uploaded?", "No. The analysis runs in your browser.")]),
]
nav = "".join(f'<a href="/{t["slug"]}">{t["short"]}</a>' for t in TOOLS) + '<a href="/methodology-and-limits">Methodology and limits</a>'

def page(title, desc, path, body, scripts=True):
    js = '<script src="/lib.js" defer></script><script src="/app.js" defer></script>' if scripts else ""
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}"><link rel="canonical" href="{SITE}{path}">
<link rel="stylesheet" href="/style.css"></head><body>
<header><a class="brand" href="/">{NAME}</a><nav>{nav}</nav></header>
<main>{body}</main>
<footer>{NAME} is an independent tool. It is not affiliated with or endorsed by any government or law-enforcement body. Results are indicators, not proof. Files and text are analysed in your browser and are not uploaded.</footer>
{js}</body></html>'''

def lst(a): return "<ul>" + "".join(f"<li>{x}</li>" for x in a) + "</ul>"
for t in TOOLS:
    form = ('<form id="ff" class="stack"><label for="file">Image, video or audio file</label><input id="file" type="file" accept="image/*,video/*,audio/*,.mp4,.mov,.m4v,.mp3"><button>Analyse file</button></form>'
            if t["form"] == "file" else
            '<form id="tf" class="stack"><label for="t">Text to scan</label><textarea id="t" placeholder="Paste text here"></textarea><button>Scan text</button></form>')
    body = f'''<h1>{t["h1"]}</h1><p class="lead">{t["intro"]}</p>
<p class="notice noprint">Indicators, not verdicts. Read the <a href="/methodology-and-limits">methodology and limits</a> before relying on a result.</p>
{form}<div id="out" aria-live="polite"></div>
<section><h2>What this checks</h2>{lst(t["checks"])}<h2>What it cannot tell you</h2>{lst(t["cannot"])}</section>
<section><h2>Common questions</h2>{"".join(f"<h3>{q}</h3><p>{a}</p>" for q, a in t["faq"])}</section>'''
    (OUT / f'{t["slug"]}.html').write_text(page(t["title"], t["desc"], "/" + t["slug"], body))

contact = f'<p>To report an error or a false result, email <a href="mailto:{CONTACT}">{CONTACT}</a>. Please include the report file, not the original evidence.</p>' if CONTACT else ""
meth = f'''<h1>Methodology and limits</h1><p class="lead">What each check does, how strong the evidence is, and where it fails. Version 0.1.</p>
<h2>Principles</h2>{lst(["Report only what can be read from the file or text itself.", "Show indicators, never a verdict or a probability of AI involvement.",
 "Say clearly when a check found nothing, and what that does not prove.", "Analyse everything in the browser, so evidence is not sent to a server."])}
<h2>How strong is each check?</h2>
<h2>Why \"no indicators\" is inconclusive</h2><p>Most AI-made images and videos reach an investigator with no provenance data left. Converting an image to another format, exporting or re-encoding a video, taking a screenshot, or uploading to a platform all remove it. For this reason the tool reports \"inconclusive\" when nothing is found, and never \"clean\" or \"authentic\". Detecting AI content from the pixels or frames themselves is a different, error-prone problem that this version does not attempt.</p><h3>SHA-256 hash</h3><p>Strong for one purpose: showing that two copies of a file are identical. It says nothing about whether the content is real.</p>
<h3>Content Credentials (C2PA)</h3><p>Strong when the signature is valid, because the manifest is cryptographically signed by the tool or device that made it. This version only detects and reads the manifest. It does not validate the signature, so validate it with an official verifier before relying on it. A missing manifest means very little, because most files have none and many platforms strip them.</p>
<h3>XMP and IPTC digital source type</h3><p>Useful when it states that content is AI-generated or AI-composited. These fields are plain text inside the file and can be edited or removed by anyone.</p>
<h3>PNG generation parameters</h3><p>Some AI image tools write their prompt and settings into PNG files. When present they are a strong sign of how the image was made. They are removed when the image is re-saved, converted, or shared through most platforms.</p>
<h3>EXIF and video container fields</h3><p>Camera, software and date fields help build a timeline, but every one of them can be edited. A date inside a file is a claim, not a fact.</p>
<h3>Tool names found inside the file</h3><p>A weak indicator. A name can appear by accident, can be added on purpose, and shows that software touched the file, not what it changed.</p>
<h3>Text markers</h3><p>Hidden characters and chatbot artifacts are observable, but they can come from many sources and are easy to remove. They cannot establish who or what wrote a text.</p>
<h2>What this site does not do</h2>{lst(["It does not analyse pixels, frames, audio or writing style to guess whether content is synthetic.",
 "It does not identify which AI model or tool produced a file unless the file says so.", "It does not provide legal, forensic or expert opinion.",
 "It has not been validated against a benchmark dataset, and no accuracy figures are claimed."])}
<h2>Handling evidence</h2>{lst(["Keep the original file unchanged and work on a copy.", "Record the SHA-256 hash of the original and of every copy.",
 "Save the JSON report next to the file, and note the tool version and date.", "Do not rely on this site alone for court or formal proceedings. Use an accredited forensic examiner."])}
<h2>Privacy</h2><p>Files and text are processed in your browser and are not uploaded or stored by this site. The site is static, so there is no server-side analysis.</p>{contact}'''
(OUT / "methodology-and-limits.html").write_text(page(f"Methodology and Limits - {NAME}", "How the checks work, how strong each one is, and what this site cannot tell you.", "/methodology-and-limits", meth, scripts=False))
items = "".join(f'<li><a href="/{t["slug"]}">{t["h1"]}</a><br>{t["desc"]}</li>' for t in TOOLS)
(OUT / "index.html").write_text(page(f"Media Provenance Inspector - Free Image, Video and Text Checks",
  "Free browser-based tools that read what an image, video or text says about its own origin: hashes, metadata, Content Credentials and tool signatures.", "/",
  f'<h1>Check what a file says about its origin</h1><p class="lead">Free tools that read the hash, metadata, Content Credentials and tool signatures stored inside images, videos and text. Everything runs in your browser.</p>'
  f'<p class="notice">These tools report indicators, not verdicts. They cannot prove that content is real or fake. Read the <a href="/methodology-and-limits">methodology and limits</a> first.</p><ul class="tools">{items}</ul>', scripts=False))
urls = ["/"] + ["/" + t["slug"] for t in TOOLS] + ["/methodology-and-limits"]
(OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(f"<url><loc>{SITE}{u}</loc></url>" for u in urls) + "</urlset>")
(OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
for f in ("style.css", "app.js", "lib.js"): shutil.copy(f, OUT / f)
for f in pathlib.Path(".").glob("google*.html"): shutil.copy(f, OUT / f.name)
print("built", len(urls), "pages into dist/")