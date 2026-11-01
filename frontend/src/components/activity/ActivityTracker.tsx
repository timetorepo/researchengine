import { useEffect } from 'react'
import { startActivityTracker } from '@/lib/activity/tracker'

/** Mount once. It has no UI: it watches for real work and pays out rewards. */
export function ActivityTracker() {
  useEffect(() => startActivityTracker(), [])
  return null
}
