/**
 * How a bubble looks.
 *
 * The default is the app's own: a soft card, wide, with the sender's text
 * reversed out. `imessage` is the other thing people ask for, and it is not a
 * theme — it is a different grammar. iMessage groups a run of messages from one
 * person into one shape, gives only the last of the run a tail, and puts the
 * sender's fill on the right and the receiver's on the left. Getting that from
 * a border-radius change alone does not work, so the shape is computed here and
 * handed to the bubble as plain CSS.
 *
 * Everything is a setting because taste here is genuinely personal, and because
 * a chat you cannot read is not a chat.
 */

export type BubbleStyle = 'classic' | 'imessage' | 'square' | 'pill'
export type FillChoice = 'theme' | 'blue' | 'green' | 'purple' | 'orange' | 'gray' | 'custom'

export interface BubblePrefs {
  style: BubbleStyle
  /** What the sender's bubble is filled with. */
  senderFill: FillChoice
  /** Used when `senderFill` is `custom`. */
  senderColor?: string
  /** What the assistant's bubble is filled with. */
  aiFill: FillChoice
  /** Used when `aiFill` is `custom`. */
  aiColor?: string
  /** The little tail on the last bubble of a run. iMessage only. */
  tails: boolean
  /** Show the avatar beside each message. */
  avatars: boolean
  /** How much of the row a bubble may take. */
  width: 'narrow' | 'normal' | 'wide'
  /** Group a run from one author tighter, with one tail for the run. */
  groupRuns: boolean
}

export const DEFAULT_BUBBLES: BubblePrefs = {
  style: 'classic',
  senderFill: 'theme',
  aiFill: 'theme',
  tails: true,
  avatars: true,
  width: 'normal',
  groupRuns: true,
}

/** The fills a person can pick, as concrete colours. `theme` is resolved at use. */
export const FILL_SWATCHES: Record<Exclude<FillChoice, 'theme' | 'custom'>, string> = {
  blue: '#0B84FF',
  green: '#2FB344',
  purple: '#8E5BF0',
  orange: '#FF8A3D',
  // iMessage's receiver fill in its default light appearance: a light gray that
  // carries black text. The dark-mode variant is the theme's own surface, which
  // is what `theme` is for.
  gray: '#E9E9EB',
}

const WIDTH_MAX: Record<BubblePrefs['width'], string> = {
  narrow: '58%',
  normal: '76%',
  wide: '92%',
}

/**
 * iMessage's radius, and the corner that gets the tail. The tail corner is
 * drawn small rather than as a separate shape: it reads as the same bubble with
 * a pointed corner, which is what the real thing does.
 */
const IMESSAGE_RADIUS = 18
const IMESSAGE_TAIL = 5

export interface BubbleShape {
  /** Inline style for the bubble itself. */
  style: React.CSSProperties
  /** Inline style for the row that positions it. */
  rowStyle: React.CSSProperties
  /** True when the text inside should be light (on a dark fill). */
  light: boolean
}

/** Resolve a fill choice to a colour, or null to keep the theme's own. */
export function resolveFill(choice: FillChoice, custom: string | undefined, themeFill: string): string {
  if (choice === 'theme') return themeFill
  if (choice === 'custom') return custom || themeFill
  return FILL_SWATCHES[choice] ?? themeFill
}

/**
 * True when a fill is dark enough that the text on it should be light. Cheap
 * luminance from the hex; anything unparseable is treated as dark, because the
 * theme's own fills are.
 */
