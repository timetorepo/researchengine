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

const BY_EXT: Record<string, FileKind> = {
  ts: KIND.code, tsx: KIND.code, js: KIND.code, jsx: KIND.code, mjs: KIND.code, cjs: KIND.code,
  py: KIND.code, go: KIND.code, rs: KIND.code, java: KIND.code, rb: KIND.code, php: KIND.code,
  c: KIND.code, h: KIND.code, cpp: KIND.code, cs: KIND.code, swift: KIND.code, kt: KIND.code,
  vue: KIND.code, svelte: KIND.code,
  json: KIND.data, jsonc: KIND.data, yaml: KIND.data, yml: KIND.data, toml: KIND.data,
  csv: KIND.data, xml: KIND.data,
  md: KIND.text, mdx: KIND.text, txt: KIND.text, rst: KIND.text, log: KIND.text,
  css: KIND.style, scss: KIND.style, less: KIND.style, sass: KIND.style,
  html: KIND.markup, htm: KIND.markup, svg: KIND.markup, astro: KIND.markup,
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

/** The glyph itself, in the colour of its kind. */
export function FileGlyph({ path, size = 11, className }: { path: string; size?: number; className?: string }) {
  const kind = fileKind(path)
  const Icon = kind.icon
  return <Icon size={size} className={className} style={{ color: kind.color, opacity: 0.95 }} />
}
