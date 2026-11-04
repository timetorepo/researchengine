/**
 * The card catalog: every card the chat can show, as data.
 *
 * Two parts:
 *  - Connected apps (`APPS`): each app × seven kinds of action (search, list,
 *    read, create, send, update, delete). Each pair has its own spec id, accent
 *    colour, icon and headline wording, and a layout family that decides how
 *    the results are drawn.
 *  - Built-in tools (`BUILTIN`): web, library, docs, connectors, CRM, social,
 *    voice, files, IDE, design checks and the rest of the app's own tools.
 *
 * The catalog is the contract between the tools and the UI. Adding an app is one
 * line in `APPS`; a new family is one renderer in components/cards.
 */
import type { CardFamily, CardKind } from './types'

export interface AppDef {
  /** Composio toolkit slug, lowercase, e.g. `spotify`, `googlecalendar`. */
  id: string
  name: string
  accent: string
  icon: string
  family: CardFamily
  /** Singular and plural nouns for the app's things: "track"/"tracks". */
  noun: string
  plural: string
}

export interface CardSpec {
  id: string
  appId: string
  appName: string
  accent: string
  icon: string
  family: CardFamily
  kind: CardKind
  headline: string
  summary: string
}

/** Connected apps. Accents are each brand's main colour; icons are lucide names. */
export const APPS: AppDef[] = [
  { id: 'spotify', name: 'Spotify', accent: '#1DB954', icon: 'music', family: 'track', noun: 'track', plural: 'tracks' },
  { id: 'youtube', name: 'YouTube', accent: '#FF0033', icon: 'video', family: 'media', noun: 'video', plural: 'videos' },
  { id: 'gmail', name: 'Gmail', accent: '#EA4335', icon: 'mail', family: 'message', noun: 'email', plural: 'emails' },
  { id: 'outlook', name: 'Outlook', accent: '#0078D4', icon: 'mail', family: 'message', noun: 'email', plural: 'emails' },
  { id: 'googlecalendar', name: 'Google Calendar', accent: '#4285F4', icon: 'calendar', family: 'event', noun: 'event', plural: 'events' },
  { id: 'googledrive', name: 'Google Drive', accent: '#0F9D58', icon: 'folder', family: 'file', noun: 'file', plural: 'files' },
  { id: 'googlesheets', name: 'Google Sheets', accent: '#188038', icon: 'sheet', family: 'metric', noun: 'sheet', plural: 'sheets' },
  { id: 'googledocs', name: 'Google Docs', accent: '#4285F4', icon: 'page', family: 'page', noun: 'document', plural: 'documents' },
  { id: 'dropbox', name: 'Dropbox', accent: '#0061FF', icon: 'folder', family: 'file', noun: 'file', plural: 'files' },
  { id: 'github', name: 'GitHub', accent: '#8B5CF6', icon: 'git', family: 'repo', noun: 'repository', plural: 'repositories' },
  { id: 'gitlab', name: 'GitLab', accent: '#FC6D26', icon: 'git', family: 'repo', noun: 'project', plural: 'projects' },
  { id: 'notion', name: 'Notion', accent: '#37352F', icon: 'page', family: 'page', noun: 'page', plural: 'pages' },
  { id: 'slack', name: 'Slack', accent: '#E01E5A', icon: 'message', family: 'message', noun: 'message', plural: 'messages' },
  { id: 'discord', name: 'Discord', accent: '#5865F2', icon: 'message', family: 'message', noun: 'message', plural: 'messages' },
  { id: 'microsoft_teams', name: 'Microsoft Teams', accent: '#6264A7', icon: 'message', family: 'message', noun: 'message', plural: 'messages' },
  { id: 'linear', name: 'Linear', accent: '#5E6AD2', icon: 'check', family: 'task', noun: 'issue', plural: 'issues' },
  { id: 'jira', name: 'Jira', accent: '#0052CC', icon: 'check', family: 'task', noun: 'issue', plural: 'issues' },
  { id: 'trello', name: 'Trello', accent: '#0079BF', icon: 'list', family: 'task', noun: 'card', plural: 'cards' },
  { id: 'asana', name: 'Asana', accent: '#F06A6A', icon: 'check', family: 'task', noun: 'task', plural: 'tasks' },
  { id: 'todoist', name: 'Todoist', accent: '#E44332', icon: 'check', family: 'task', noun: 'task', plural: 'tasks' },
  { id: 'clickup', name: 'ClickUp', accent: '#7B68EE', icon: 'check', family: 'task', noun: 'task', plural: 'tasks' },
  { id: 'airtable', name: 'Airtable', accent: '#18BFFF', icon: 'database', family: 'list', noun: 'record', plural: 'records' },
  { id: 'hubspot', name: 'HubSpot', accent: '#FF7A59', icon: 'user', family: 'person', noun: 'contact', plural: 'contacts' },
  { id: 'salesforce', name: 'Salesforce', accent: '#00A1E0', icon: 'user', family: 'person', noun: 'contact', plural: 'contacts' },
  { id: 'stripe', name: 'Stripe', accent: '#635BFF', icon: 'card', family: 'order', noun: 'payment', plural: 'payments' },
  { id: 'shopify', name: 'Shopify', accent: '#7AB55C', icon: 'cart', family: 'order', noun: 'order', plural: 'orders' },
  { id: 'twitter', name: 'X (Twitter)', accent: '#111111', icon: 'share', family: 'message', noun: 'post', plural: 'posts' },
  { id: 'reddit', name: 'Reddit', accent: '#FF4500', icon: 'message', family: 'list', noun: 'post', plural: 'posts' },
  { id: 'linkedin', name: 'LinkedIn', accent: '#0A66C2', icon: 'user', family: 'person', noun: 'profile', plural: 'profiles' },
  { id: 'instagram', name: 'Instagram', accent: '#E4405F', icon: 'image', family: 'media', noun: 'post', plural: 'posts' },
  { id: 'figma', name: 'Figma', accent: '#A259FF', icon: 'pen', family: 'page', noun: 'file', plural: 'files' },
  { id: 'calendly', name: 'Calendly', accent: '#006BFF', icon: 'calendar', family: 'event', noun: 'booking', plural: 'bookings' },
  { id: 'zoom', name: 'Zoom', accent: '#2D8CFF', icon: 'video', family: 'event', noun: 'meeting', plural: 'meetings' },
  { id: 'mailchimp', name: 'Mailchimp', accent: '#FFE01B', icon: 'megaphone', family: 'metric', noun: 'campaign', plural: 'campaigns' },
  { id: 'sendgrid', name: 'SendGrid', accent: '#1A82E2', icon: 'send', family: 'metric', noun: 'email', plural: 'emails' },
]

