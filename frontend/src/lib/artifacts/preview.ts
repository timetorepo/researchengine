// Artifacts: turn a code block from a chat into a page that can run on this machine.
//
// Runnable: html / htm / svg (as-is), javascript (with a console), jsx / tsx / react
// (React 18 with Babel, rendering the component the code exports or ends with).
// Anything else is shown as code only.

export type ArtifactLang = string

const RUNNABLE_HTML = new Set(['html', 'htm', 'svg'])
const RUNNABLE_JS = new Set(['js', 'javascript', 'mjs'])
const RUNNABLE_REACT = new Set(['jsx', 'tsx', 'react'])

/** Only the code's own closing tags can end the inline script early. */
function inline(code: string) {
  return code.replace(/<\/script/gi, '<\\/script')
}

export function isRunnable(lang: ArtifactLang) {
  const l = lang.toLowerCase()
  return RUNNABLE_HTML.has(l) || RUNNABLE_JS.has(l) || RUNNABLE_REACT.has(l)
}

/** A short human title for the panel and the chat card. */
export function titleFor(lang: ArtifactLang, code: string) {
  const l = lang.toLowerCase()
  if (l === 'html' || l === 'htm') {
    const m = /<title[^>]*>([^<]{1,80})<\/title>/i.exec(code)
    if (m) return m[1].trim()
    return 'HTML page'
  }
  if (l === 'svg') return 'SVG image'
  if (RUNNABLE_REACT.has(l)) {
    const m = /export\s+default\s+(?:function|class)\s+([A-Z][\w]*)/.exec(code)
      ?? /(?:function|const)\s+([A-Z][\w]*)/.exec(code)
    return m ? `${m[1]} component` : 'React component'
  }
  const name = l ? l.toUpperCase() : 'CODE'
  return `${name} snippet`
}

const SHELL_HEAD = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;min-height:100%}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;background:#fff}</style>`

/** The HTML document shown in the preview, or null when the code cannot run. */
export function previewDocument(lang: ArtifactLang, code: string): string | null {
  const l = lang.toLowerCase()
  if (RUNNABLE_HTML.has(l)) {
    if (l === 'svg') return `${SHELL_HEAD}</head><body style="padding:16px">${inline(code)}</body></html>`
    if (/<html[\s>]/i.test(code) || /<!doctype/i.test(code)) return inline(code)
    return `${SHELL_HEAD}</head><body>${inline(code)}</body></html>`
  }

  if (RUNNABLE_JS.has(l)) {
    return `${SHELL_HEAD}
<style>#__out{font:12px ui-monospace,Menlo,monospace;color:#555;white-space:pre-wrap;padding:8px 16px;border-top:1px solid #eee}</style>
</head><body><div id="__root"></div><pre id="__out"></pre>
<script>
(function(){
  var out=document.getElementById('__out');
  function show(a){return Array.prototype.map.call(a,function(x){return typeof x==='string'?x:JSON.stringify(x)}).join(' ')}
  console.log=function(){out.textContent+=show(arguments)+'\\n'};
  console.error=function(){out.textContent+='Error: '+show(arguments)+'\\n'};
  window.addEventListener('error',function(e){out.textContent+='Error: '+e.message+'\\n'});
  try{
${inline(code)}
  }catch(e){out.textContent+='Error: '+e.message+'\\n'}
})();
</script></body></html>`
  }

  if (RUNNABLE_REACT.has(l)) {
    let body = code
      .replace(/^\s*import\s[^;\n]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, '')
    let app = ''
    if (/export\s+default\s+/.test(body)) {
      body = body.replace(/export\s+default\s+/, 'const __App = ')
      app = '__App'
    } else {
      const names = [...body.matchAll(/(?:function|const|let|class)\s+([A-Z][\w]*)/g)].map((m) => m[1])
      app = names.length ? names[names.length - 1] : ''
    }
    const filename = l === 'tsx' || l === 'react' ? 'artifact.tsx' : 'artifact.jsx'
    const presets = l === 'jsx' ? 'react' : 'react,typescript'
    return `${SHELL_HEAD}
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
</head><body><div id="root"></div>
<script type="text/babel" data-presets="${presets}" data-filename="${filename}">
const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext, Fragment } = React;
${inline(body)}
;(function () {
  var target = document.getElementById('root');
  var App = ${app ? app : 'null'};
  if (!App) { target.textContent = 'Export a default component (or end the code with a named component) to see it here.'; return; }
  try { ReactDOM.createRoot(target).render(React.createElement(App)); }
  catch (e) { target.textContent = 'Error: ' + e.message; }
})();
window.addEventListener('error', function (e) {
  document.getElementById('root').textContent = 'Error: ' + e.message;
});
</script></body></html>`
  }

  return null
}
