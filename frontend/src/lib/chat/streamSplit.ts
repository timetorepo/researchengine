// Splits a streaming answer into the part that is settled (safe to render as
// Markdown) and the live tail that is still arriving. Settled text only ever
// grows at paragraph breaks, so re-rendering it on every token is never needed.

/** Count fence markers; an odd count means a code block is still open. */
function openFence(text: string): boolean {
  const fences = text.match(/^\s*```/gm)?.length ?? 0
  return fences % 2 === 1
}

export function splitStable(content: string): { stable: string; tail: string } {
  // A code block that is still open cannot be split: keep it whole as Markdown.
  if (openFence(content)) return { stable: content, tail: '' }
  const cut = content.lastIndexOf('\n\n')
  if (cut < 0) return { stable: '', tail: content }
  return { stable: content.slice(0, cut + 2), tail: content.slice(cut + 2) }
}

/**
 * Strip inline Markdown markers from the live tail so the words read the same
 * as they will once the paragraph is rendered. Text is kept; only the markup
 * characters go, so nothing jumps when the paragraph settles.
 */
export function plainifyTail(tail: string): string {
  return tail
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
}

/**
 * Break the live tail into settled chunks of `wordsPerChunk` words plus one
 * live remainder. Settled chunks render plain; only the remainder animates, so
 * the animated DOM stays small however long the answer gets.
 */
export function chunkTail(text: string, wordsPerChunk = 8): { settled: string[]; live: string } {
  const words = text.split(' ')
  const full = Math.floor((words.length - 1) / wordsPerChunk)
  const settled: string[] = []
  for (let i = 0; i < full; i++) settled.push(words.slice(i * wordsPerChunk, (i + 1) * wordsPerChunk).join(' '))
  return { settled, live: words.slice(full * wordsPerChunk).join(' ') }
}
