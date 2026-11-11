// Whisper-light syntax highlighter (keywords / strings / comments / numbers /
// function calls). Runs in a worker-free pass; cheap enough for streaming.

const KEYWORDS = new Set((
  'const let var function return if else for while class import export from default new async await try catch throw ' +
  'type interface extends implements public private static void null undefined true false this typeof instanceof in of ' +
  'def elif lambda pass raise with as yield None True False fn mut pub struct enum impl trait use match loop break continue ' +
  'SELECT FROM WHERE JOIN GROUP BY ORDER INSERT INTO UPDATE DELETE CREATE TABLE PRIMARY KEY NOT NULL AND OR LIMIT'
).split(/\s+/))

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function highlight(code: string): string {
  // token order matters: comments, strings, then words/numbers
  const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index))
    const [full, com, str, num, word] = m
    if (com) out += `<span class="tok-com">${esc(com)}</span>`
    else if (str) out += `<span class="tok-str">${esc(str)}</span>`
    else if (num) out += `<span class="tok-num">${esc(num)}</span>`
    else if (word) {
      if (KEYWORDS.has(word)) out += `<span class="tok-kw">${esc(word)}</span>`
      else if (code[m.index + word.length] === '(') out += `<span class="tok-fn">${esc(word)}</span>`
      else out += esc(word)
    }
    last = m.index + full.length
  }
  out += esc(code.slice(last))
  return out
}
