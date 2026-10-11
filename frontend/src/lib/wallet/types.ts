export type CardFont = 'sans' | 'serif' | 'mono' | 'display'
export type CardBackground = 'gradient' | 'solid' | 'image'

export interface WalletField { label: string; value: string }

export interface WalletCardStyle {
  background: CardBackground
  /** Gradient start, or the solid colour. */
  from: string
  /** Gradient end. */
  to: string
  /** A picture (data URL) behind the card, for background "image". */
  image?: string
  font: CardFont
  /** Text colour. */
  text: string
}

export interface WalletCard {
  id: string
  kind: 'achievement' | 'loyalty' | 'custom'
  /** Which achievement awarded this card, when it was awarded. */
  achievementId?: string
  title: string
  subtitle: string
  fields: WalletField[]
  style: WalletCardStyle
  earnedAt?: number
}

export interface WalletState {
  /** Active time in the app, in milliseconds. */
  usageMs: number
  /** Achievement ids already awarded, so each one is awarded once. */
  earned: string[]
  cards: WalletCard[]
}
