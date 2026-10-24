import { useRef, useState, useCallback, useEffect } from 'react'

/** Minimal windowing for long lists — renders only the visible slice. */
export function useVirtualList(count: number, itemHeight: number, overscan = 6) {
  const ref = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ start: 0, end: 40 })
  const [height, setHeight] = useState(0)

  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const start = Math.max(0, Math.floor(el.scrollTop / itemHeight) - overscan)
    const visible = Math.ceil(el.clientHeight / itemHeight)
    setRange({ start, end: Math.min(count, start + visible + overscan * 2) })
  }, [count, itemHeight, overscan])

  useEffect(() => {
    onScroll()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(onScroll)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onScroll])

  return {
    ref,
    onScroll,
    containerStyle: { height: count * itemHeight, position: 'relative' as const },
    offset: range.start * itemHeight,
    slice: range,
  }
}
