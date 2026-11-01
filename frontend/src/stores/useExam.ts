/**
 * Exam mode state.
 *
 * While an exam is running (`active` and not `finished`) the ExamGate overlay
 * covers the whole app and keeps the rest of ResearchEngine unusable. This is
 * a web-app lock only: it cannot stop other programs on the computer, and a
 * determined user can still close the tab. The state is persisted so a reload
 * does not clear the lock.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ExamState {
  active: boolean
  finished: boolean
  countryId: string | null
  index: number
  /** Chosen option per question (-1 = not answered yet). */
  answers: number[]
  startedAt: number | null
  /** Set when the exam is finished; the score and when it was finished. */
  score: number | null
  finishedAt: number | null

  start: (countryId: string, total: number) => void
  answer: (choice: number) => void
  next: () => void
  /** `correct` is the answer key for the chosen country, in question order. */
  finish: (correct: number[]) => void
  /** Leaves the finished result screen. Only allowed after finishing. */
  dismiss: () => void
}

export const useExam = create<ExamState>()(
  persist(
    (set, get) => ({
      active: false,
      finished: false,
      countryId: null,
      index: 0,
      answers: [],
      startedAt: null,
      score: null,
      finishedAt: null,

      start: (countryId, total) =>
        set({
          active: true, finished: false, countryId, index: 0,
          answers: Array(total).fill(-1), startedAt: Date.now(), score: null, finishedAt: null,
        }),

      answer: (choice) => {
        const s = get()
        if (!s.active || s.finished) return
        const answers = [...s.answers]
        answers[s.index] = choice
        set({ answers })
      },

      next: () => {
        const s = get()
        if (s.index < s.answers.length - 1) set({ index: s.index + 1 })
      },

      finish: (correct) => {
        const s = get()
        const score = s.answers.reduce((n, a, i) => n + (a === correct[i] ? 1 : 0), 0)
        set({ finished: true, score, finishedAt: Date.now() })
      },

      dismiss: () => {
        if (!get().finished) return
        set({ active: false, finished: false, countryId: null, index: 0, answers: [], startedAt: null })
      },
    }),
    { name: 're.exam.v1' },
  ),
)
