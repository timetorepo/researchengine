/** Structural preferences are independent of colour themes. */
export const LAYOUTS = [
  { id: 'focused', name: 'Focused', description: 'A clear workspace with no supporting panels.' },
  { id: 'overview', name: 'Overview', description: 'Pinned and recent work beside your next question on Home.' },
  { id: 'studio', name: 'Studio', description: 'A supporting work panel on wide browsing screens. Editors stay clear.' },
] as const
export type WorkspaceLayout = typeof LAYOUTS[number]['id']
export const PINNABLE_TOOLS = [
  { to: '/quiz', label: 'Learn' }, { to: '/articles', label: 'Articles' },
  { to: '/compare', label: 'Compare' }, { to: '/bots', label: 'Bots' },
  { to: '/crm', label: 'CRM' }, { to: '/calendar', label: 'Calendar' },
  { to: '/flood', label: 'Agent Flood' }, { to: '/alpha', label: 'removerAlpha' },
  { to: '/feedback', label: 'Feedback' },
] as const
export function sidebarWidth(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(360, Math.max(216, value))) : 248
}
export function workspaceLayout(value: unknown): WorkspaceLayout {
  return value === 'overview' || value === 'studio' ? value : 'focused'
}
export function studioPanelVisible(path: string, layout: unknown, workbench: boolean): boolean {
  return layout === 'studio' && !workbench && ['/', '/chats', '/library', '/code', '/workflows'].includes(path)
}
