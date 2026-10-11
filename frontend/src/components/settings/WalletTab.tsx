import { WalletPanel } from '@/components/wallet/WalletPanel'
import { useStore } from '@/stores/useStore'
import { LOYALTY_MS } from '@/lib/wallet/cards'

/** The wallet, in Settings: earned cards, your own cards, and how far to the next one. */
export function WalletTab() {
  const usage = useStore((s) => s.wallet.usageMs)
  const earned = useStore((s) => s.wallet.earned.includes('loyalty'))
  const hours = (usage / 3_600_000).toFixed(1)
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>Wallet</h2>
        <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
          Cards you earn by using the app. Customise any of them, or add your own with a name, colours, a typeface and a picture.
        </p>
      </div>
      {!earned && (
        <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Active time so far: {hours} h of 3 h for the loyalty card.</p>
      )}
      <WalletPanel />
    </div>
  )
}
