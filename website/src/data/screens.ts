/**
 * The four screenshots of the shipped app.
 *
 * They are this repository's own pictures, optimised by the site-assets
 * workflow, and they are the only pictures used to show the product anywhere on
 * this page: no mockups, no stock photography, no renders. The gallery opens on
 * whichever one was clicked.
 */
export interface Screen {
  id: string
  src: string
  /** What the picture is of, for a screen reader and for the caption. */
  alt: string
  caption: string
}

export const SCREENS: Screen[] = [
  {
    id: 'screen-1',
    src: '/shots/shot-1.webp',
    alt: 'Research Engine open on the chats screen, with coding and research conversations listed and the sidebar beside them',
    caption: 'Chats: research and coding kept apart, on this device',
  },
  {
    id: 'screen-2',
    src: '/shots/shot-2.webp',
    alt: 'Research Engine reading a document, with the study tools open next to the text',
    caption: 'Reading and study: a document, a summary and a quiz from the same text',
  },
  {
    id: 'screen-3',
    src: '/shots/shot-3.webp',
    alt: 'Research Engine writing, with a long-form article open in the editor',
    caption: 'Writing: a long-form editor with the sources still beside it',
  },
  {
    id: 'screen-4',
    src: '/shots/shot-4.webp',
    alt: 'Research Engine building, with a coding workspace and the agent working in it',
    caption: 'Building: the coding desk, with an agent in the same window',
  },
]

/**
 * What each screen shows, in three short points. Every point is a feature the
 * app ships in this release; none is a roadmap item.
 */
export const TOUR_POINTS: Record<string, { title: string; points: string[] }> = {
  'screen-1': {
    title: 'Chats',
    points: [
      'Research and coding conversations are kept apart, each with its own system prompt.',
      'Work modes (Research, Coding, Design, Math) change how the model answers, not just what it sees.',
      'Every chat is stored on this device in a folder you can copy or delete.',
    ],
  },
  'screen-2': {
    title: 'Reading and study',
    points: [
      'Drop a PDF, DOCX, TXT or Markdown file. Extraction happens on your machine.',
      'Quizzes, flashcards and the Learn techniques (active recall, Feynman, dual coding) come from the same text.',
      'A step-by-step path can be built from a document, only when you ask for it.',
    ],
  },
  'screen-3': {
    title: 'Writing',
    points: [
      'A long-form editor with the sources kept beside the text.',
      'Answers cite the sources they came from, so a claim can be checked.',
      'Your writing stays on this device.',
    ],
  },
  'screen-4': {
    title: 'Building',
    points: [
      'A coding workspace with an agent working inside your project.',
      'Design Studio shows a live preview of the app and lets the assistant inspect it.',
      'Changes are shown as a diff before you commit them.',
    ],
  },
}
