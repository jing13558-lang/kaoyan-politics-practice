"""Build a self-contained HTML file that can be opened directly from disk."""

import json
from pathlib import Path


SITE = Path(__file__).resolve().parent
DIST = SITE / "dist"
OUTPUT = SITE.parent / "考研政治真题练习（离线版）.html"


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError(f"Expected exactly one occurrence of {old[:50]!r}")
    return source.replace(old, new, 1)


html = (DIST / "index.html").read_text(encoding="utf-8")
css = (DIST / "styles.css").read_text(encoding="utf-8")
js = (DIST / "app.js").read_text(encoding="utf-8")
papers = json.loads((DIST / "papers.json").read_text(encoding="utf-8"))

# The hosted stylesheet imports Google Fonts. Remove that request for offline use.
css_lines = css.splitlines()
if not css_lines[0].startswith("@import url('https://fonts.googleapis.com/"):
    raise ValueError("Unexpected external stylesheet import")
css = "\n".join(css_lines[1:])

js = replace_once(
    js,
    "fetch('papers.json').then(response=>{if(!response.ok)throw Error('试卷文件加载失败');return response.json()}).then(data=>{",
    "Promise.resolve(JSON.parse(document.getElementById('offline-papers').textContent)).then(data=>{",
)

# Escaping '<' prevents paper text from closing the JSON script element.
paper_json = json.dumps(papers, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
html = replace_once(
    html,
    '<link rel="stylesheet" href="styles.css">',
    f"<style>\n{css}\n</style>",
)
html = replace_once(
    html,
    '<script src="app.js" defer></script>',
    f'<script id="offline-papers" type="application/json">{paper_json}</script>\n  <script>\n{js}\n  </script>',
)
html = replace_once(
    html,
    '<title>考研政治历年真题练习 · 2015—2026</title>',
    '<title>考研政治历年真题练习（离线版） · 2015—2026</title>',
)

OUTPUT.write_text(html, encoding="utf-8")
print(OUTPUT)
