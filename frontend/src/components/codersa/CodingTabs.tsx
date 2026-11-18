import { Link } from 'react-router-dom'
import { useStaticMaterials } from '@/lib/design/useLiquidGlass'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { SegmentedControl } from 'glisse'
import 'glisse/styles.css'

/** The two sections of Coding: the project workbench, and Codersa, the agent.
 *  The switch is Glisse's liquid-glass segmented control (MIT, github.com/0kzh/glisse). */
export function CodingTabs({ active }: { active: 'projects' | 'codersa' }) {
  const staticMaterials = useStaticMaterials()
  const navigate = useNavigate()
  const routes: Record<'projects' | 'codersa', string> = { projects: '/code', codersa: '/code/codersa' }
  if (staticMaterials) return <nav aria-label="Coding sections" className="re-static-navigation">{(['projects', 'codersa'] as const).map(key => <Link key={key} to={routes[key]} aria-current={key === active ? 'page' : undefined}>{key === 'projects' ? 'Projects' : 'Codersa'}</Link>)}</nav>
  return (
    <SegmentedControl
      aria-label="Coding sections"
      items={[
        { value: 'projects', label: 'Projects' },
        { value: 'codersa', label: 'Codersa' },
      ]}
      value={active}
      onValueChange={(v) => { if (v !== active) navigate(routes[v as 'projects' | 'codersa']) }}
    />
  )
}
