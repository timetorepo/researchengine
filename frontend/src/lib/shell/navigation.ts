/** Shared shell policy. Keep route matching bounded: /code is not /coders. */
export const PRIMARY_ROUTES = ['/', '/chats', '/code', '/library', '/workflows'] as const

export function matchesSection(path: string, section: string): boolean {
  return path === section || (section !== '/' && path.startsWith(`${section}/`))
}

export function floatingNavigationVisible(path: string, enabled: boolean, workbenchOpen = false): boolean {
  return enabled && !(matchesSection(path, '/code') && workbenchOpen) && !matchesSection(path, '/chat') && !matchesSection(path, '/code/codersa')
    && !matchesSection(path, '/settings') && !(/^\/workflows\/.+/.test(path))
}

export function shellSectionLabel(path: string): string {
  const sections = [
    ['/code/codersa', 'Codersa'], ['/code', 'Coding'], ['/chats', 'Chats'], ['/chat', 'Research'],
    ['/library', 'Library'], ['/workflows', 'Workflows'], ['/quiz', 'Learn'], ['/articles', 'Articles'],
    ['/compare', 'Compare'], ['/bots', 'Bots'], ['/crm', 'CRM'], ['/calendar', 'Calendar'],
    ['/flood', 'Agent Flood'], ['/alpha', 'removerAlpha'], ['/feedback', 'Feedback'],
    ['/marketplace', 'Marketplace'], ['/settings', 'Settings'], ['/secrets', 'Secrets'],
  ]
  return sections.find(([route]) => matchesSection(path, route))?.[1] ?? 'Home'
}
