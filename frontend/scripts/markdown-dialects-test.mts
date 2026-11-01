// ChatGPT, Gemini and Claude Markdown: math delimiters and citation markers.
import { normalizeModelMarkdown } from '../src/lib/chat/markdownDialects'

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.log('FAIL', name, detail) }
}

const src = [{ url: 'https://a.example' }, { url: 'https://b.example' }]

// ChatGPT math
const block = normalizeModelMarkdown('Energy:\n\\[\n E = mc^2 \n\\]\ndone', src)
check('block math becomes $$', block.includes('$$\nE = mc^2\n$$'), block)
const inline = normalizeModelMarkdown('So \\(x^2\\) grows.', src)
check('inline math becomes $', inline === 'So $x^2$ grows.', inline)
const cur = normalizeModelMarkdown('It costs $5 and \\(a+b\\).', src)
check('dollar prices untouched', cur.startsWith('It costs $5 and $a+b$'), cur)

// ChatGPT citations
check('numbered token maps to [n]', normalizeModelMarkdown('Fact【2†L10-L14】.', src) === 'Fact[2].')
check('numbered token without source is dropped', normalizeModelMarkdown('Fact【9†x】.', []) === 'Fact.')
check('turn token is dropped', normalizeModelMarkdown('Fact【turn0search0】.', src) === 'Fact.')
check('contentReference is dropped', normalizeModelMarkdown('Fact:contentReference[oaicite:0]{index=0}.', src) === 'Fact.')

// Gemini citations
check('cite list becomes links', normalizeModelMarkdown('Claim [cite: 1, 2].', src) === 'Claim [1][2].')
check('cite_start/end removed', normalizeModelMarkdown('[cite_start]Claim[cite_end]', src) === 'Claim')

// Claude citations
check('cite wrapper keeps text', normalizeModelMarkdown('<cite index="1-2">Claim text</cite> more', src) === 'Claim text more')

// Code is untouched
const code = 'Use `\\[x\\]` like this:\n```latex\n\\[ y \\]【1†x】\n```\n'
check('code is not changed', normalizeModelMarkdown(code, src) === code)

// Plain Markdown passes through
const plain = '# Title\n\n- a\n- b $x$'
check('plain markdown unchanged', normalizeModelMarkdown(plain, src) === plain)

console.log(`markdown-dialects-test: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
