import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, EyeOff } from 'lucide-react'
import { useUI } from '@/stores/useUI'

const SECRETS = [
  ['-404', 'Type exactly "-404" as your whole message. It never reaches the model.'],
  ['/konami', 'A star field, for this session only. Type it again to dismiss.'],
  ['origin story', 'Send it in a brand-new, empty chat. A small build note appears.'],
  ['Long-press the logo', 'Hold the app logo for three seconds. Sonar ping, plus lifetime tokens saved.'],
  ['Tap the Privacy Shield 7 times', 'A live network diagnostics overlay. Six taps do nothing. The seventh does.'],
]

export function SecretsRoute() {
  const ui = useUI()
  React.useEffect(() => { ui.set({ secretsFound: true }) }, [])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[640px] mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-[12.5px] mb-8" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={13} /> Back
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <EyeOff size={20} strokeWidth={1.5} style={{ color: 'var(--secondary)' }} />
          <h1 className="text-2xl font-semibold" style={{ letterSpacing: '-0.02em' }}>You found the secrets page</h1>
        </div>
        <p className="text-[13.5px] mb-8" style={{ color: 'var(--text-2)' }}>
          Nothing here is announced anywhere else. These exist purely to reward curiosity.
          All of them stand down when your system asks for reduced motion.
        </p>
        <div className="space-y-3">
          {SECRETS.map(([k, desc], i) => (
            <div key={k} className="surface p-4 flex items-start gap-4">
              <span className="text-[11px] font-mono w-5 shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <code className="text-[13px] font-mono px-2 py-0.5 rounded-[8px]" style={{ background: 'var(--elevated)', color: 'var(--primary)' }}>{k}</code>
                <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] mt-8" style={{ color: 'var(--text-3)' }}>
          The shortcuts panel hints at this page. That's the only hint.
        </p>
      </div>
    </div>
  )
}
