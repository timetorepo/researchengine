// Suspense fallback while a lazy route chunk streams in.
// Skeleton bars — never a spinner — matching the content area rhythm.
import React from 'react'

export function RouteSkeleton() {
  return (
    <div className="flex-1 min-h-0 overflow-hidden" aria-hidden="true">
      <div className="max-w-[760px] mx-auto px-4 pt-10 space-y-4">
        <div className="skeleton h-7 w-2/5 rounded-[10px]" />
        <div className="skeleton h-4 w-full rounded-[8px]" />
        <div className="skeleton h-4 w-11/12 rounded-[8px]" />
        <div className="skeleton h-4 w-4/5 rounded-[8px]" />
        <div className="pt-4 grid grid-cols-2 gap-3">
          <div className="skeleton h-24 rounded-[14px]" />
          <div className="skeleton h-24 rounded-[14px]" />
        </div>
      </div>
    </div>
  )
}
