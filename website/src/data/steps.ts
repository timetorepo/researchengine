import type { StepItem } from '@/components/smoothui/animated-stepper'

/**
 * How it works, in four steps, in the order a person actually meets them.
 * The stepper is clickable, so this doubles as a tiny tour of the app.
 */
export const STEPS: StepItem[] = [
  {
    label: 'Install it',
    description: 'Windows or Linux, or unzip the portable build. No account, no sign-up, nothing to configure first.',
  },
  {
    label: 'Pick how it thinks',
    description:
      'Add a key for a provider you already use, point it at a model on your own machine, or just try the offline model that ships with it.',
  },
  {
    label: 'Ask, read, quiz, write',
    description:
      'Every answer shows its sources. Save pages into your library, turn a paper into a quiz, keep notes and drafts beside them.',
  },
  {
    label: 'Update with one click',
    description:
      'It checks, verifies the file before unpacking, and rolls back by itself if the new version cannot start. Your library is never touched.',
  },
]
