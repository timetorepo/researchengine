// Turns the Markdown dialects of ChatGPT, Gemini and Claude into the forms the
// chat already renders: $…$ / $$…$$ math and [n] source markers.
//
//   ChatGPT  \[ … \] and \( … \) math; 【3†source】, 【turn0search0】 and
//            :contentReference[oaicite:0]{index=0} citation tokens
//   Gemini   [cite: 1, 2] markers; [cite_start] and [cite_end] around spans
//   Claude   <cite index="1-2,3">…</cite> wrappers around cited text
//
// Code (fenced or inline) is never changed.

const CODE_SPAN = /(```[\s\S]*?```|`[^`\n]*`)/

function convert(text: string, sources?: { url?: string }[]): string {
  let out = text

  // Math: block first, then inline.
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_w, inner: string) => `\n$$\n${inner.trim()}\n$$\n`)
  out = out.replace(/\\\(([^\n]*?)\\\)/g, (_w, inner: string) => `$${inner.trim()}$`)

  // ChatGPT citation tokens. A numbered token maps onto the source list when there is one.
  const sourceNo = (n: number) => (sources && sources[n - 1]?.url ? `[${n}]` : '')
  out = out.replace(/【(\d{1,3})†[^】]*】/g, (_w, n: string) => sourceNo(Number(n)))
  out = out.replace(/【[^】]*】/g, '')
  out = out.replace(/:contentReference\[oaicite:\d+\]\{index=\d+\}/g, '')

  // Gemini citation markers: [cite: 1, 2] → [1][2]
  out = out.replace(/\[cite:\s*([\d,\s]+)\]/g, (_w, list: string) =>
    list.split(',').map((x) => x.trim()).filter(Boolean).map((x) => sourceNo(Number(x))).join(''))
  out = out.replace(/\[cite_(start|end)\]/g, '')

  // Claude citation wrappers keep their text.
  out = out.replace(/<\/?cite(?:\s[^>]*)?>/g, '')

  return out
}

/** Normalise a model's Markdown. `sources` decides which numbered citations become links. */
export function normalizeModelMarkdown(text: string, sources?: { url?: string }[]): string {
  if (!/\\[\[(]|【|:contentReference|\[cite|<\/?cite/.test(text)) return text
  return text.split(CODE_SPAN).map((part, i) => (i % 2 === 1 ? part : convert(part, sources))).join('')
}
