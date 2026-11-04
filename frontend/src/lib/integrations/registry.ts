/**
 * The integration catalogue — one entry per service this build can actually
 * talk to. `auth: 'token'` means the account's credential is held by the user
 * (encrypted in the vault) and travels with each request; nothing is stored on
 * the server side.
 *
 * Keep in sync with `backend/src/services/integrations/index.ts` — the test
 * suite reads that file and fails if the two lists drift apart.
 */
export type IntegrationId = 'files' | 'drive' | 'gmail' | 'gcal' | 'github' | 'notion' | 'slack'

export type CredentialField = 'token' | 'refreshToken' | 'clientId' | 'clientSecret' | 'base'

export interface IntegrationDef {
  id: IntegrationId
  name: string
  /** Halo hue used by the popover tile. */
  hue: number
  auth: 'none' | 'token'
  scopes: string[]
  /** What the credential is, in the user's words. */
  hint: string
  /** Where to create it. */
  docs?: string
  /** Which fields the connect form shows, in order. */
  fields: CredentialField[]
  /** Shown in the composer's plug menu. */
  short: string
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'files', name: 'Local files', hue: 210, auth: 'none', scopes: ['read:workspace'],
    hint: 'Your Research Engine folder. No account, nothing to connect.',
    short: 'This machine',
    fields: [],
  },
  {
    id: 'drive', name: 'Google Drive', hue: 145, auth: 'token', scopes: ['drive.readonly'],
    hint: 'Paste an access token, or a refresh token with the client id and secret so it renews itself.',
    docs: 'https://developers.google.com/drive/api/guides/api-specific-auth',
    short: 'Docs, sheets, PDFs',
    fields: ['token', 'refreshToken', 'clientId', 'clientSecret'],
  },
  {
    id: 'gmail', name: 'Gmail', hue: 8, auth: 'token', scopes: ['gmail.readonly'],
    hint: 'The same Google connection as Drive — gmail.readonly is what lets the agent search and read mail.',
    docs: 'https://developers.google.com/gmail/api/auth/scopes',
    short: 'Search and read mail',
    fields: ['token', 'refreshToken', 'clientId', 'clientSecret'],
  },
  {
    id: 'gcal', name: 'Google Calendar', hue: 265, auth: 'token', scopes: ['calendar.readonly'],
    hint: 'calendar.readonly, read-only in both directions: events are never written back.',
    docs: 'https://developers.google.com/calendar/api/guides/auth',
    short: 'Events and who is on them',
    fields: ['token', 'refreshToken', 'clientId', 'clientSecret'],
  },
  {
    id: 'github', name: 'GitHub', hue: 0, auth: 'token', scopes: ['repo:read', 'issues:read'],
    hint: 'A fine-grained personal access token, read-only. Issues, pull requests and code search.',
    docs: 'https://github.com/settings/tokens',
    short: 'Issues, PRs, code',
    fields: ['token', 'base'],
  },
  {
    id: 'notion', name: 'Notion', hue: 40, auth: 'token', scopes: ['read_content'],
    hint: 'An internal integration token — share the pages with it inside Notion or it sees nothing.',
    docs: 'https://www.notion.so/my-integrations',
    short: 'Pages and databases',
    fields: ['token', 'base'],
  },
  {
    id: 'slack', name: 'Slack', hue: 300, auth: 'token', scopes: ['search:read'],
    hint: 'A user token with search:read. A bot token cannot search messages.',
    docs: 'https://api.slack.com/authentication/token-types',
    short: 'Messages and threads',
    fields: ['token', 'base'],
  },
]

export const integrationById = (id: string): IntegrationDef | undefined =>
  INTEGRATIONS.find((i) => i.id === id)

export const integrationLabel = (id: string): string => integrationById(id)?.name ?? id

export const FIELD_LABELS: Record<CredentialField, { label: string; placeholder: string; secret: boolean }> = {
  token: { label: 'Access token', placeholder: 'ya29.… / ghp_… / secret_…', secret: true },
  refreshToken: { label: 'Refresh token', placeholder: '1//0g…', secret: true },
  clientId: { label: 'OAuth client id', placeholder: '…apps.googleusercontent.com', secret: false },
  clientSecret: { label: 'OAuth client secret', placeholder: 'GOCSPX-…', secret: true },
  base: { label: 'Base URL (optional)', placeholder: 'https://api.github.com', secret: false },
}
