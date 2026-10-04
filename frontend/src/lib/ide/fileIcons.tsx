/**
 * What a file is, at a glance.
 *
 * The explorer and the tab strip used to draw the same generic page glyph for
 * everything, which is the one thing an editor's file list must not do: in a
 * tree of twenty files the icon is the fastest way to find the one you want.
 *
 * The colours are the app's own tokens rather than a palette of their own, so
 * the icons follow the theme the way everything else does — including the light
 * themes, where a hard-coded blue would sit on a pale surface perfectly and
 * still be the wrong blue.
 */
import React from 'react'
import {
  FileCode2, FileJson, FileText, FileImage, FileCode, FileTerminal, Palette, FileCog, Database,
} from 'lucide-react'

export interface FileKind {
  icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties; className?: string }>
  color: string
  /** Named so a test can assert the mapping without reaching into colours. */
  kind: 'code' | 'data' | 'text' | 'style' | 'markup' | 'image' | 'shell' | 'config' | 'database'
}

const KIND: Record<string, FileKind> = {
  code: { icon: FileCode2, color: 'var(--ide-accent)', kind: 'code' },
  data: { icon: FileJson, color: 'var(--ide-warn)', kind: 'data' },
  text: { icon: FileText, color: 'var(--ide-dim)', kind: 'text' },
  style: { icon: Palette, color: 'var(--ide-cyan)', kind: 'style' },
  markup: { icon: FileCode, color: 'var(--ide-warn)', kind: 'markup' },
  image: { icon: FileImage, color: 'var(--ide-cyan)', kind: 'image' },
  shell: { icon: FileTerminal, color: 'var(--success)', kind: 'shell' },
  config: { icon: FileCog, color: 'var(--ide-faint)', kind: 'config' },
  database: { icon: Database, color: 'var(--ide-cyan)', kind: 'database' },
  plain: { icon: FileText, color: 'var(--ide-faint)', kind: 'text' },
}

type LanguageId = 'html' | 'css' | 'javascript' | 'typescript' | 'react' | 'cpp' | 'c' | 'csharp' | 'python' | 'go' | 'rust' | 'java' | 'ruby' | 'php' | 'swift' | 'kotlin' | 'vue' | 'svelte' | 'astro' | 'json' | 'yaml' | 'sql' | 'shell'

const LANGUAGE_BY_EXT: Record<string, LanguageId> = {
  html: 'html', htm: 'html',
  css: 'css', scss: 'css', less: 'css', sass: 'css',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', mts: 'typescript', cts: 'typescript',
  jsx: 'react', tsx: 'react',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hxx: 'cpp',
  c: 'c', h: 'c',
  cs: 'csharp', py: 'python', go: 'go', rs: 'rust', java: 'java', rb: 'ruby', php: 'php',
  swift: 'swift', kt: 'kotlin', kts: 'kotlin', vue: 'vue', svelte: 'svelte', astro: 'astro',
  json: 'json', jsonc: 'json', yaml: 'yaml', yml: 'yaml', sql: 'sql',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell', ps1: 'shell', cmd: 'shell',
}

const BY_EXT: Record<string, FileKind> = {
  ts: KIND.code, tsx: KIND.code, mts: KIND.code, cts: KIND.code, js: KIND.code, jsx: KIND.code, mjs: KIND.code, cjs: KIND.code,
  py: KIND.code, go: KIND.code, rs: KIND.code, java: KIND.code, rb: KIND.code, php: KIND.code,
  c: KIND.code, h: KIND.code, cpp: KIND.code, cc: KIND.code, cxx: KIND.code, hpp: KIND.code, hxx: KIND.code,
  cs: KIND.code, swift: KIND.code, kt: KIND.code, kts: KIND.code, vue: KIND.code, svelte: KIND.code, astro: KIND.code,
  json: KIND.data, jsonc: KIND.data, yaml: KIND.data, yml: KIND.data, toml: KIND.data,
  csv: KIND.data, xml: KIND.data,
  md: KIND.text, mdx: KIND.text, txt: KIND.text, rst: KIND.text, log: KIND.text,
  css: KIND.style, scss: KIND.style, less: KIND.style, sass: KIND.style,
  html: KIND.markup, htm: KIND.markup, svg: KIND.markup,
  png: KIND.image, jpg: KIND.image, jpeg: KIND.image, gif: KIND.image, webp: KIND.image,
  avif: KIND.image, ico: KIND.image, bmp: KIND.image,
  sh: KIND.shell, bash: KIND.shell, zsh: KIND.shell, fish: KIND.shell, ps1: KIND.shell, cmd: KIND.shell,
  env: KIND.config, lock: KIND.config, gitignore: KIND.config, dockerignore: KIND.config,
  editorconfig: KIND.config, prettierrc: KIND.config, eslintrc: KIND.config,
  sql: KIND.database, db: KIND.database, sqlite: KIND.database,
}

