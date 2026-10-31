import { extendTailwindMerge } from 'tailwind-merge'

/** Class-name merge for vendored Untitled UI components. Same behaviour as their cx helper. */
export const cx = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display-xs', 'display-sm', 'display-md', 'display-lg', 'display-xl', 'display-2xl'],
    },
  },
})
