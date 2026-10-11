import { nanoid } from 'nanoid'
import { useStore } from '@/stores/useStore'
import { useUI } from '@/stores/useUI'
import type { WalletCard, WalletCardStyle, WalletState } from './types'

/** Three hours of active use earns the loyalty card. */
export const LOYALTY_MS = 3 * 60 * 60 * 1000

export const FONT_FAMILY: Record<WalletCardStyle['font'], string> = {
  sans: 'Inter, -apple-system, "Segoe UI", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  display: '"Trebuchet MS", "Avenir Next", system-ui, sans-serif',
}

export const DEFAULT_STYLE: WalletCardStyle = {
  background: 'gradient', from: '#6C8EEF', to: '#A78BFA', font: 'sans', text: '#FFFFFF',
}

interface Achievement {
  id: string
  title: string
  subtitle: string
  style: WalletCardStyle
}

/** Cards the app awards on its own. Each is awarded once, then lives in the wallet. */
export const ACHIEVEMENTS: Record<string, Achievement> = {
  'first-quiz': {
    id: 'first-quiz',
    title: 'First quiz',
    subtitle: 'Finished your first quiz',
    style: { ...DEFAULT_STYLE, from: '#22B8D6', to: '#8FE3F2', text: '#0B0D12' },
  },
  loyalty: {
    id: 'loyalty',
    title: 'Loyalty',
    subtitle: 'Three hours with Research Engine',
    style: { ...DEFAULT_STYLE, background: 'gradient', from: '#7C3AED', to: '#F472B6', font: 'display' },
  },
}

const wallet = (): WalletState => useStore.getState().wallet

/** Awards an achievement card once. Returns true when it was newly awarded. */
export function awardCard(achievementId: string): boolean {
  const a = ACHIEVEMENTS[achievementId]
  if (!a || wallet().earned.includes(achievementId)) return false
  const card: WalletCard = {
    id: nanoid(8),
    kind: achievementId === 'loyalty' ? 'loyalty' : 'achievement',
    achievementId,
    title: a.title,
    subtitle: a.subtitle,
    fields: [],
    style: { ...a.style },
    earnedAt: Date.now(),
  }
  useStore.setState((s) => ({
    wallet: { ...s.wallet, earned: [...s.wallet.earned, achievementId], cards: [...s.wallet.cards, card] },
  }))
  useUI.getState().toast('New card in your wallet', a.title)
  return true
}

export function addUsage(ms: number) {
  useStore.setState((s) => ({ wallet: { ...s.wallet, usageMs: s.wallet.usageMs + ms } }))
}

export function saveCard(card: WalletCard) {
  useStore.setState((s) => {
    const exists = s.wallet.cards.some((c) => c.id === card.id)
    const cards = exists ? s.wallet.cards.map((c) => (c.id === card.id ? card : c)) : [...s.wallet.cards, card]
    return { wallet: { ...s.wallet, cards } }
  })
}

export function removeCard(id: string) {
  useStore.setState((s) => ({ wallet: { ...s.wallet, cards: s.wallet.cards.filter((c) => c.id !== id) } }))
}

export function newCustomCard(): WalletCard {
  return {
    id: nanoid(8), kind: 'custom', title: 'My card', subtitle: 'Name it anything',
    fields: [{ label: 'Member', value: 'You' }], style: { ...DEFAULT_STYLE },
  }
}
