import { nanoid } from 'nanoid'
import type { McpServerConfig } from '@/types'

export interface McpListing {
  id: string
  name: string
  category: 'Project files' | 'Browser testing' | 'Web and search' | 'Git hosting' | 'Knowledge'
  description: string
  command: string
  args: string[]
  envKeys: { name: string; label: string }[]
  docs: string
  projectScoped?: boolean
}

/** A small bundled directory: searchable offline and explicit about each command. */
export const MCP_LISTINGS: McpListing[] = [
  {
    id: 'filesystem', name: 'Filesystem', category: 'Project files',
    description: 'Give MCP clients scoped read and write tools for the open project folder.',
    command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '{project}'],
    envKeys: [], docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem', projectScoped: true,
  },
  {
    id: 'playwright', name: 'Playwright', category: 'Browser testing',
    description: 'Let the assistant inspect pages, navigate flows, click controls and capture browser evidence.',
    command: 'npx', args: ['-y', '@playwright/mcp@latest'],
    envKeys: [], docs: 'https://github.com/microsoft/playwright-mcp',
  },
  {
    id: 'fetch', name: 'Fetch', category: 'Web and search',
    description: 'Fetch and convert public web pages to text that an MCP client can read.',
    command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'],
    envKeys: [], docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
  },
  {
    id: 'brave-search', name: 'Brave Search', category: 'Web and search',
    description: 'Add web search tools using a Brave Search API key.',
    command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'],
    envKeys: [{ name: 'BRAVE_API_KEY', label: 'Brave Search API key' }],
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
  },
  {
    id: 'github', name: 'GitHub', category: 'Git hosting',
    description: 'Search repositories and work with issues, pull requests and repository content.',
    command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'],
    envKeys: [{ name: 'GITHUB_PERSONAL_ACCESS_TOKEN', label: 'GitHub personal access token' }],
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
  },
  {
    id: 'memory', name: 'Memory', category: 'Knowledge',
    description: 'Provide an assistant with a local knowledge graph for durable notes and entity relationships.',
    command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'],
    envKeys: [], docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
  },
]

export function mcpConfigFromListing(listing: McpListing, id = nanoid(8)): McpServerConfig {
  const env = Object.fromEntries(listing.envKeys.map((entry) => [entry.name, '']))
  return {
    id,
    catalogId: listing.id,
    name: listing.name,
    command: listing.command,
    args: [...listing.args],
    env: Object.keys(env).length ? env : undefined,
    // Adding a listing only stores it. The explicit Connect action starts it
    // and enables it for assistant calls only after it responds successfully.
    enabled: false,
    approved: false,
  }
}
