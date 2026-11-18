// Structural checks only. A pass is not an NSIS build or native installation test.
import assert from 'node:assert/strict'
import { readFileSync as read, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const file = p => read(resolve(root, p))
const config = JSON.parse(file('desktop/src-tauri/tauri.conf.json'))
const nsis = config.bundle.windows.nsis
for (const key of ['headerImage','sidebarImage','installerIcon','uninstallerIcon','installerHooks']) {
 assert.ok(existsSync(resolve(root, 'desktop/src-tauri', nsis[key])), `NSIS ${key} file exists`)
}
for (const [name,w,h] of [['header',150,57],['sidebar',164,314]]) {
 const b = file(`desktop/installer/${name}.bmp`)
 assert.equal(b.toString('ascii',0,2),'BM'); assert.equal(b.readInt32LE(18),w); assert.equal(b.readInt32LE(22),h); assert.equal(b.readUInt16LE(28),24)
}
for (const name of readdirSync(resolve(root,'desktop/src-tauri/icons')).filter(n => n.endsWith('.png'))) {
 const b=file(`desktop/src-tauri/icons/${name}`); assert.equal(b[25],6,`${name}: truecolour with alpha`)
}
const ico=file('desktop/src-tauri/icons/icon.ico');assert.equal(ico.readUInt16LE(2),1);assert.ok(ico.readUInt16LE(4)>=6,'Multi-size Windows icon')
const brand=file('frontend/src/lib/brand.ts').toString();const path=brand.match(/RE_SYMBOL_PATH = '([^']+)'/)[1]
assert.ok(file('frontend/public/icon.svg').toString().includes(`d="${path}"`),'Public favicon and React mark agree')
const hooks=file('desktop/installer/branding.nsh').toString()
assert.ok(hooks.includes('MUI_WELCOMEPAGE_TEXT'));assert.ok(hooks.includes('MUI_FINISHPAGE_TEXT'));assert.ok(hooks.includes('MUI_FINISHPAGE_RUN_NOTCHECKED'))
assert.ok(!/^\s*(Exec|ExecWait|Delete|RMDir|WriteRegStr|inetc::)/mi.test(hooks),'Presentation hooks do not mutate data or execute downloads')
assert.equal(nsis.installMode,'currentUser');assert.equal(config.bundle.windows.webviewInstallMode.type,'downloadBootstrapper')
console.log('PASS: shared logo geometry, referenced NSIS assets, 24-bit bitmap dimensions, RGBA icon variants, multi-size ICO, opt-in launch, unchanged per-user/WebView2 mode; native compilation/install not exercised')
