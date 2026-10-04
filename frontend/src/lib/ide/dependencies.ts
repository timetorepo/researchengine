export type DependencyEcosystem = 'node' | 'python' | 'rust' | 'go' | 'unknown'
export type DependencyManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'uv' | 'poetry' | 'pipenv' | 'cargo' | 'go' | 'unknown'

export interface ProjectDependency {
  name: string
  version: string
  kind: 'runtime' | 'development' | 'peer' | 'optional' | 'installed'
  installed: boolean
  installedVersion?: string
}

export interface ProjectDependencyReport {
  ecosystem: DependencyEcosystem
  manager: DependencyManager
  dependencies: ProjectDependency[]
  manifest: string | null
  error?: string
}

export interface DependencySuggestion {
  name: string
  group: string
  description: string
  dev?: boolean
}

const suggestions: Record<Exclude<DependencyEcosystem, 'unknown'>, DependencySuggestion[]> = {
  node: [
    { name: 'openai', group: 'AI integrations', description: 'Official OpenAI SDK for applications that call OpenAI models.' },
    { name: '@anthropic-ai/sdk', group: 'AI integrations', description: 'Official Anthropic SDK for Claude API integrations.' },
    { name: 'ai', group: 'AI integrations', description: 'Vercel AI SDK for streaming and multi-provider AI features.' },
    { name: 'zod', group: 'Data validation', description: 'Validate model output, tool arguments and external data at runtime.' },
    { name: 'typescript', group: 'Feedback loop', description: 'Catch type errors while an AI-generated change is still small.', dev: true },
    { name: 'vitest', group: 'Feedback loop', description: 'Fast unit and component tests for the project.', dev: true },
    { name: '@playwright/test', group: 'Feedback loop', description: 'Browser-level tests for real user flows and responsive layouts.', dev: true },
    { name: 'eslint', group: 'Feedback loop', description: 'Static checks for common mistakes and project conventions.', dev: true },
    { name: 'prettier', group: 'Feedback loop', description: 'Consistent formatting for generated and hand-written code.', dev: true },
  ],
  python: [
    { name: 'openai', group: 'AI integrations', description: 'Official OpenAI Python SDK.' },
    { name: 'anthropic', group: 'AI integrations', description: 'Official Anthropic Python SDK.' },
    { name: 'pydantic', group: 'Data validation', description: 'Typed models for validating tool inputs and model output.' },
    { name: 'httpx', group: 'Application basics', description: 'HTTP client for APIs and async application code.' },
    { name: 'pytest', group: 'Feedback loop', description: 'Focused tests that catch regressions after code changes.', dev: true },
    { name: 'ruff', group: 'Feedback loop', description: 'Fast linting and formatting checks.', dev: true },
  ],
  rust: [
    { name: 'serde', group: 'Application basics', description: 'Serialization and deserialization for data and API payloads.' },
    { name: 'tokio', group: 'Application basics', description: 'Async runtime for networked and concurrent applications.' },
    { name: 'anyhow', group: 'Application basics', description: 'Practical error handling for application code.' },
    { name: 'tracing', group: 'Feedback loop', description: 'Structured diagnostics for debugging and observability.' },
    { name: 'reqwest', group: 'AI integrations', description: 'HTTP client for model and service APIs.' },
  ],
  go: [
    { name: 'github.com/joho/godotenv', group: 'Application basics', description: 'Load local environment variables during development.' },
    { name: 'github.com/rs/zerolog', group: 'Feedback loop', description: 'Structured logging for API and background tasks.' },
    { name: 'github.com/stretchr/testify', group: 'Feedback loop', description: 'Assertions and helpers for Go tests.', dev: true },
  ],
}

export function dependencySuggestions(ecosystem: DependencyEcosystem): DependencySuggestion[] {
  return ecosystem === 'unknown' ? [] : suggestions[ecosystem]
}

export function dependencyInstallCommand(manager: DependencyManager, name: string, dev = false): string | null {
  const pkg = name.trim()
  if (!pkg || /[\r\n;&|`$]/.test(pkg)) return null
  switch (manager) {
    case 'npm': return `npm install${dev ? ' --save-dev' : ''} ${pkg}`
    case 'pnpm': return `pnpm add${dev ? ' --save-dev' : ''} ${pkg}`
    case 'yarn': return `yarn add${dev ? ' --dev' : ''} ${pkg}`
    case 'bun': return `bun add${dev ? ' --dev' : ''} ${pkg}`
    case 'uv': return `uv add${dev ? ' --dev' : ''} ${pkg}`
    case 'poetry': return `poetry add${dev ? ' --group dev' : ''} ${pkg}`
    case 'pipenv': return `pipenv install${dev ? ' --dev' : ''} ${pkg}`
    case 'pip': return `python -m pip install ${pkg}`
    case 'cargo': return `cargo add${dev ? ' --dev' : ''} ${pkg}`
    case 'go': return `go get ${pkg}`
    default: return null
  }
}

export function installedState(dep: ProjectDependency | undefined): 'installed' | 'declared' | 'missing' {
  if (!dep) return 'missing'
  return dep.installed ? 'installed' : 'declared'
}
