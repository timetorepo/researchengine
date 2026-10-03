import type { TerminalLine } from '@/components/smoothui/mac-terminal'

/**
 * What the backend actually prints.
 *
 * Every line here was run while building this round: the server booting, the
 * health check reporting the version the page offers, the Library search with
 * its per-source reasons, and an update resuming from a partial file. Real
 * output, shortened, so the terminal is a demonstration and not a mock-up.
 */
export const TERMINAL_LINES: TerminalLine[] = [
  { id: 't1', type: 'command', text: 'npx research-engine serve --port 3847', delay: 200 },
  { id: 't2', type: 'output', text: 'Research Engine listening on http://127.0.0.1:3847' },
  { id: 't3', type: 'command', text: 'curl -s localhost:3847/api/health', delay: 320 },
  {
    id: 't4',
    type: 'success',
    text: '{"ok":true,"web":{"served":{"version":"{{VERSION}}","mode":"portable"}},"db":{"engine":"sqlite"}}',
  },
  { id: 't5', type: 'command', text: "curl -s 'localhost:3847/api/library/search?q=javascript'", delay: 380 },
  { id: 't6', type: 'output', text: '  your documents   ok      3 results   12 ms' },
  { id: 't7', type: 'error', text: '  wikipedia        error   dropped the connection (en.wikipedia.org)' },
  { id: 't8', type: 'comment', text: '# a failed source says why, instead of leaving the page blank', delay: 300 },
  { id: 't9', type: 'command', text: 'research-engine update', delay: 320 },
  { id: 't10', type: 'success', text: 'checksum verified before unpacking · library untouched' },
  { id: 't11', type: 'comment', text: '# if the new version cannot start, the old one comes back', delay: 260 },
]
