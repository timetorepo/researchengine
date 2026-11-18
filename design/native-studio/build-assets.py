"""Generate editable vector interpretation of the selected concept.
Run with fontTools + brotli available; no traced/generated pixels in SVGs.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'assets'
# Drawn by hand from the selected direction, not an automatic pixel trace.
MARK='M42 8 H120 Q129 8 136 15 L152 31 Q160 39 160 50 V69 Q160 77 153 84 L115 120 H54 L101 75 Q111 65 102 56 L75 29 Q79 42 68 53 L27 94 Q20 102 28 110 L76 158 L58 176 H43 Q8 176 8 141 V48 Q8 38 15 31 L31 15 Q36 8 42 8 Z M59 113 H112 Q121 113 129 121 L160 152 Q158 176 133 176 H122 Q113 176 105 168 Z'
def svg(body, box, title):
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}" role="img"><title>{title}</title>{body}</svg>\n'
for name,color in [('symbol','#2545FF'),('symbol-dark','#171719'),('symbol-light','#F3F2EF')]:
 (OUT/f'{name}.svg').write_text(svg(f'<path fill="{color}" d="{MARK}"/>','0 0 176 184','ResearchEngine symbol'))
f=TTFont(ROOT/'fonts/bricolage-grotesque-latin-standard-normal.woff2')
f=instantiateVariableFont(f,{'wght':600,'wdth':100,'opsz':32})
glyphs=f.getGlyphSet(); cmap=f.getBestCmap(); x=0; paths=[]
for char in 'ResearchEngine':
 name=cmap[ord(char)]; pen=SVGPathPen(glyphs); glyphs[name].draw(pen)
 paths.append(f'<path transform="translate({x} 0)" d="{pen.getCommands()}"/>')
 x+=glyphs[name].width-8
scale=82/f['head'].unitsPerEm
for name,ink,mark in [('lockup','#171719','#2545FF'),('lockup-dark','#F3F2EF','#6A82FF'),('lockup-mono','#171719','#171719')]:
 body=f'<g transform="translate(12 10) scale(.68)" fill="{mark}"><path d="{MARK}"/></g><g fill="{ink}" transform="translate(156 102) scale({scale} {-scale})">'+''.join(paths)+'</g>'
 (OUT/f'{name}.svg').write_text(svg(body,f'0 0 {round(176+x*scale)} 148','ResearchEngine'))
body=f'''<defs><linearGradient id="tile" x2="0.85" y2="1"><stop stop-color="#344FFF"/><stop offset="1" stop-color="#1422A8"/></linearGradient><linearGradient id="rim" x2="0" y2="1"><stop stop-color="white" stop-opacity=".5"/><stop offset="1" stop-color="white" stop-opacity=".04"/></linearGradient></defs><rect x="12" y="12" width="488" height="488" rx="108" fill="url(#tile)"/><rect x="13" y="13" width="486" height="486" rx="107" fill="none" stroke="url(#rim)" stroke-width="2"/><g transform="translate(113 105) scale(1.65)" fill="#F8F8FC"><path d="{MARK}"/></g>'''
(OUT/'app-icon.svg').write_text(svg(body,'0 0 512 512','ResearchEngine app icon concept'))
print('Generated 7 SVG assets; lockup text is outlined, not dependent on an installed font.')
