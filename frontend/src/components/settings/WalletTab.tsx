import Counter from '@/components/ui/reactbits/Counter'
import { WalletPanel } from '@/components/wallet/WalletPanel'
import { useStore } from '@/stores/useStore'
import { LOYALTY_MS } from '@/lib/wallet/cards'

/** The wallet, in Settings: earned cards, your own cards, and how far to the next one. */
export function WalletTab() {
  const usage = useStore((s) => s.wallet.usageMs)
  const earned = useStore((s) => s.wallet.earned.includes('loyalty'))
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Wallet</h2>
        <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
          Cards you earn by using the app. Customise any of them, or add your own with a name, colours, a typeface and a picture.
        </p>
      </div>
      {!earned && (
        <div className="surface flex flex-wrap items-center gap-3 p-4 text-[12.5px]" style={{ color: 'var(--text-2)' }}>
          <span>Active minutes toward the loyalty card</span>
          <span className="ml-auto flex items-baseline gap-1.5">
            <Counter value={Math.min(180, Math.floor(usage / 60_000))} fontSize={22} gradientHeight={0} />
            <span style={{ color: 'var(--text-3)' }}>of 180</span>
          </span>
        </div>
      )}
      <WalletPanel />
    </div>
  )
}