/** The seven kinds of action every app gets a card for. */
const KINDS: { kind: CardKind; headline: (a: AppDef) => string; summary: string; family: 'app' | 'action' }[] = [
  { kind: 'search', headline: (a) => `${a.name} search`, summary: 'Best matches first.', family: 'app' },
  { kind: 'list', headline: (a) => `Your ${a.plural} in ${a.name}`, summary: 'Newest first, as the app returns them.', family: 'app' },
  { kind: 'read', headline: (a) => `${a.name} ${a.noun}`, summary: 'The details that matter most.', family: 'app' },
  { kind: 'create', headline: (a) => `Created in ${a.name}`, summary: 'Saved. Open it in the app to keep working.', family: 'action' },
  { kind: 'send', headline: (a) => `Sent with ${a.name}`, summary: 'Sent. Nothing else was changed.', family: 'action' },
  { kind: 'update', headline: (a) => `Updated in ${a.name}`, summary: 'The change is saved in the app.', family: 'action' },
  { kind: 'delete', headline: (a) => `Removed from ${a.name}`, summary: 'Removed. It may be recoverable in the app’s trash.', family: 'action' },
]

const APP_SPECS: CardSpec[] = APPS.flatMap((a) =>
  KINDS.map((k) => ({
    id: `${a.id}.${k.kind}`,
    appId: a.id,
    appName: a.name,
    accent: a.accent,
    icon: a.icon,
    family: k.family === 'action' ? 'action' : a.family,
    kind: k.kind,
    headline: k.headline(a),
    summary: k.summary,
  })),
)

