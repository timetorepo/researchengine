import type { ThemeId } from '@/types'

/**
 * The welcome shown on the home screen when an AI-product theme is active.
 * Each one speaks in that product's own register, so switching to it feels like
 * arriving somewhere, not just changing a colour. Only themes listed here get a
 * welcome; every other theme shows the plain home screen.
 */
export interface AIWelcome { headline: string; body: string; cta: string }

export const AI_WELCOMES: Partial<Record<ThemeId, AIWelcome>> = {
  claude: {
    headline: 'Good to see you. What are we thinking through?',
    body: 'Bring a draft, a paper or a half-formed question. Claude’s style here is slow, careful and willing to say “I’m not sure”.',
    cta: 'Start a conversation',
  },
  chatgpt: {
    headline: 'What can I help you research today?',
    body: 'Ask anything, attach a file, or pick a work mode. Answers come with sources you can open and check.',
    cta: 'Ask a question',
  },
  gemini: {
    headline: 'Hi there. Where should we start?',
    body: 'Search the web, read your documents or build something. Gemini-style answers keep the steps visible as they happen.',
    cta: 'Start exploring',
  },
  perplexity: {
    headline: 'Ask anything. Get sourced answers.',
    body: 'Every answer shows where it came from, with numbered citations you can follow. Search is one toggle away.',
    cta: 'Search with sources',
  },
}