/** `.gitignore`, `.env.local`, `vite.config.ts` — the name matters more than the tail. */
export function fileKind(path: string): FileKind {
  const name = (path.split('/').pop() ?? '').toLowerCase()
  if (/^\.(gitignore|dockerignore|npmrc|editorconfig|prettierrc|eslintrc|env.*)$/.test(name)) return KIND.config
  const ext = name.includes('.') ? name.split('.').pop() ?? '' : ''
  if (BY_EXT[ext]) return BY_EXT[ext]
  if (!ext) return KIND.plain
  return KIND.plain
}

const LANGUAGE_MARK: Record<LanguageId, { label: string; title: string; background: string; foreground: string }> = {
  html: { label: '5', title: 'HTML', background: '#e34f26', foreground: '#fff' },
  css: { label: '3', title: 'CSS', background: '#1572b6', foreground: '#fff' },
  javascript: { label: 'JS', title: 'JavaScript', background: '#f7df1e', foreground: '#222' },
  typescript: { label: 'TS', title: 'TypeScript', background: '#3178c6', foreground: '#fff' },
  react: { label: '⚛', title: 'React', background: '#20232a', foreground: '#61dafb' },
  cpp: { label: 'C++', title: 'C++', background: '#00599c', foreground: '#fff' },
  c: { label: 'C', title: 'C', background: '#a8b9cc', foreground: '#18212b' },
  csharp: { label: 'C#', title: 'C sharp', background: '#512bd4', foreground: '#fff' },
  python: { label: 'Py', title: 'Python', background: '#3776ab', foreground: '#ffd43b' },
  go: { label: 'Go', title: 'Go', background: '#00add8', foreground: '#fff' },
  rust: { label: 'Rs', title: 'Rust', background: '#dea584', foreground: '#222' },
  java: { label: 'J', title: 'Java', background: '#ed8b00', foreground: '#fff' },
  ruby: { label: 'Rb', title: 'Ruby', background: '#cc342d', foreground: '#fff' },
  php: { label: 'PHP', title: 'PHP', background: '#777bb4', foreground: '#fff' },
  swift: { label: 'S', title: 'Swift', background: '#f05138', foreground: '#fff' },
  kotlin: { label: 'K', title: 'Kotlin', background: '#7f52ff', foreground: '#fff' },
  vue: { label: 'V', title: 'Vue', background: '#34495e', foreground: '#41b883' },
  svelte: { label: 'S', title: 'Svelte', background: '#ff3e00', foreground: '#fff' },
  astro: { label: 'A', title: 'Astro', background: '#ff5d01', foreground: '#fff' },
  json: { label: '{}', title: 'JSON', background: '#292929', foreground: '#fbc02d' },
  yaml: { label: 'Y', title: 'YAML', background: '#cb171e', foreground: '#fff' },
  sql: { label: 'SQL', title: 'SQL', background: '#4479a1', foreground: '#fff' },
  shell: { label: '>_', title: 'Shell', background: '#4eaa25', foreground: '#fff' },
}

