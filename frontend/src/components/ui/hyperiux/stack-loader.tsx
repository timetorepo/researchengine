// Stack loader: three cards that lift and drop in turn, like a deck being shuffled.
// Inspired by Hyperiux Vault's "Stack Loader" on 21st.dev
// (https://21st.dev/@hyperiux/components/stack-loader). Rebuilt here from its
// description; it is not a copy of the upstream source.
export function StackLoader({ size = 36, label = 'Loading' }: { size?: number; label?: string }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <span role="status" aria-label={label} className="inline-block" style={{ width: size, height: size * 0.8, position: 'relative' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: i * (size * 0.22),
            height: size * 0.22,
            borderRadius: size * 0.08,
            background: i === 0 ? 'var(--primary)' : i === 1 ? 'var(--secondary, var(--primary))' : 'var(--success, var(--primary))',
            opacity: 0.9 - i * 0.2,
            animation: reduce ? 'none' : `hyperiux-stack 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes hyperiux-stack{0%,100%{transform:translateY(0)}50%{transform:translateY(${-size * 0.18}px)}}`}</style>
    </span>
  )
}
