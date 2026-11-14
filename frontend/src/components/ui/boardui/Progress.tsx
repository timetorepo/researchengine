/** Original adapter following BoardUI's public progress anatomy; no fabricated progress. */
export function BoardProgress({ value, label, showValue = false, className = '' }: { value?: number; label: string; showValue?: boolean; className?: string }) {
  const percent = value === undefined || !Number.isFinite(value) ? undefined : Math.max(0, Math.min(100, value))
  return <div className={className}>{showValue && <div className="flex justify-between gap-3 mb-2 text-xs"><span>{label}</span>{percent !== undefined && <span className="tabular-nums">{Math.round(percent)}%</span>}</div>}
    <div className="bui-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className="bui-progress-fill" data-indeterminate={percent === undefined} style={percent === undefined ? undefined : { transform: `scaleX(${percent / 100})` }} />
    </div>
  </div>
}

export function BoardProgressCircle({ value, label, size = 80 }: { value?: number; label: string; size?: number }) {
  const percent = value === undefined || !Number.isFinite(value) ? undefined : Math.max(0, Math.min(100, value))
  const radius = 20; const length = 2 * Math.PI * radius
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={percent === undefined ? 'bui-circle-spin' : undefined}>
      <circle cx={24} cy={24} r={radius} fill="none" stroke="var(--elevated)" strokeWidth={3} />
      <circle cx={24} cy={24} r={radius} fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - (percent ?? 25) / 100)} transform="rotate(-90 24 24)" />
    </svg>
    {percent !== undefined && <span className="absolute text-sm tabular-nums">{Math.round(percent)}%</span>}
  </div>
}
