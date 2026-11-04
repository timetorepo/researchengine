// The node library: every node type, its kind, icon, config schema and
// sensible defaults. Icons are Lucide; gradients follow node kind.
import type { LucideIcon } from 'lucide-react'
import {
  MousePointerClick, CalendarClock, Webhook, FolderSearch, NotebookPen, PlugZap,
  MessageSquareText, Globe, Telescope, ScanSearch, Tags, AlignLeft, Languages, RefreshCcw,
  Wand2, CloudDownload, Mail, Github, StickyNote, FolderOpen, Save,
  GitFork, Shuffle, Repeat, Filter, Merge, Hourglass, Gauge,
  Map, Sigma, ArrowDownUp, Braces, FileCode2, Regex,
  NotebookText, FileText, LayoutGrid, BellRing, Download, CornerDownLeft,
} from 'lucide-react'
import type { NodeKind } from './types'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'toggle'
  placeholder?: string
  options?: { value: string; label: string }[]
  help?: string
  vars?: boolean // supports {{variable}} injection
}

export interface NodeDef {
  type: string
  kind: NodeKind
  name: string
  icon: LucideIcon
  desc: string
  gradient?: boolean // vibrant gradient icon block (AI operations)
  handles?: { id: string; label: string }[] // extra output handles
  fields: FieldDef[]
  defaults: Record<string, any>
}

export const KIND_COLOR: Record<NodeKind, string> = {
  trigger: '#A78BFA',
  ai: '#6C8EEF',
  skill: '#2DD4BF',
  integration: '#F59E0B',
  logic: '#94A3B8',
  transform: '#34D399',
  output: '#F472B6',
}

export const KIND_LABEL: Record<NodeKind, string> = {
  trigger: 'Trigger', ai: 'AI', skill: 'Skill', integration: 'Integration',
  logic: 'Logic', transform: 'Transform', output: 'Output',
}

const t = (key: string, label: string, placeholder?: string, vars = true): FieldDef =>
  ({ key, label, type: 'text', placeholder, vars })
const ta = (key: string, label: string, placeholder?: string, help?: string): FieldDef =>
  ({ key, label, type: 'textarea', placeholder, help, vars: true })

