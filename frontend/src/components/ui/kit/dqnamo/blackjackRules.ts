// Pure blackjack rules for the dqnamo-style card table. The AI opponent plays
// a fixed basic strategy: hit on 16 or less, stand on 17 or more.
export type Card = { rank: string; suit: '♠' | '♥' | '♦' | '♣'; value: number }

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: Card['suit'][] = ['♠', '♥', '♦', '♣']

export function freshDeck(rng: () => number = Math.random): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) {
    const value = rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(rank) ? 10 : Number(rank)
    deck.push({ rank, suit, value })
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function handTotal(hand: Card[]): number {
  let total = hand.reduce((s, c) => s + c.value, 0)
  let aces = hand.filter((c) => c.rank === 'A').length
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

export function aiShouldHit(hand: Card[]): boolean {
  return handTotal(hand) <= 16
}

export type Outcome = 'player' | 'ai' | 'push'

export function outcome(player: Card[], ai: Card[]): Outcome {
  const p = handTotal(player), a = handTotal(ai)
  const pBust = p > 21, aBust = a > 21
  if (pBust && aBust) return 'push'
  if (pBust) return 'ai'
  if (aBust) return 'player'
  if (p === a) return 'push'
  return p > a ? 'player' : 'ai'
}