/** Built-in tools, one card each, keyed by the tool name. */
const BUILTIN_DEFS: Array<Omit<CardSpec, 'id' | 'appId'> & { tool: string }> = [
  { tool: 'web_search', appName: 'Web', accent: '#0EA5E9', icon: 'globe', family: 'web', kind: 'search', headline: 'Web results', summary: 'Sources with a short extract each.' },
  { tool: 'library_search', appName: 'Library', accent: '#6366F1', icon: 'book', family: 'web', kind: 'search', headline: 'Library results', summary: 'Matches from your library and the open web.' },
  { tool: 'library_read', appName: 'Library', accent: '#6366F1', icon: 'book', family: 'page', kind: 'read', headline: 'From the library', summary: 'The page as it was read.' },
  { tool: 'docs_search', appName: 'Context7 docs', accent: '#0891B2', icon: 'book', family: 'page', kind: 'search', headline: 'Documentation', summary: 'Current docs and examples for that library.' },
  { tool: 'connector_search', appName: 'Connectors', accent: '#14B8A6', icon: 'inbox', family: 'file', kind: 'search', headline: 'Local search', summary: 'Drive files, mail and calendar on this device.' },
  { tool: 'connector_read', appName: 'Connectors', accent: '#14B8A6', icon: 'file', family: 'page', kind: 'read', headline: 'Local item', summary: 'The full item from this device.' },
  { tool: 'integration_search', appName: 'Integrations', accent: '#F59E0B', icon: 'database', family: 'list', kind: 'search', headline: 'Integration results', summary: 'Matches from a connected integration.' },
  { tool: 'integration_read', appName: 'Integrations', accent: '#F59E0B', icon: 'database', family: 'page', kind: 'read', headline: 'Integration item', summary: 'The full item from the integration.' },
  { tool: 'composio_apps', appName: 'Connectors', accent: '#7C3AED', icon: 'plug', family: 'list', kind: 'list', headline: 'Connected apps', summary: 'The apps you have signed into.' },
  { tool: 'composio_tools', appName: 'Connectors', accent: '#7C3AED', icon: 'wrench', family: 'list', kind: 'list', headline: 'Available actions', summary: 'What this app can do.' },
  { tool: 'crm_search', appName: 'CRM', accent: '#FF7A59', icon: 'user', family: 'person', kind: 'search', headline: 'CRM contacts', summary: 'Matching people and companies.' },
  { tool: 'crm_create', appName: 'CRM', accent: '#FF7A59', icon: 'user', family: 'action', kind: 'create', headline: 'Added to the CRM', summary: 'The record is saved.' },
  { tool: 'seo_domain', appName: 'SEO', accent: '#22C55E', icon: 'chart', family: 'metric', kind: 'read', headline: 'Domain report', summary: 'Authority, traffic and the numbers that matter.' },
  { tool: 'seo_keywords', appName: 'SEO', accent: '#22C55E', icon: 'search', family: 'metric', kind: 'list', headline: 'Keyword ideas', summary: 'Volume and difficulty per keyword.' },
  { tool: 'social_channels', appName: 'Social', accent: '#EC4899', icon: 'share', family: 'list', kind: 'list', headline: 'Social channels', summary: 'The accounts you can post to.' },
  { tool: 'social_draft', appName: 'Social', accent: '#EC4899', icon: 'pen', family: 'message', kind: 'create', headline: 'Draft post', summary: 'Saved as a draft. Nothing is published.' },
  { tool: 'voice_speak', appName: 'Voice', accent: '#A855F7', icon: 'mic', family: 'media', kind: 'create', headline: 'Spoken', summary: 'The audio is ready to play.' },
  { tool: 'read_local_file', appName: 'Files', accent: '#64748B', icon: 'file', family: 'page', kind: 'read', headline: 'File', summary: 'Read from this device.' },
  { tool: 'list_local_files', appName: 'Files', accent: '#64748B', icon: 'folder', family: 'file', kind: 'list', headline: 'Files', summary: 'Found in the folder you named.' },
  { tool: 'ide_list_files', appName: 'Project', accent: '#0D9488', icon: 'folder', family: 'file', kind: 'list', headline: 'Project files', summary: 'The files in this project.' },
  { tool: 'ide_read_file', appName: 'Project', accent: '#0D9488', icon: 'file', family: 'page', kind: 'read', headline: 'Project file', summary: 'The file as it is now.' },
  { tool: 'ide_write_file', appName: 'Project', accent: '#0D9488', icon: 'edit', family: 'action', kind: 'update', headline: 'File saved', summary: 'The change is written to the project.' },
  { tool: 'ide_run_command', appName: 'Terminal', accent: '#334155', icon: 'terminal', family: 'repo', kind: 'create', headline: 'Command run', summary: 'What it printed, summarised.' },
  { tool: 'ide_git', appName: 'Git', accent: '#F05032', icon: 'git', family: 'repo', kind: 'read', headline: 'Git', summary: 'The repository state.' },
  { tool: 'run_ui_test', appName: 'UI test', accent: '#10B981', icon: 'check', family: 'metric', kind: 'read', headline: 'UI test', summary: 'Checks that passed or failed.' },
  { tool: 'design_screenshot', appName: 'Design', accent: '#F472B6', icon: 'image', family: 'media', kind: 'read', headline: 'Screenshot', summary: 'The screen as it is now.' },
  { tool: 'design_snapshot', appName: 'Design', accent: '#F472B6', icon: 'eye', family: 'page', kind: 'read', headline: 'Screen read', summary: 'What is on the screen.' },
  { tool: 'design_audit', appName: 'Design', accent: '#F472B6', icon: 'shield', family: 'metric', kind: 'read', headline: 'UI audit', summary: 'Accessibility and layout findings.' },
  { tool: 'mcp_call', appName: 'MCP server', accent: '#4F46E5', icon: 'package', family: 'generic', kind: 'read', headline: 'MCP result', summary: 'The tool’s answer.' },
  { tool: 'start_coding_mode', appName: 'Coding', accent: '#0D9488', icon: 'terminal', family: 'action', kind: 'create', headline: 'Coding mode', summary: 'This chat now works in a project.' },
  { tool: 'open_section', appName: 'Navigation', accent: '#64748B', icon: 'eye', family: 'action', kind: 'update', headline: 'Opened', summary: 'Moved to that part of the app.' },
  { tool: 'session_sandbox', appName: 'Sandbox', accent: '#475569', icon: 'package', family: 'generic', kind: 'builtin', headline: 'Sandbox', summary: 'Ran in the sandbox.' },
]

const BUILTIN_SPECS: CardSpec[] = BUILTIN_DEFS.map(({ tool, ...d }) => ({ ...d, id: `tool.${tool}`, appId: tool }))

/** Every spec, in one list. The ids are unique and stable: they are stored on messages. */
export const CARD_SPECS: CardSpec[] = [...APP_SPECS, ...BUILTIN_SPECS]

export const BUILTIN_TOOL_SPEC: Record<string, CardSpec> = Object.fromEntries(
  BUILTIN_SPECS.map((s) => [s.appId, s]),
)

export const SPEC_BY_ID: Record<string, CardSpec> = Object.fromEntries(CARD_SPECS.map((s) => [s.id, s]))
