import type { DifferenceItem } from '@/components/shadcn-space/card/card-21'

/**
 * The comparison the round asked for: "ResearchEngine is free, unlike…".
 *
 * The left column is what a month of subscription research tools looks like,
 * the right column is this app. Every claim on the right is something the app
 * does today — the same claims the README and the onboarding's paid-apps step
 * make, so the site, the app and the repository never disagree.
 */
export const COMPARISON: DifferenceItem[] = [
  { other: '$20 a month, per person, forever', our: 'Free, MIT licensed, no account' },
  { other: 'Your notes and papers sit on their servers', our: 'Your library stays in a folder you own' },
  { other: 'Upload limits and "fair use" ceilings', our: 'No limits. It is your disk' },
  { other: 'Ask the assistant, hope it can reach your files', our: 'Read and quiz the PDF you already have' },
  { other: 'Locked to the one model they picked', our: 'Seventeen providers, or a model on your machine' },
  { other: 'Answer dumped at you, all at once', our: 'Written out as it streams, clause by clause' },
  { other: 'Closed source, their roadmap, their call', our: 'Every line on GitHub. Fork it' },
  { other: 'Search is a feature they upsell', our: 'Search is set up when you install it' },
  { other: 'Wait for them to fix the thing you found', our: 'Update in one click, roll back if it breaks' },
]

/** The seven subscriptions the onboarding screen names, with their entry prices. */
export const PAID_APPS: { name: string; price: string; does: string }[] = [
  { name: 'ChatGPT Plus', price: '$20/mo', does: 'Answers, search, files' },
  { name: 'Claude Pro', price: '$20/mo', does: 'Long documents, writing' },
  { name: 'Perplexity Pro', price: '$20/mo', does: 'Search with citations' },
  { name: 'Google AI Pro', price: '$19.99/mo', does: 'Search, docs, email' },
  { name: 'NotebookLM Plus', price: 'in Google AI Pro', does: 'Read and quiz your sources' },
  { name: 'Notion AI', price: '$10/mo', does: 'Notes with an assistant' },
  { name: 'Elicit', price: '$12/mo', does: 'Literature review' },
]

/** $101.99 — the sum of the paid entry tiers above, excluding the bundled one. */
export const PAID_TOTAL = '$101.99'
