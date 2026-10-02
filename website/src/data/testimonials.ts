import type { Testimonial } from '@/components/smoothui/inline-testimonials'

/**
 * The three quotes, exactly as they were given, with initial-avatars drawn
 * locally (no external avatar service, and no invented faces).
 */
export const TESTIMONIALS: Testimonial[] = [
  { id: 'raziqq', name: 'raziqq', role: 'early user', quote: 'thats cool ash', rating: 5, avatar: '/avatars/raziqq.svg' },
  { id: 'sahwiizzx', name: 'sahwiizzx', role: 'early user', quote: 'THATS SO COOL', rating: 5, avatar: '/avatars/sahwiizzx.svg' },
  { id: 'nail', name: 'nail', role: 'early user', quote: 'ouuuuuuu this fire', rating: 5, avatar: '/avatars/nail.svg' },
]

/** The sentence the names are woven into, for the inline component. */
export const TESTIMONIAL_TEXT = 'Here is what {{raziqq}}, {{sahwiizzx}} and {{nail}} said when they tried it.'
