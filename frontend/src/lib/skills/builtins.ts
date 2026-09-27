import type { Skill } from '@/types'

export const builtinSkills: Skill[] = [
  {
    id: 'sk-summarize-url', name: 'Summarize URL', builtin: true, category: 'Research', icon: 'link',
    description: 'Fetch and summarize the key points of any URL.',
    promptTemplate: 'Summarize the content at {{url}} in {{length}} bullet points, leading with the single most important takeaway.',
    params: [
      { name: 'url', type: 'string', description: 'The URL to summarize' },
      { name: 'length', type: 'number', description: 'Number of bullets', default: '5' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-extract-citations', name: 'Extract citations', builtin: true, category: 'Research', icon: 'quote',
    description: 'Pull every citation-worthy claim from a passage.',
    promptTemplate: 'Extract all citation-worthy claims from this text. For each, give the claim, its strength, and what would verify it:\n\n{{text}}',
    params: [{ name: 'text', type: 'string', description: 'Paste the passage' }],
    outputFormat: 'json',
  },
  {
    id: 'sk-compare-sources', name: 'Compare two sources', builtin: true, category: 'Research', icon: 'scale',
    description: 'Structured comparison of two sources on one topic.',
    promptTemplate: 'Compare these two sources on "{{topic}}". Cover: agreement, disagreement, methodology quality, and which is more reliable.\n\nSource A: {{sourceA}}\n\nSource B: {{sourceB}}',
    params: [
      { name: 'topic', type: 'string' },
      { name: 'sourceA', type: 'string' },
      { name: 'sourceB', type: 'string' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-translate-technical', name: 'Translate technical passage', builtin: true, category: 'Writing', icon: 'languages',
    description: 'Translate dense technical writing into clear prose.',
    promptTemplate: 'Translate this technical passage into {{audience}}-level language. Preserve every factual claim; flag any jargon you must keep.\n\n{{passage}}',
    params: [
      { name: 'passage', type: 'string' },
      { name: 'audience', type: 'enum', options: ['general audience', 'undergraduate', 'executive', 'expert in another field'], default: 'general audience' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-quiz-from-notes', name: 'Generate quiz from notes', builtin: true, category: 'Study', icon: 'help-circle',
    description: 'Turn any notes into a quiz.',
    promptTemplate: 'Create a {{count}}-question quiz from these notes. Mix multiple choice and true/false. Include an explanation per answer.\n\n{{notes}}',
    params: [
      { name: 'notes', type: 'string' },
      { name: 'count', type: 'number', default: '8' },
    ],
    outputFormat: 'json',
  },
  {
    id: 'sk-lit-review', name: 'Write literature review section', builtin: true, category: 'Writing', icon: 'book-open',
    description: 'Draft a literature review section from sources.',
    promptTemplate: 'Write a literature review section on "{{topic}}" synthesizing these sources into themes, not a list. Academic tone, ~{{words}} words.\n\n{{sources}}',
    params: [
      { name: 'topic', type: 'string' },
      { name: 'sources', type: 'string', description: 'Paste abstracts or notes' },
      { name: 'words', type: 'number', default: '400' },
    ],
    outputFormat: 'natural',
  },
  {
    id: 'sk-equation-to-code', name: 'Convert equation to code', builtin: true, category: 'Code', icon: 'sigma',
    description: 'Turn a mathematical expression into working code.',
    promptTemplate: 'Convert this equation into idiomatic {{language}} with a short test case:\n\n{{equation}}',
    params: [
      { name: 'equation', type: 'string' },
      { name: 'language', type: 'enum', options: ['Python', 'TypeScript', 'Rust', 'Julia'], default: 'Python' },
    ],
    outputFormat: 'natural',
  },
]

export const SKILL_CATEGORIES = ['Research', 'Writing', 'Study', 'Code', 'Analysis', 'Custom']
export const SKILL_ICONS = ['wand', 'link', 'quote', 'scale', 'languages', 'help-circle', 'book-open', 'sigma', 'flask', 'sparkles', 'zap', 'target']
