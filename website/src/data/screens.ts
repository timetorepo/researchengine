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
