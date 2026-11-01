/**
 * A row of overlapping avatars with a "+N" count for the rest. Each avatar shows
 * initials on a stable colour taken from its name, so a person keeps one colour.
 */
export interface GroupMember { id: string; name: string }

const HUES = [210, 150, 25, 285, 340, 60, 190, 110]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function AvatarGroup({ members, max = 4, size = 28, label = 'Members' }: { members: GroupMember[]; max?: number; size?: number; label?: string }) {
  const shown = members.slice(0, max)
  const rest = members.length - shown.length
  return (
    <div role="group" aria-label={`${label}: ${members.map((m) => m.name).join(', ')}`} className="inline-flex items-center">
      {shown.map((m, i) => {
        let h = 0
        for (const ch of m.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
        const hue = HUES[h % HUES.length]
        return (
          <span
            key={m.id}
            title={m.name}
            className="inline-flex items-center justify-center rounded-full text-[10.5px] font-semibold select-none"
            style={{
              width: size, height: size, marginLeft: i ? -size * 0.3 : 0,
              background: `hsl(${hue} 55% 42%)`, color: '#fff', boxShadow: '0 0 0 2px var(--bg, #000)',
            }}
          >
            {initials(m.name)}
          </span>
        )
      })}
      {rest > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full text-[10.5px] font-medium"
          style={{ width: size, height: size, marginLeft: -size * 0.3, background: 'var(--elevated)', color: 'var(--text-2)', boxShadow: '0 0 0 2px var(--bg, #000)' }}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}