export function fillIsDark(color: string): boolean {
  const m = color.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return true
  let hex = m[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // Rec. 601 luma, the same weighting every "is this readable" check uses.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55
}

export interface BubbleInput {
  prefs: BubblePrefs
  /** Who wrote this message. */
  from: 'user' | 'assistant'
  /**
   * Position in a run of messages from the same author: `solo`, `first`,
   * `middle`, `last`. Drives the tail and the tighter spacing.
   */
  position: 'solo' | 'first' | 'middle' | 'last'
  /** The theme's own fill for this side, used when the choice is `theme`. */
  themeFill: string
}

export function bubbleShape({ prefs, from, position, themeFill }: BubbleInput): BubbleShape {
  const isUser = from === 'user'
  const choice = isUser ? prefs.senderFill : prefs.aiFill
  const custom = isUser ? prefs.senderColor : prefs.aiColor
  const fill = resolveFill(choice, custom, themeFill)
  const light = fillIsDark(fill)

  const style: React.CSSProperties = {}
  const rowStyle: React.CSSProperties = {}

  const maxWidth = WIDTH_MAX[prefs.width]
  style.maxWidth = maxWidth

  if (prefs.style === 'imessage') {
    style.background = fill
    style.color = light ? '#fff' : '#000'
    style.padding = '7px 14px'
    style.borderRadius = IMESSAGE_RADIUS
    style.fontSize = '15px'
    style.lineHeight = 1.35
    // iMessage's text is left-aligned inside the bubble, never centred, and the
    // bubble never stretches to the row's full width.
    style.width = 'fit-content'

    const last = position === 'solo' || position === 'last'
    const first = position === 'solo' || position === 'first'
    // The tail is the corner nearest the speaker, and only on the last bubble
    // of the run. Without `tails`, every bubble is a plain rounded rect.
    if (prefs.tails) {
      if (isUser) style.borderBottomRightRadius = last ? IMESSAGE_TAIL : IMESSAGE_RADIUS
      else style.borderBottomLeftRadius = last ? IMESSAGE_TAIL : IMESSAGE_RADIUS
      if (isUser) style.borderTopRightRadius = first ? IMESSAGE_TAIL : IMESSAGE_RADIUS
      else style.borderTopLeftRadius = first ? IMESSAGE_TAIL : IMESSAGE_RADIUS
    }
    rowStyle.justifyContent = isUser ? 'flex-end' : 'flex-start'
  } else if (prefs.style === 'square') {
    style.background = fill
    style.color = light ? '#fff' : '#000'
    style.padding = '10px 14px'
    style.borderRadius = 4
    style.fontSize = '14.5px'
    style.width = 'fit-content'
    rowStyle.justifyContent = isUser ? 'flex-end' : 'flex-start'
  } else if (prefs.style === 'pill') {
    style.background = fill
    style.color = light ? '#fff' : '#000'
    style.padding = '9px 18px'
    style.borderRadius = 999
    style.fontSize = '14.5px'
    style.width = 'fit-content'
    rowStyle.justifyContent = isUser ? 'flex-end' : 'flex-start'
  } else {
    // classic: the app's own card, kept as it was so nobody's layout moves.
    style.background = fill
    style.color = light ? '#fff' : 'inherit'
    style.borderRadius = 16
    style.padding = '10px 14px'
    rowStyle.justifyContent = isUser ? 'flex-end' : 'flex-start'
  }

  return { style, rowStyle, light }
}

/**
 * Where a message sits in a run, from the messages around it. A run is a stretch
 * of consecutive messages from the same author; the gap between runs is wider
 * than the gap inside one, which is what makes a thread readable at a glance.
 */
export function runPosition<T extends { role: string }>(
  list: T[],
  index: number,
): 'solo' | 'first' | 'middle' | 'last' {
  const me = list[index]
  if (!me) return 'solo'
  const prev = list[index - 1]
  const next = list[index + 1]
  const prevSame = prev?.role === me.role
  const nextSame = next?.role === me.role
  if (!prevSame && !nextSame) return 'solo'
  if (!prevSame && nextSame) return 'first'
  if (prevSame && nextSame) return 'middle'
  return 'last'
}

/** Vertical gap around a message, from its position in the run. */
export function runGap(prefs: BubblePrefs, position: 'solo' | 'first' | 'middle' | 'last'): string {
  if (!prefs.groupRuns) return '16px'
  if (prefs.style === 'imessage') {
    if (position === 'solo') return '14px'
    if (position === 'first') return '14px 0 2px'
    if (position === 'middle') return '2px 0'
    return '2px 0 14px'
  }
  return position === 'solo' ? '16px' : '10px'
}
