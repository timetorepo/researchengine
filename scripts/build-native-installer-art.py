# Developer-only source generator. Requires fontTools and brotli.
# Produces original outlined artwork; installer builds use the committed BMPs.
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
import re
root=Path(__file__).resolve().parents[1]
import os
os.chdir(root)
out=root/'desktop/installer'
mark=re.search(r' d="([^"]+)"',Path('design/native-studio/assets/symbol.svg').read_text()).group(1)
f=TTFont('design/native-studio/fonts/AlloVariable.woff2');f=instantiateVariableFont(f,{'wght':500,'opsz':14,'ROND':40});gs=f.getGlyphSet();cm=f.getBestCmap()
def text(t,x,y,size,color):
 paths=[];pos=0
 for ch in t:
  name=cm[ord(ch)];pen=SVGPathPen(gs);gs[name].draw(pen);paths.append(f'<path transform="translate({pos} 0)" d="{pen.getCommands()}"/>');pos+=gs[name].width
 return f'<g fill="{color}" transform="translate({x} {y}) scale({size/f["head"].unitsPerEm} {-size/f["head"].unitsPerEm})">'+''.join(paths)+'</g>'
body=f'''<defs><linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#24335A"/><stop offset="1" stop-color="#14151B"/></linearGradient></defs><rect width="164" height="314" fill="url(#light)"/><rect x="16" y="24" width="64" height="64" rx="14" fill="#365BFF"/><path transform="translate(28 35) scale(.23)" fill="#F3F2EF" d="{mark}"/>'''
body+=text('ResearchEngine',16,121,18,'#F3F2EF')+text('Your research.',16,150,12,'#D0D3DD')+text('Your workspace.',16,167,12,'#D0D3DD')+text('Your own machine.',16,184,12,'#D0D3DD')
body+='<path d="M16 255H148" stroke="#444B60"/>'+text('Native Studio',16,278,10,'#A9B4D3')+text('Windows desktop edition',16,294,9,'#A9B4D3')
(out/'sidebar.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 164 314">{body}</svg>')
body=f'<rect width="150" height="57" fill="#FFFFFF"/><g transform="translate(112 9) scale(.20)"><path fill="#2545FF" d="{mark}"/></g>'
(out/'header.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 57">{body}</svg>')
