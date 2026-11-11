# Research Engine 0.43.0-beta.1

The Perplexity round. We researched what Perplexity does well and what
it gets wrong, then built the good parts ourselves and fixed the rest.
Answers in Search and Quality mode now ride a real retrieval-augmented
pipeline: multi-step deep research, a capped and numbered context
block, and a citation audit that strips any invented markers before
they reach you. The model picker grows two ranking boards, and the home
screen stops dropping frames.

Every item here is backed by a check in the new r30-test suite
(61 assertions), so none of it can quietly regress.

## A real RAG pipeline with deep research

- Quality mode now runs deep multi-step research: the query is parsed
  into an intent, split into up to three subqueries, searched in
  parallel, and fused into one numbered context block before the model
  writes a single word.
- The fused context is capped at 3200 characters (about 800 tokens),
  every source is numbered and labelled with its trust tier, and page
  bodies are raced against a read deadline so the answer never waits on
  a slow fetch.
- One source per host: dedupe keeps the best-scoring hit per domain,
  so ten mirrors of one blog cannot drown out ten different sources.
- A dead search ladder returns an honest failure. Demo placeholders can
  never ground an answer.

## What Perplexity gets wrong, fixed

- Citation audit: after the answer is written, every [n] marker outside
  the retrieved source set is stripped, and you are told when markers
  were removed. Independent studies found up to 13.3% of deep-research
  citations in other products fully hallucinated; here they do not
  survive.
- Trust tiers: primary sources (Wikipedia, .gov, official docs hosts)
  outrank trusted docs, which outrank the open web. A LinkedIn spam
  post can no longer rank like Nature.
- Conflicting sources must be surfaced, not blended: the grounding
  rules tell the model to say so when sources disagree.
- Weak grounding is disclosed. If retrieval came back thin, the answer
  says so instead of bluffing.

## Rankings: the world and yours

- World board: live from the OpenRouter models API, free models first,
  then context per blended dollar, and every row explains its rank.
- Yours board: your own connection log, ranked by calls, success rate,
  and recency, grouped per provider and model.
- Both boards say plainly that they are value rankings, not arena
  scores. The trophy toggle lives in the model picker.

## Faster, on fewer tokens

- Subquery planning is deterministic, so deep research adds zero extra
  LLM calls. Retrieval runs in parallel, and the whole pipeline reports
  its own stats: passes, hits, pages read, fused characters, estimated
  tokens.
- The classic snippet grounding path stays as the fallback whenever the
  pipeline is offline, and it follows the same cite-only-what-you-read
  rules.

## Home screen frame rate

- The spotlight cards no longer re-render React on every mousemove;
  they write two CSS variables instead.
- The aurora background and the revolving text now pause when the tab
  is hidden or reduced motion is preferred, and resume on their own.
