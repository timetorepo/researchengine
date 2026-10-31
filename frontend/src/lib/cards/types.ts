/**
 * Rich result cards for tool calls.
 *
 * A tool call never shows its raw output in the chat. The output is turned into
 * a `CardPayload` (a small, clipped, structured summary) and the chat renders it
 * as a card for the app or task it came from: a track list for Spotify, a
 * message list for Gmail, an action receipt for "create", and so on.
 *
 * Payloads are what gets stored on the message, so they are kept small: at most
 * a handful of items, short strings, and no nested objects.
 */

export type CardFamily =
  | 'track' | 'media' | 'message' | 'person' | 'event' | 'file' | 'repo' | 'task'
  | 'page' | 'order' | 'place' | 'metric' | 'list' | 'action' | 'web' | 'generic'

export type CardKind = 'search' | 'list' | 'read' | 'create' | 'send' | 'update' | 'delete' | 'builtin'

export interface CardItem {
  title: string
  subtitle?: string
  meta?: string
  /** An https image (album art, avatar, thumbnail). */
  image?: string
  /** An https link to open the thing in its own app or site. */
  href?: string
}

export interface CardField { label: string; value: string }

export interface CardPayload {
  /** The catalog entry that rendered it, e.g. `spotify.search`. */
  specId: string
  family: CardFamily
  kind: CardKind
  /** The tool that was called, e.g. `composio_run` or `web_search`. */
  tool: string
  /** The action name when the tool is a connected-app action, e.g. `SPOTIFY_SEARCH_TRACKS`. */
  action?: string
  appId: string
  appName: string
  accent: string
  icon: string
  headline: string
  summary: string
  status: 'ok' | 'empty' | 'error'
  items: CardItem[]
  fields: CardField[]
  /** How many results the source reported, when it said. */
  total?: number
  createdAt: number
}

export const MAX_CARD_ITEMS = 6
export const MAX_CARD_FIELDS = 6
export const MAX_CARD_TEXT = 160
