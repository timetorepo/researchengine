// Animated card diagram: a row of linked nodes. A pulse travels along the links
// in turn, showing how a request moves through the stages.
// Inspired by badtzx0's "Animated Card Diagram" on 21st.dev
// (https://21st.dev/@badtzx0/components/animated-card-diagram). Rebuilt here from
// its description; it is not a copy of the upstream source.
export function AnimatedCardDiagram({ title, nodes }: { title: string; nodes: string[] }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <div className="rounded-[16px] p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
      <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text-1)' }}>{title}</div>
      <div className="flex items-center gap-1 flex-wrap">
        {nodes.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            <span className="rounded-[10px] px-3 py-1.5 text-[12px]"
              style={{
                background: 'var(--elevated)',
                border: '1px solid var(--surface-border)',
                color: 'var(--text-1)',
                animation: reduce ? 'none' : `hyperiux-node 3.2s ease-in-out ${i * 0.5}s infinite`,
              }}>{n}</span>
            {i < nodes.length - 1 && (
              <span aria-hidden="true" className="relative h-[2px] w-6 rounded-full overflow-hidden" style={{ background: 'var(--surface-border)' }}>
                {!reduce && <span className="absolute inset-y-0 w-2 rounded-full" style={{ background: 'var(--primary)', animation: `hyperiux-link 1.6s linear ${i * 0.5}s infinite` }} />}
              </span>
            )}
          </span>
        ))}
      </div>
      <style>{'@keyframes hyperiux-node{0%,100%{box-shadow:0 0 0 0 transparent}15%{box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 35%,transparent)}30%{box-shadow:0 0 0 0 transparent}}@keyframes hyperiux-link{from{left:-10%}to{left:100%}}'}</style>
    </div>
  )
}
