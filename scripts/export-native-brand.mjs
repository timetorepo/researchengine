// Developer-only SVG rasterisation. Install tools/design dependencies first.
// Run from repository root with an optional BROWSER_EXECUTABLE.
import { chromium } from '../tools/design/node_modules/playwright-core/index.mjs'
import { writeFile,readFile } from 'node:fs/promises'
const browser = await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || undefined,headless:true,chromiumSandbox:true});const page=await browser.newPage();await page.goto('about:blank');
for(const [src,dst,w,h] of [['design/native-studio/assets/app-icon.svg','desktop/icon-source.png',1024,1024],['desktop/installer/sidebar.svg','.cache/sidebar.png',164,314],['desktop/installer/header.svg','.cache/header.png',150,57]]){
 const svg=await readFile(src,'utf8');const data=await page.evaluate(async({svg,w,h})=>{const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(svg);await image.decode();const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(image,0,0,w,h);return c.toDataURL().split(',')[1]},{svg,w,h});await writeFile(dst,Buffer.from(data,'base64'));
}await browser.close();
