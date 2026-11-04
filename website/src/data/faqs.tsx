import type { ReactNode } from 'react'

export interface Faq {
  id: string
  title: string
  content: ReactNode
}

export const FAQS: Faq[] = [
  {
    id: 'free',
    title: 'Is it really free?',
    content: (
      <>
        Yes. Research Engine is open source under the MIT licence, there is no account, no trial and no feature held
        back for a paid tier. If you use a paid AI provider, you pay that provider for what you use (their prices, their
        bill) and you can always point it at a model running on your own machine instead.
      </>
    ),
  },
  {
    id: 'where',
    title: 'Where does my work actually live?',
    content: (
      <>
        In a folder on your computer, called <code>research-engine</code> in your home folder. Chats, notes, quizzes,
        articles, workflows and your library are all in there. Backing it up is copying that folder; moving to a new
        computer is copying it too. Nothing is uploaded to us, because there is no us.
      </>
    ),
  },
  {
    id: 'key',
    title: 'Do I need an AI account to try it?',
    content: (
      <>
        Not to look around. A built-in offline model answers while you find your feet, and searching your own documents
        works with no key at all. For long, real answers you add a key from a provider you like (or point it at a local
        model), and the app walks you through that in four steps.
      </>
    ),
  },
  {
    id: 'platforms',
    title: 'Which computers does it run on?',
    content: (
      <>
        Windows 10 and 11, and 64-bit Linux (.deb or .AppImage). There is also a portable build for both platforms that
        only needs Node.js. There is no macOS installer, and this page does not pretend otherwise.
      </>
    ),
  },
  {
    id: 'privacy',
    title: 'Does it send my notes anywhere?',
    content: (
      <>
        Not to us: the app has no analytics and no account system. When you ask a question, that question (and whatever
        you attached to it) goes to the AI provider you chose, the same way it would from any chat app. Privacy Shield
        decides what is allowed to leave: the default posture strips secrets first, and Top Secret keeps everything
        except the provider call on your machine.
      </>
    ),
  },
  {
    id: 'updates',
    title: 'How do updates work?',
    content: (
      <>
        Settings checks the release list, downloads the new version, checks the file against the fingerprint published
        with that release before unpacking a single byte, and swaps the code in. Your library is never part of the swap,
        and if the new version cannot start, the old one comes back by itself.
      </>
    ),
  },
  {
    id: 'change',
    title: 'Can I change it, or use it for my class?',
    content: (
      <>
        Yes, that is what MIT means. Fork it, rename it, teach with it, ship your own version. The whole thing is on
        GitHub, and the docs include how to run it as a single Docker container for a lab or a shared machine.
      </>
    ),
  },
]
