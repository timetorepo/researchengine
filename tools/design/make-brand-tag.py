"""Original ResearchEngine marketing signature. Requires development-only fonttools + brotli.
Run from repository root: PYTHONPATH=.cache/font-build/python python3 tools/design/make-brand-tag.py
No external font fetches and no runtime dependencies are added to the app.
"""
from pathlib import Path
import re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = Path('design/marketing/tag')
OUT.mkdir(parents=True, exist_ok=True)
FONT = TTFont('node_modules/@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2')
GLYPHS = FONT.getGlyphSet()
CMAP = FONT.getBestCmap()
UPM = FONT['head'].unitsPerEm
SYMBOL = re.search(r"RE_SYMBOL_PATH = '([^']+)'", Path('frontend/src/lib/brand.ts').read_text()).group(1)

def text_paths(text, x, y, size, spacing=0):
    paths = []
    scale = size / UPM
    for character in text:
        glyph_name = CMAP[ord(character)]
        pen = SVGPathPen(GLYPHS)
        GLYPHS[glyph_name].draw(pen)
        paths.append(f'<path transform="translate({x:.4f} {y}) scale({scale:.6f} {-scale:.6f})" d="{pen.getCommands()}"/>')
        x += GLYPHS[glyph_name].width * scale + spacing
    return ''.join(paths)

for name, paper, ink in [('graphite', '#151515', '#efeeea'), ('paper', '#f1eee7', '#242321')]:
    content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200" role="img" aria-labelledby="title desc">
<title id="title">ResearchEngine — production signature, {name}</title>
<desc id="desc">The original ResearchEngine symbol beside monospaced text: ResearchEngine. Research, build, create. Open-source workspace. Rectangular RE 01 edition stamp. No registered-trademark claim.</desc>
<metadata>Original ResearchEngine composition. Outlined Geist Mono lettering; font copyright 2024 The Geist Project Authors, SIL OFL 1.1. See accompanying licence. Not an imitation of the reference logo.</metadata>
<rect width="1600" height="1200" fill="{paper}"/>
<g fill="{ink}">
<path transform="translate(172 595) scale(.92)" d="{SYMBOL}"/>
{text_paths('RESEARCHENGINE', 410, 634, 34, 1.3)}
{text_paths('RESEARCH · BUILD · CREATE', 410, 680, 23, .5)}
{text_paths('OPEN-SOURCE WORKSPACE', 410, 720, 23, .5)}
<path d="M1252 601h136v136h-136z M1254 603v132h132V603z" fill-rule="evenodd"/>
{text_paths('RE', 1283, 658, 34, 4)}
{text_paths('01', 1294, 707, 23, 4)}
</g>
</svg>'''
    (OUT / f'researchengine-tag-{name}.svg').write_text(content)
print('Created two standalone outlined SVG exports in', OUT)
