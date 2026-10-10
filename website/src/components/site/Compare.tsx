import { motion } from 'motion/react'
import { Coins, Sparkles } from 'lucide-react'
import ComparisonCard from '@/components/shadcn-space/card/card-21'
import { Badge } from '@/components/ui/badge'
import { COMPARISON, PAID_APPS, PAID_TOTAL } from '@/data/comparison'
import { VERSION } from '@/lib/release'
import { Eyebrow } from '@/components/site/Section'

/**
 * "ResearchEngine is free, unlike…" — the shadcnspace comparison card (vendored
 * as card-21, see website/scripts/site-sources.json) fed with this app's own
 * comparison, plus the seven subscriptions the app's onboarding names, at the
 * prices they publish, so the claim is arithmetic rather than attitude.
 */
export function Compare() {
  return (
    <section className="site-section scroll-mt-24" id="compare">
      <div className="site-shell">
        <motion.header
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: '-80px' }}
          whileInView={{ opacity: 1 }}
        >
          <Eyebrow>The honest comparison</Eyebrow>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-semibold">
            ResearchEngine is free, unlike:
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)]">
            These are the apps it replaces. Plenty of tools do part of this, and they are good tools, but they charge
            every month, they keep your work on their servers, and they decide what you are allowed to do with it.
          </p>
        </motion.header>

        <motion.div
          className="mx-auto mt-12 max-w-4xl"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: '-80px' }}
          whileInView={{ opacity: 1 }}
        >
          <ComparisonCard
            badge="Free, forever"
            data={COMPARISON}
            otherLabel="The monthly subscriptions"
            ourLabel="Research Engine"
          />
        </motion.div>

        <motion.div
          className="panel mx-auto mt-8 max-w-4xl p-6 sm:p-8"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: '-60px' }}
          whileInView={{ opacity: 1 }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-medium">What the apps on the other side cost, at their own entry tiers</h3>
            <span className="text-[13px] text-[var(--text-3)]">
              about <b className="text-foreground">{PAID_TOTAL}</b> every month
            </span>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {PAID_APPS.map((app) => (
              <div
                className="flex items-center justify-between rounded-xl border border-[var(--surface-border)] bg-white/[0.03] px-4 py-2.5"
                key={app.name}
              >
                <div>
                  <div className="text-[13.5px] font-medium">{app.name}</div>
                  <div className="text-[12px] text-[var(--text-3)]">{app.does}</div>
                </div>
                <div className="text-[12.5px] text-[var(--text-2)] tabular-nums">{app.price}</div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl border border-[rgba(124,92,255,0.4)] bg-[rgba(124,92,255,0.12)] px-4 py-2.5">
              <div>
                <div className="text-[13.5px] font-medium">Research Engine {VERSION}</div>
                <div className="text-[12px] text-[#c4b5fd]">all of it, and the source code too</div>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#c4b5fd]">
                <Sparkles className="h-3.5 w-3.5" /> $0
              </div>
            </div>
          </div>
          <p className="mt-5 text-[12.5px] leading-relaxed text-[var(--text-3)]">
            Prices are those vendors' published entry tiers and are shown as context, not as a quote. If you connect a
            paid AI provider to Research Engine, you pay that provider for what you use, and you can always point it at a
            model on your own machine instead.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
