import { useEffect, useState } from 'react'
import { FONT_FAMILY } from '@/lib/wallet/cards'
import { ensureCustomFont } from '@/lib/wallet/fonts'
import { DitherCreditCard } from '@/components/ui/skecher/dither-credit-card'
import type { WalletCardStyle, WalletField } from '@/lib/wallet/types'

/**
 * A card in the Apple Pay style: a rounded plate at the card's proportions,
 * the name across the top, a chip and the holder's details below. Everything
 * on it comes from the card's own style, so any card can be made to look like
 * any other.
 */
export function WalletCardView({ title, subtitle, fields, style, className = '' }: {
  title: string
  subtitle: string
  fields: WalletField[]
  style: WalletCardStyle
  className?: string
}) {
  // An uploaded font is registered first; until it is ready the card uses the sans face.
  const [customFamily, setCustomFamily] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (style.font === 'custom' && style.fontData) {
      ensureCustomFont(style.fontData).then((f) => live && setCustomFamily(f)).catch(() => live && setCustomFamily(null))
    }
    return () => { live = false }
  }, [style.font, style.fontData])
  const family =
    style.font === 'custom' ? (customFamily ? `"${customFamily}", ${FONT_FAMILY.sans}` : FONT_FAMILY.sans) : FONT_FAMILY[style.font]
  const bg =
    style.background === 'image' && style.image
      ? `url(${style.image}) center / cover no-repeat`
      : style.background === 'solid'
        ? style.from
        : `linear-gradient(135deg, ${style.from}, ${style.to})`
  // The dithered option is the credit-card component: same name, details and
  // colours as the plate below, drawn with a shader instead of a gradient.
  if (style.background === 'dither') {
    return (
      <div className={`aspect-[1.586/1] w-full ${className}`}>
        <DitherCreditCard
          ariaLabel={title || 'Card'}
          interactive={false}
          colors={{ background: style.from, accent: style.to, foreground: style.text, details: style.text }}
          content={{ brandName: title || 'Untitled', cardholder: subtitle, cardNumber: fields[0]?.value }}
        />
      </div>
    )
  }
  return (
    <div
      className={`relative aspect-[1.586/1] w-full overflow-hidden rounded-[20px] p-5 text-left select-none ${className}`}
      style={{
        background: bg,
        color: style.text,
        fontFamily: family,
        boxShadow: '0 18px 40px rgb(0 0 0 / .28), inset 0 1px 0 rgb(255 255 255 / .25)',
      }}
    >
      {style.background === 'image' && style.image && (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.55))' }} />
      )}
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold tracking-tight">{title || 'Untitled'}</div>
            {subtitle && <div className="mt-0.5 truncate text-[11.5px] opacity-80">{subtitle}</div>}
          </div>
          {/* A chip, drawn rather than imaged, so it is the same on every card. */}
          <div className="h-7 w-10 shrink-0 rounded-[6px] opacity-90" style={{ background: 'linear-gradient(135deg, #f7e7a1, #c9a24a)', boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / .15)' }} />
        </div>
        <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2">
          {fields.slice(0, 4).map((f, i) => (
            <div key={i} className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.12em] opacity-70">{f.label}</div>
              <div className="truncate text-[12.5px] font-medium">{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
