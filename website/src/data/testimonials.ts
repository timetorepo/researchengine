import type { Testimonial } from '@/components/smoothui/inline-testimonials'

/**
 * The three quotes, exactly as they were given. Two of the people are on
 * Instagram, so they are named by their handles and link to their profiles.
 * Avatars are initial tiles until their Instagram pictures are added; the
 * profile link is the source of truth either way.
 */
export const TESTIMONIALS: Testimonial[] = [
  { id: 'lyk41', name: 'lyk41', role: 'early user', quote: 'thats cool ash', rating: 5, avatar: '/avatars/lyk41.svg' },
  { id: 'sahwiizzx', name: 'sahwiizzx', role: 'early user', quote: 'THATS SO COOL', rating: 5, avatar: '/avatars/sahwiizzx.svg' },
  { id: 'muhammadnailskndr', name: 'muhammadnailskndr', role: 'early user', quote: 'ouuuuuuu this fire', rating: 5, avatar: '/avatars/muhammadnailskndr.svg' },
]

/** The sentence the names are woven into, for the inline component. */
export const TESTIMONIAL_TEXT = 'Here is what {{lyk41}}, {{sahwiizzx}} and {{muhammadnailskndr}} said when they tried it.'

/** Where each Instagram-named person can be found. */
export const INSTAGRAM_PROFILES: { handle: string; href: string }[] = [
  { handle: 'lyk41', href: 'https://www.instagram.com/lyk41/' },
  { handle: 'muhammadnailskndr', href: 'https://www.instagram.com/muhammadnailskndr/' },
]