export const NODE_LIBRARY: NodeDef[] = [
  /* ------------------------------- triggers ------------------------------- */
  { type: 'manual', kind: 'trigger', name: 'Manual', icon: MousePointerClick, desc: 'Runs when you press Play.', fields: [], defaults: {} },
  { type: 'scheduled', kind: 'trigger', name: 'Scheduled', icon: CalendarClock, desc: 'Fires on a schedule (checked while the app is open).',
    fields: [t('cron', 'Schedule hint', 'Every day at 08:00', false)], defaults: { cron: 'Every day at 08:00' } },
  { type: 'webhook', kind: 'trigger', name: 'Webhook', icon: Webhook, desc: 'Fires from an external POST (self-hosted instances).',
    fields: [t('path', 'Path', '/hooks/digest', false)], defaults: { path: '/hooks/digest' } },
  { type: 'fileWatcher', kind: 'trigger', name: 'File watcher', icon: FolderSearch, desc: 'Fires when a watched folder changes.',
    fields: [t('path', 'Folder', '~/Documents/inbox', false)], defaults: { path: '~/Documents/inbox' } },
  { type: 'notebookUpdate', kind: 'trigger', name: 'Notebook update', icon: NotebookPen, desc: 'Fires when a notebook card is added.', fields: [], defaults: {} },
  { type: 'integrationEvent', kind: 'trigger', name: 'Integration event', icon: PlugZap, desc: 'Fires on events from a connected integration.',
    fields: [t('event', 'Event name', 'gmail.new', false)], defaults: { event: 'gmail.new' } },

  /* ---------------------------------- AI ---------------------------------- */
  { type: 'chat', kind: 'ai', name: 'Chat', icon: MessageSquareText, gradient: true, desc: 'Generate text from a prompt.',
    fields: [ta('prompt', 'Prompt', 'Summarize {{input}}', 'Supports {{input}} and {{node label}} variables.'), t('model', 'Model override', 'optional · provider:model', false)],
    defaults: { prompt: '' } },
  { type: 'groundedChat', kind: 'ai', name: 'Grounded chat', icon: Globe, gradient: true, desc: 'Search the web, then answer with citations.',
    fields: [ta('prompt', 'Question', 'Latest findings on {{input}}')], defaults: { prompt: '' } },
  { type: 'webSearch', kind: 'ai', name: 'Web search', icon: Globe, gradient: true, desc: 'Search and return ranked sources.',
    fields: [t('query', 'Query', '{{input}}')], defaults: { query: '{{input}}' } },
  { type: 'deepDive', kind: 'ai', name: 'Deep dive', icon: Telescope, gradient: true, desc: 'Two research passes with a follow-up query.',
    fields: [ta('topic', 'Topic', '{{input}}')], defaults: { topic: '' } },
  { type: 'extract', kind: 'ai', name: 'Extract', icon: ScanSearch, gradient: true, desc: 'Pull structured facts from text.',
    fields: [ta('text', 'Source text', '{{input}}'), t('schema', 'Fields to extract', 'name, date, claim')], defaults: { text: '{{input}}', schema: 'name, date, claim' } },
  { type: 'classify', kind: 'ai', name: 'Classify', icon: Tags, gradient: true, desc: 'Assign one of your labels.',
    fields: [ta('text', 'Text', '{{input}}'), t('labels', 'Labels', 'urgent, normal, noise', false)], defaults: { text: '{{input}}', labels: 'urgent, normal, noise' } },
  { type: 'summarize', kind: 'ai', name: 'Summarize', icon: AlignLeft, gradient: true, desc: 'Condense text.',
    fields: [ta('text', 'Text', '{{input}}'), t('style', 'Style', 'concise', false)], defaults: { text: '{{input}}', style: 'concise' } },
  { type: 'translate', kind: 'ai', name: 'Translate', icon: Languages, gradient: true, desc: 'Translate text.',
    fields: [ta('text', 'Text', '{{input}}'), t('target', 'Target language', 'English', false)], defaults: { text: '{{input}}', target: 'English' } },
  { type: 'rewrite', kind: 'ai', name: 'Rewrite', icon: RefreshCcw, gradient: true, desc: 'Rewrite in a tone of your choice.',
    fields: [ta('text', 'Text', '{{input}}'), t('tone', 'Tone', 'clear and direct', false)], defaults: { text: '{{input}}', tone: 'clear and direct' } },

  /* --------------------------------- skills ------------------------------- */
  { type: 'skill', kind: 'skill', name: 'Run skill', icon: Wand2, desc: 'Run any skill from your library.',
    fields: [{ key: 'skillId', label: 'Skill', type: 'select', options: [] }, ta('input', 'Input', '{{input}}')], defaults: { skillId: '', input: '{{input}}' } },

  /* ------------------------------ integrations ---------------------------- */
  { type: 'drive', kind: 'integration', name: 'Google Drive', icon: CloudDownload, desc: 'Read a file from Drive (requires connection).',
    fields: [t('fileId', 'File ID', '', false)], defaults: { fileId: '' } },
  { type: 'gmail', kind: 'integration', name: 'Gmail', icon: Mail, desc: 'Fetch recent messages (requires connection).',
    fields: [t('label', 'Label', 'inbox', false), { key: 'max', label: 'Max messages', type: 'number' }], defaults: { label: 'inbox', max: 5 } },
  { type: 'github', kind: 'integration', name: 'GitHub', icon: Github, desc: 'Fetch issues or PRs (requires connection).',
    fields: [t('repo', 'Repository', 'owner/repo', false)], defaults: { repo: '' } },
  { type: 'notion', kind: 'integration', name: 'Notion', icon: StickyNote, desc: 'Read a page (requires connection).',
    fields: [t('pageId', 'Page ID', '', false)], defaults: { pageId: '' } },
  { type: 'fsRead', kind: 'integration', name: 'Filesystem · read', icon: FolderOpen, desc: 'Read a file from the Research Engine files folder.',
    fields: [t('path', 'File', 'notes/input.txt', false)], defaults: { path: '' } },
  { type: 'fsWrite', kind: 'integration', name: 'Filesystem · write', icon: Save, desc: 'Write a file to the Research Engine files folder.',
    fields: [t('path', 'File', 'notes/output.txt', false), ta('content', 'Content', '{{input}}')], defaults: { path: '', content: '{{input}}' } },

  /* --------------------------------- logic -------------------------------- */
  { type: 'ifElse', kind: 'logic', name: 'If / Else', icon: GitFork, desc: 'Branch on a condition.',
    handles: [{ id: 'true', label: 'True' }, { id: 'false', label: 'False' }],
    fields: [t('value', 'Value', '{{input}}'), { key: 'op', label: 'Operator', type: 'select', options: [
      { value: 'contains', label: 'contains' }, { value: 'notContains', label: 'does not contain' },
      { value: 'equals', label: 'equals' }, { value: 'gt', label: 'length >' }, { value: 'lt', label: 'length <' },
      { value: 'truthy', label: 'is truthy' },
    ] }, t('compare', 'Compare with', 'text or number')], defaults: { value: '{{input}}', op: 'contains', compare: '' } },
  { type: 'switch', kind: 'logic', name: 'Switch', icon: Shuffle, desc: 'Route by matching value.',
    handles: [{ id: 'case:0', label: 'Case 1' }, { id: 'case:1', label: 'Case 2' }, { id: 'default', label: 'Default' }],
    fields: [t('value', 'Value', '{{input}}'), t('cases', 'Cases (comma list)', 'urgent, normal')], defaults: { value: '{{input}}', cases: 'urgent, normal' } },
  { type: 'loop', kind: 'logic', name: 'Loop', icon: Repeat, desc: 'Emit each item of a list downstream.',
    fields: [t('list', 'List value', '{{input}}'), { key: 'max', label: 'Max items', type: 'number' }], defaults: { list: '{{input}}', max: 10 } },
  { type: 'filter', kind: 'logic', name: 'Filter', icon: Filter, desc: 'Keep list items containing a term.',
    fields: [t('list', 'List value', '{{input}}'), t('contains', 'Keep if contains', '')], defaults: { list: '{{input}}', contains: '' } },
  { type: 'merge', kind: 'logic', name: 'Merge', icon: Merge, desc: 'Combine branch outputs.', fields: [], defaults: {} },
  { type: 'delay', kind: 'logic', name: 'Delay', icon: Hourglass, desc: 'Wait before continuing.',
    fields: [{ key: 'ms', label: 'Milliseconds', type: 'number' }], defaults: { ms: 1000 } },
  { type: 'rateLimit', kind: 'logic', name: 'Rate limit', icon: Gauge, desc: 'Skip if the last run was too recent.',
    fields: [{ key: 'minGapMs', label: 'Minimum gap (ms)', type: 'number' }], defaults: { minGapMs: 60000 } },

  /* ------------------------------- transforms ----------------------------- */
  { type: 'map', kind: 'transform', name: 'Map', icon: Map, desc: 'Transform each list item with a template.',
    fields: [t('list', 'List value', '{{input}}'), ta('template', 'Item template', '- {{item}}')], defaults: { list: '{{input}}', template: '- {{item}}' } },
  { type: 'reduce', kind: 'transform', name: 'Reduce', icon: Sigma, desc: 'Join list items into one text.',
    fields: [t('list', 'List value', '{{input}}'), t('join', 'Join with', '\n', false)], defaults: { list: '{{input}}', join: '\n' } },
  { type: 'sort', kind: 'transform', name: 'Sort', icon: ArrowDownUp, desc: 'Sort a list of lines.',
    fields: [t('list', 'List value', '{{input}}'), { key: 'dir', label: 'Direction', type: 'select', options: [{ value: 'asc', label: 'A → Z' }, { value: 'desc', label: 'Z → A' }] }], defaults: { list: '{{input}}', dir: 'asc' } },
  { type: 'jsonParse', kind: 'transform', name: 'JSON parse', icon: Braces, desc: 'Parse JSON text into a value.',
    fields: [t('text', 'JSON text', '{{input}}')], defaults: { text: '{{input}}' } },
  { type: 'template', kind: 'transform', name: 'Template', icon: FileCode2, desc: 'Compose text from variables.',
    fields: [ta('template', 'Template', 'Digest for today:\n\n{{input}}')], defaults: { template: '' } },
  { type: 'regex', kind: 'transform', name: 'Regex', icon: Regex, desc: 'Extract matches from text.',
    fields: [t('text', 'Text', '{{input}}'), t('pattern', 'Pattern', '\\d+', false)], defaults: { text: '{{input}}', pattern: '\\d+' } },

  /* -------------------------------- outputs ------------------------------- */
  { type: 'toNotebook', kind: 'output', name: 'Save to notebook', icon: NotebookText, desc: 'File the result as a notebook card.',
    fields: [t('title', 'Title', 'Workflow finding'), t('source', 'Source label', 'workflow', false)], defaults: { title: 'Workflow finding', source: 'workflow' } },
  { type: 'toArticle', kind: 'output', name: 'Save as article', icon: FileText, desc: 'Create an article draft from the result.',
    fields: [t('title', 'Title', 'Draft from workflow')], defaults: { title: 'Draft from workflow' } },
  { type: 'toCanvas', kind: 'output', name: 'Send to canvas', icon: LayoutGrid, desc: 'Append to the Canvas notebook.',
    fields: [t('title', 'Entry title', 'Canvas entry')], defaults: { title: 'Canvas entry' } },
  { type: 'notify', kind: 'output', name: 'Notify', icon: BellRing, desc: 'Show a local notification.',
    fields: [t('title', 'Title', 'Workflow finished'), ta('body', 'Body', '{{input}}')], defaults: { title: 'Workflow finished', body: '{{input}}' } },
  { type: 'exportFile', kind: 'output', name: 'Export file', icon: Download, desc: 'Download the result as a file.',
    fields: [t('filename', 'Filename', 'result.txt', false)], defaults: { filename: 'result.txt' } },
  { type: 'return', kind: 'output', name: 'Return', icon: CornerDownLeft, desc: 'Mark the final result of the run.', fields: [], defaults: {} },
]

export const nodeDef = (type: string): NodeDef | undefined => NODE_LIBRARY.find((n) => n.type === type)
export const nodesByKind = (kind: NodeKind) => NODE_LIBRARY.filter((n) => n.kind === kind)