/** Locally bundled language marks: no logo API call, network dependency, or cache warm-up. */
export function LanguageMark({ language, size = 13, className }: { language: LanguageId; size?: number; className?: string }) {
  const mark = LANGUAGE_MARK[language]
  const textSize = mark.label.length > 2 ? 7.2 : mark.label.length === 2 ? 9 : 12
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}
      role="img" aria-label={`${mark.title} file`} data-language={language}>
      <title>{mark.title}</title>
      {language === 'html' || language === 'css' ? (
        <>
          <path d="M4 2h16l-1.5 17L12 22l-6.5-3L4 2Z" fill={mark.background} />
          <text x="12" y="16.8" textAnchor="middle" fontSize="13" fontWeight="800" fill={mark.foreground}>{mark.label}</text>
        </>
      ) : language === 'react' ? (
        <>
          <circle cx="12" cy="12" r="2.1" fill={mark.foreground} />
          <g fill="none" stroke={mark.foreground} strokeWidth="1.25">
            <ellipse cx="12" cy="12" rx="10" ry="4.1" />
            <ellipse cx="12" cy="12" rx="10" ry="4.1" transform="rotate(60 12 12)" />
            <ellipse cx="12" cy="12" rx="10" ry="4.1" transform="rotate(120 12 12)" />
          </g>
        </>
      ) : language === 'python' ? (
        <>
          <path d="M12 2.5c-5 0-5.2 2.2-5.2 4.3v2.6h7.8v1.5H5.8C3.2 10.9 2 12.5 2 16c0 3.2 1.7 5.5 5.1 5.5H10v-3.2c0-2.2 1.7-3.9 3.9-3.9h4.2c2.3 0 3.9-1.6 3.9-3.9V6.8c0-2.6-2.1-4.3-5.2-4.3H12Z" fill={mark.foreground} />
          <circle cx="9.2" cy="5.8" r=".8" fill={mark.background} />
          <circle cx="15.2" cy="18.2" r=".8" fill={mark.background} />
          <path d="M12 21.5c5 0 5.2-2.2 5.2-4.3v-2.6H9.4v-1.5h8.8c2.6 0 3.8-1.6 3.8-5.1" fill="none" stroke="#ffd43b" strokeWidth="1.4" />
        </>
      ) : language === 'vue' ? (
        <path d="m2 4h5l5 8 5-8h5L12 21 2 4Zm7 0h3l-2 3-1-3Z" fill={mark.foreground} />
      ) : language === 'rust' ? (
        <>
          <path d="m12 2.5 8.2 4.7v9.5L12 21.5l-8.2-4.8V7.2L12 2.5Z" fill="none" stroke={mark.foreground} strokeWidth="2" />
          <circle cx="12" cy="12" r="2.3" fill={mark.foreground} />
        </>
      ) : language === 'go' ? (
        <>
          <rect x="1" y="4" width="22" height="16" rx="8" fill={mark.background} />
          <text x="12" y="15.5" textAnchor="middle" fontSize="11" fontWeight="800" fontStyle="italic" fill={mark.foreground}>Go</text>
        </>
      ) : (
        <>
          <rect x="1" y="1" width="22" height="22" rx="5" fill={mark.background} />
          <text x="12" y="15.8" textAnchor="middle" fontSize={textSize} fontWeight="800" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill={mark.foreground}>{mark.label}</text>
        </>
      )}
    </svg>
  )
}

export function languageForPath(path: string): LanguageId | undefined {
  const name = (path.split('/').pop() ?? '').toLowerCase()
  const ext = name.includes('.') ? name.split('.').pop() ?? '' : ''
  return LANGUAGE_BY_EXT[ext]
}

/** The glyph itself, in the colour of its kind or the bundled language mark. */
export function FileGlyph({ path, size = 11, className }: { path: string; size?: number; className?: string }) {
  const language = languageForPath(path)
  if (language) return <LanguageMark language={language} size={size + 2} className={className} />
  const kind = fileKind(path)
  const Icon = kind.icon
  return <Icon size={size} className={className} style={{ color: kind.color, opacity: 0.95 }} />
}
