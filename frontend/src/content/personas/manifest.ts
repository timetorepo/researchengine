/**
 * Persona manifest — every prompt file in the upstream archive
 * (asgeirtj/system_prompts_leaks), with the vendored flag marking the ones
 * whose full text ships in this repo. The rest are one sync away on a
 * connected machine.
 *
 * 836 prompts, 24 vendored (1561 KiB of text).
 */
export type PersonaEntry = { path: string; vendor: string; product: string; file: string; title: string; chars: number; vendored: boolean; slug: string }
export const PERSONAS_MANIFEST: PersonaEntry[] = [
 {
  "path": "Anthropic/README.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "README.md",
  "title": "Anthropic — which file is which product?",
  "chars": 1147,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/anthropic-interviewer.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "anthropic-interviewer.md",
  "title": "Interview Plan: Understanding People's Vision for AI's Role in their Life",
  "chars": 11709,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/anthropic_reminders.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "anthropic_reminders.md",
  "title": "Anthropic/anthropic_reminders",
  "chars": 10575,
  "vendored": true,
  "slug": "Anthropic-anthropic-reminders"
 },
 {
  "path": "Anthropic/claude-code/agents/Explore.md",
  "vendor": "Anthropic",
  "product": "claude-code/agents",
  "file": "Explore.md",
  "title": "Anthropic/claude-code/agents/Explore",
  "chars": 4432,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/agents/Plan.md",
  "vendor": "Anthropic",
  "product": "claude-code/agents",
  "file": "Plan.md",
  "title": "Anthropic/claude-code/agents/Plan",
  "chars": 3985,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/agents/claude-code-guide.md",
  "vendor": "Anthropic",
  "product": "claude-code/agents",
  "file": "claude-code-guide.md",
  "title": "Anthropic/claude-code/agents/claude-code-guide",
  "chars": 10511,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/agents/claude.md",
  "vendor": "Anthropic",
  "product": "claude-code/agents",
  "file": "claude.md",
  "title": "Anthropic/claude-code/agents/claude",
  "chars": 3162,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/agents/general-purpose.md",
  "vendor": "Anthropic",
  "product": "claude-code/agents",
  "file": "general-purpose.md",
  "title": "Anthropic/claude-code/agents/general-purpose",
  "chars": 3012,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/agents/statusline-setup.md",
  "vendor": "Anthropic",
  "product": "claude-code/agents",
  "file": "statusline-setup.md",
  "title": "Anthropic/claude-code/agents/statusline-setup",
  "chars": 13637,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-cloud-fable-5.1.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-cloud-fable-5.1.md",
  "title": "System prompt",
  "chars": 477906,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-desktop-fable-5.1.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-desktop-fable-5.1.md",
  "title": "System prompt",
  "chars": 552148,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-desktop-fable-5.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-desktop-fable-5.md",
  "title": "System prompt",
  "chars": 310706,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-docs-assistant.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-docs-assistant.md",
  "title": "Claude Code documentation assistant",
  "chars": 18511,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-fable-5.1.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-fable-5.1.md",
  "title": "System prompt",
  "chars": 401143,
  "vendored": true,
  "slug": "Anthropic-claude-code-claude-code-fable-5-1"
 },
 {
  "path": "Anthropic/claude-code/claude-code-fable-5.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-fable-5.md",
  "title": "System prompt",
  "chars": 399317,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-haiku-4.5.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-haiku-4.5.md",
  "title": "System prompt",
  "chars": 432883,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-haiku-5.5.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-haiku-5.5.md",
  "title": "System prompt",
  "chars": 392891,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-headless-fable-5.1.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-headless-fable-5.1.md",
  "title": "System prompt",
  "chars": 248336,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-opus-4.6.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-opus-4.6.md",
  "title": "System prompt",
  "chars": 440332,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-opus-4.7.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-opus-4.7.md",
  "title": "System prompt",
  "chars": 440077,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-opus-4.8.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-opus-4.8.md",
  "title": "System prompt",
  "chars": 394749,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-opus-5.5.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-opus-5.5.md",
  "title": "System prompt",
  "chars": 395164,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-opus-5.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-opus-5.md",
  "title": "System prompt",
  "chars": 398281,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-sonnet-4.6.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-sonnet-4.6.md",
  "title": "System prompt",
  "chars": 433879,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-sonnet-5.5.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-sonnet-5.5.md",
  "title": "System prompt",
  "chars": 394971,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/claude-code-sonnet-5.md",
  "vendor": "Anthropic",
  "product": "claude-code",
  "file": "claude-code-sonnet-5.md",
  "title": "System prompt",
  "chars": 435805,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/commands/btw.md",
  "vendor": "Anthropic",
  "product": "claude-code/commands",
  "file": "btw.md",
  "title": "Anthropic/claude-code/commands/btw",
  "chars": 1050,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/commands/compact.md",
  "vendor": "Anthropic",
  "product": "claude-code/commands",
  "file": "compact.md",
  "title": "Summary instructions",
  "chars": 6402,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/commands/rename.md",
  "vendor": "Anthropic",
  "product": "claude-code/commands",
  "file": "rename.md",
  "title": "Anthropic/claude-code/commands/rename",
  "chars": 1496,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/output-styles/concise.md",
  "vendor": "Anthropic",
  "product": "claude-code/output-styles",
  "file": "concise.md",
  "title": "Concise Style Active",
  "chars": 1609,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/output-styles/explanatory.md",
  "vendor": "Anthropic",
  "product": "claude-code/output-styles",
  "file": "explanatory.md",
  "title": "Explanatory Style Active",
  "chars": 1169,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/output-styles/learning.md",
  "vendor": "Anthropic",
  "product": "claude-code/output-styles",
  "file": "learning.md",
  "title": "Learning Style Active",
  "chars": 4470,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/output-styles/proactive.md",
  "vendor": "Anthropic",
  "product": "claude-code/output-styles",
  "file": "proactive.md",
  "title": "Proactive Style Active",
  "chars": 1578,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/prompts/advisor-tool.md",
  "vendor": "Anthropic",
  "product": "claude-code/prompts",
  "file": "advisor-tool.md",
  "title": "System prompt",
  "chars": 7839,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/prompts/plan-mode.md",
  "vendor": "Anthropic",
  "product": "claude-code/prompts",
  "file": "plan-mode.md",
  "title": "Anthropic/claude-code/prompts/plan-mode",
  "chars": 4905,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/prompts/prompt-suggestion.md",
  "vendor": "Anthropic",
  "product": "claude-code/prompts",
  "file": "prompt-suggestion.md",
  "title": "Anthropic/claude-code/prompts/prompt-suggestion",
  "chars": 1364,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/prompts/session-recap.md",
  "vendor": "Anthropic",
  "product": "claude-code/prompts",
  "file": "session-recap.md",
  "title": "Anthropic/claude-code/prompts/session-recap",
  "chars": 254,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/prompts/session-rename.md",
  "vendor": "Anthropic",
  "product": "claude-code/prompts",
  "file": "session-rename.md",
  "title": "Anthropic/claude-code/prompts/session-rename",
  "chars": 472,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/prompts/session-title.md",
  "vendor": "Anthropic",
  "product": "claude-code/prompts",
  "file": "session-title.md",
  "title": "Anthropic/claude-code/prompts/session-title",
  "chars": 3293,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/anthropic-skills/deep-research/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/anthropic-skills/deep-research",
  "file": "SKILL.md",
  "title": "Coordinating Deep Research",
  "chars": 13143,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/anthropic-skills/deep-research/references/report-writer.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/anthropic-skills/deep-research/references",
  "file": "report-writer.md",
  "title": "Writing a Research Report",
  "chars": 6166,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/anthropic-skills/deep-research/references/researcher.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/anthropic-skills/deep-research/references",
  "file": "researcher.md",
  "title": "Executing Research",
  "chars": 4216,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/anthropic-skills/schedule/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/anthropic-skills/schedule",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/anthropic-skills/schedule/SKILL",
  "chars": 2387,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/artifact-capabilities/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/artifact-capabilities",
  "file": "SKILL.md",
  "title": "Artifact runtime capabilities",
  "chars": 17361,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/artifact-design/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/artifact-design",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/artifact-design/SKILL",
  "chars": 19185,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/artifact-diagramming/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/artifact-diagramming",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/artifact-diagramming/SKILL",
  "chars": 3850,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/batch/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/batch",
  "file": "SKILL.md",
  "title": "Batch: Parallel Work Orchestration",
  "chars": 5312,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api",
  "file": "SKILL.md",
  "title": "Building LLM-Powered Applications with Claude",
  "chars": 103950,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/csharp/claude-api/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/csharp/claude-api",
  "file": "README.md",
  "title": "Claude API - C#",
  "chars": 18939,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/csharp/claude-api/batches.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/csharp/claude-api",
  "file": "batches.md",
  "title": "Message Batches - C#",
  "chars": 413,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/csharp/claude-api/files-api.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/csharp/claude-api",
  "file": "files-api.md",
  "title": "Files API - C#",
  "chars": 900,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/csharp/claude-api/streaming.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/csharp/claude-api",
  "file": "streaming.md",
  "title": "Streaming - C#",
  "chars": 787,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/csharp/claude-api/tool-use.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/csharp/claude-api",
  "file": "tool-use.md",
  "title": "Tool Use - C#",
  "chars": 6000,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/curl/examples.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/curl",
  "file": "examples.md",
  "title": "Claude API - cURL / Raw HTTP",
  "chars": 9721,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/curl/managed-agents.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/curl",
  "file": "managed-agents.md",
  "title": "Managed Agents - cURL / Raw HTTP",
  "chars": 10785,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/go/claude-api/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/go/claude-api",
  "file": "README.md",
  "title": "Claude API - Go",
  "chars": 8483,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/go/claude-api/files-api.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/go/claude-api",
  "file": "files-api.md",
  "title": "Files API - Go",
  "chars": 936,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/go/claude-api/streaming.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/go/claude-api",
  "file": "streaming.md",
  "title": "Streaming - Go",
  "chars": 1026,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/go/claude-api/tool-use.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/go/claude-api",
  "file": "tool-use.md",
  "title": "Tool Use - Go",
  "chars": 8392,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/go/managed-agents/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/go/managed-agents",
  "file": "README.md",
  "title": "Managed Agents - Go",
  "chars": 22458,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/java/claude-api/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/java/claude-api",
  "file": "README.md",
  "title": "Claude API - Java",
  "chars": 11952,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/java/claude-api/files-api.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/java/claude-api",
  "file": "files-api.md",
  "title": "Files API - Java",
  "chars": 1198,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/java/claude-api/streaming.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/java/claude-api",
  "file": "streaming.md",
  "title": "Streaming - Java",
  "chars": 655,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/java/claude-api/tool-use.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/java/claude-api",
  "file": "tool-use.md",
  "title": "Tool Use - Java",
  "chars": 9508,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/java/managed-agents/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/java/managed-agents",
  "file": "README.md",
  "title": "Managed Agents - Java",
  "chars": 20463,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/php/claude-api/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/php/claude-api",
  "file": "README.md",
  "title": "Claude API - PHP",
  "chars": 6560,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/php/claude-api/batches.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/php/claude-api",
  "file": "batches.md",
  "title": "Message Batches - PHP",
  "chars": 447,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/php/claude-api/files-api.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/php/claude-api",
  "file": "files-api.md",
  "title": "Files API - PHP",
  "chars": 476,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/php/claude-api/streaming.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/php/claude-api",
  "file": "streaming.md",
  "title": "Streaming - PHP",
  "chars": 682,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/php/claude-api/tool-use.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/php/claude-api",
  "file": "tool-use.md",
  "title": "Tool Use - PHP",
  "chars": 8095,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/php/managed-agents/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/php/managed-agents",
  "file": "README.md",
  "title": "Managed Agents - PHP",
  "chars": 16553,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/python/claude-api/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/python/claude-api",
  "file": "README.md",
  "title": "Claude API - Python",
  "chars": 20630,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/python/claude-api/batches.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/python/claude-api",
  "file": "batches.md",
  "title": "Message Batches API - Python",
  "chars": 5723,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/python/claude-api/files-api.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/python/claude-api",
  "file": "files-api.md",
  "title": "Files API - Python",
  "chars": 4499,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/python/claude-api/sdk-upgrade.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/python/claude-api",
  "file": "sdk-upgrade.md",
  "title": "Upgrading the `anthropic` Python SDK: 0.x -> 1.x",
  "chars": 28760,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/python/claude-api/streaming.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/python/claude-api",
  "file": "streaming.md",
  "title": "Streaming - Python",
  "chars": 11940,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/python/claude-api/tool-use.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/python/claude-api",
  "file": "tool-use.md",
  "title": "Tool Use - Python",
  "chars": 19785,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/python/managed-agents/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/python/managed-agents",
  "file": "README.md",
  "title": "Managed Agents - Python",
  "chars": 14234,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/ruby/claude-api/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/ruby/claude-api",
  "file": "README.md",
  "title": "Claude API - Ruby",
  "chars": 4849,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/ruby/claude-api/streaming.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/ruby/claude-api",
  "file": "streaming.md",
  "title": "Streaming - Ruby",
  "chars": 235,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/ruby/claude-api/tool-use.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/ruby/claude-api",
  "file": "tool-use.md",
  "title": "Tool Use - Ruby",
  "chars": 1062,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/ruby/managed-agents/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/ruby/managed-agents",
  "file": "README.md",
  "title": "Managed Agents - Ruby",
  "chars": 12199,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/admin-api.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "admin-api.md",
  "title": "Admin API (Organization Management)",
  "chars": 11606,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/agent-design.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "agent-design.md",
  "title": "Agent Design Patterns",
  "chars": 8732,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/anthropic-cli.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "anthropic-cli.md",
  "title": "Anthropic CLI (`ant`)",
  "chars": 23998,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/claude-platform-on-aws.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "claude-platform-on-aws.md",
  "title": "Claude Platform on AWS",
  "chars": 4420,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/cost-optimization.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "cost-optimization.md",
  "title": "Cost Optimization - Cutting Spend per Completed Task",
  "chars": 58056,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/error-codes.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "error-codes.md",
  "title": "HTTP Error Codes Reference",
  "chars": 20796,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/evals/build-eval.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/evals",
  "file": "build-eval.md",
  "title": "Building an Eval for a Claude-Powered Application",
  "chars": 55191,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/evals/cost-hillclimb.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/evals",
  "file": "cost-hillclimb.md",
  "title": "Cost-reduction search: how to structure it",
  "chars": 31686,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/evals/eval-audit.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/evals",
  "file": "eval-audit.md",
  "title": "Eval health checklist",
  "chars": 27885,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/evals/eval-hillclimb.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/evals",
  "file": "eval-hillclimb.md",
  "title": "Hill-Climbing on an Eval",
  "chars": 69180,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/evals/report/SCHEMA.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/evals/report",
  "file": "SCHEMA.md",
  "title": "Hillclimb state schema (v2)",
  "chars": 16131,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/live-sources.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "live-sources.md",
  "title": "Live Documentation Sources",
  "chars": 22999,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-api-reference.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-api-reference.md",
  "title": "Managed Agents - Endpoint Reference",
  "chars": 34669,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-client-patterns.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-client-patterns.md",
  "title": "Managed Agents - Common Client Patterns",
  "chars": 12092,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-core.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-core.md",
  "title": "Managed Agents - Core Concepts",
  "chars": 33499,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-environments.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-environments.md",
  "title": "Managed Agents - Environments & Resources",
  "chars": 13705,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-events.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-events.md",
  "title": "Managed Agents - Events & Steering",
  "chars": 25106,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-memory.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-memory.md",
  "title": "Managed Agents - Memory Stores",
  "chars": 11361,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-multiagent.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-multiagent.md",
  "title": "Managed Agents - Multiagent Sessions",
  "chars": 26906,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-onboarding-from-quickstart.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-onboarding-from-quickstart.md",
  "title": "Managed Agents - Onboarding From a Bundled Quickstart",
  "chars": 18395,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-onboarding-from-url.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-onboarding-from-url.md",
  "title": "Managed Agents - Onboarding From a URL",
  "chars": 25766,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-onboarding.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-onboarding.md",
  "title": "Managed Agents - Onboarding Flow",
  "chars": 15725,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-outcomes.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-outcomes.md",
  "title": "Managed Agents - Outcomes",
  "chars": 8151,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-overview.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-overview.md",
  "title": "Managed Agents - Overview",
  "chars": 13829,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-quickstarts/contract-tracker.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/managed-agents-quickstarts",
  "file": "contract-tracker.md",
  "title": "Contract tracker",
  "chars": 1806,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-quickstarts/data-analyst.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/managed-agents-quickstarts",
  "file": "data-analyst.md",
  "title": "Data analyst",
  "chars": 1561,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-quickstarts/deep-researcher.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/managed-agents-quickstarts",
  "file": "deep-researcher.md",
  "title": "Deep researcher",
  "chars": 2430,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-quickstarts/field-monitor.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/managed-agents-quickstarts",
  "file": "field-monitor.md",
  "title": "Field monitor",
  "chars": 2105,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-quickstarts/incident-commander.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/managed-agents-quickstarts",
  "file": "incident-commander.md",
  "title": "Incident commander",
  "chars": 1723,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-quickstarts/sprint-retro-facilitator.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/managed-agents-quickstarts",
  "file": "sprint-retro-facilitator.md",
  "title": "Sprint retro facilitator",
  "chars": 2091,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-quickstarts/structured-extractor.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/managed-agents-quickstarts",
  "file": "structured-extractor.md",
  "title": "Structured extractor",
  "chars": 1541,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-quickstarts/support-agent.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/managed-agents-quickstarts",
  "file": "support-agent.md",
  "title": "Support agent",
  "chars": 1481,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-quickstarts/support-to-eng-escalator.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/managed-agents-quickstarts",
  "file": "support-to-eng-escalator.md",
  "title": "Support-to-eng escalator",
  "chars": 1842,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-scheduled-deployments.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-scheduled-deployments.md",
  "title": "Managed Agents - Scheduled Deployments",
  "chars": 9289,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-self-hosted-sandboxes.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-self-hosted-sandboxes.md",
  "title": "Managed Agents - Self-Hosted Sandboxes",
  "chars": 27919,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-tools.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-tools.md",
  "title": "Managed Agents - Tools & Skills",
  "chars": 37101,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/managed-agents-webhooks.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "managed-agents-webhooks.md",
  "title": "Managed Agents - Webhooks",
  "chars": 11319,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/model-migration.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "model-migration.md",
  "title": "Model Migration Guide",
  "chars": 346342,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/models.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "models.md",
  "title": "Claude Model Catalog",
  "chars": 17502,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/platform-availability.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "platform-availability.md",
  "title": "Platform Availability",
  "chars": 7415,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/preserved-thinking-migration.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "preserved-thinking-migration.md",
  "title": "Preserved Thinking - Keeping Earlier Reasoning Valid Across a Conversation",
  "chars": 64049,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/preserved-thinking-migration/causes.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared/preserved-thinking-migration",
  "file": "causes.md",
  "title": "Preserved Thinking - Causes, Fixes, and the Keep List",
  "chars": 39705,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/prompt-audit.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "prompt-audit.md",
  "title": "Prompt Audit - Finding and Removing Dated Prompting Patterns",
  "chars": 49344,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/prompt-caching.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "prompt-caching.md",
  "title": "Prompt Caching - Design & Optimization",
  "chars": 33084,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/token-counting.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "token-counting.md",
  "title": "Token Counting",
  "chars": 1605,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/shared/tool-use-concepts.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/shared",
  "file": "tool-use-concepts.md",
  "title": "Tool Use Concepts",
  "chars": 44372,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/typescript/claude-api/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/typescript/claude-api",
  "file": "README.md",
  "title": "Claude API - TypeScript",
  "chars": 15841,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/typescript/claude-api/batches.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/typescript/claude-api",
  "file": "batches.md",
  "title": "Message Batches API - TypeScript",
  "chars": 2594,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/typescript/claude-api/files-api.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/typescript/claude-api",
  "file": "files-api.md",
  "title": "Files API - TypeScript",
  "chars": 2384,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/typescript/claude-api/streaming.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/typescript/claude-api",
  "file": "streaming.md",
  "title": "Streaming - TypeScript",
  "chars": 9513,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/typescript/claude-api/tool-use.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/typescript/claude-api",
  "file": "tool-use.md",
  "title": "Tool Use - TypeScript",
  "chars": 22669,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-api/typescript/managed-agents/README.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-api/typescript/managed-agents",
  "file": "README.md",
  "title": "Managed Agents - TypeScript",
  "chars": 13424,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/claude-in-chrome/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/claude-in-chrome",
  "file": "SKILL.md",
  "title": "Claude in Chrome browser automation",
  "chars": 4692,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/code-review/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/code-review",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/code-review/SKILL",
  "chars": 6536,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/code-review/high.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/code-review",
  "file": "high.md",
  "title": "Anthropic/claude-code/skills/code-review/high",
  "chars": 5616,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/code-review/low.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/code-review",
  "file": "low.md",
  "title": "Anthropic/claude-code/skills/code-review/low",
  "chars": 1251,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/code-review/max.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/code-review",
  "file": "max.md",
  "title": "Anthropic/claude-code/skills/code-review/max",
  "chars": 7648,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/code-review/medium.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/code-review",
  "file": "medium.md",
  "title": "Anthropic/claude-code/skills/code-review/medium",
  "chars": 1572,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/code-review/report-findings-tool.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/code-review",
  "file": "report-findings-tool.md",
  "title": "ReportFindings tool",
  "chars": 3027,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/code-review/xhigh.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/code-review",
  "file": "xhigh.md",
  "title": "Anthropic/claude-code/skills/code-review/xhigh",
  "chars": 7101,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/consolidate-memory/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/consolidate-memory",
  "file": "SKILL.md",
  "title": "Memory Consolidation",
  "chars": 1965,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/dataviz/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/dataviz",
  "file": "SKILL.md",
  "title": "Data Visualization",
  "chars": 8498,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/dataviz/references/anti-patterns.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/dataviz/references",
  "file": "anti-patterns.md",
  "title": "Anti-patterns - what goes wrong",
  "chars": 6149,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/dataviz/references/choosing-a-form.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/dataviz/references",
  "file": "choosing-a-form.md",
  "title": "Choosing a form",
  "chars": 3085,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/dataviz/references/color-formula.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/dataviz/references",
  "file": "color-formula.md",
  "title": "Color formula",
  "chars": 8150,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/dataviz/references/components.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/dataviz/references",
  "file": "components.md",
  "title": "Components - the pieces a chart is made of",
  "chars": 2098,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/dataviz/references/interaction.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/dataviz/references",
  "file": "interaction.md",
  "title": "Interaction - tooltips & filters",
  "chars": 3741,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/dataviz/references/marks-and-anatomy.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/dataviz/references",
  "file": "marks-and-anatomy.md",
  "title": "Marks & anatomy",
  "chars": 6031,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/dataviz/references/palette.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/dataviz/references",
  "file": "palette.md",
  "title": "Reference palette",
  "chars": 9020,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/debug/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/debug",
  "file": "SKILL.md",
  "title": "Debug Skill",
  "chars": 1753,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/deep-research/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/deep-research",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/deep-research/SKILL",
  "chars": 1557,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/design-sync/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/design-sync",
  "file": "SKILL.md",
  "title": "Sync a design system to claude.ai/design",
  "chars": 28275,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/design-sync/non-storybook/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/design-sync/non-storybook",
  "file": "SKILL.md",
  "title": "Package source shape",
  "chars": 59170,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/design-sync/storybook/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/design-sync/storybook",
  "file": "SKILL.md",
  "title": "Storybook source shape",
  "chars": 69158,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/design/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/design",
  "file": "SKILL.md",
  "title": "Create a design canvas",
  "chars": 56515,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/docs/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/docs",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/docs/SKILL",
  "chars": 1243,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/doctor/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/doctor",
  "file": "SKILL.md",
  "title": "Claude Code Doctor",
  "chars": 45810,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/docx/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/docx",
  "file": "SKILL.md",
  "title": "DOCX creation, editing, and analysis",
  "chars": 7596,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/explain-usage/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/explain-usage",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/explain-usage/SKILL",
  "chars": 1378,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/fewer-permission-prompts/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/fewer-permission-prompts",
  "file": "SKILL.md",
  "title": "Fewer Permission Prompts",
  "chars": 7740,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/google-workspace/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/google-workspace",
  "file": "SKILL.md",
  "title": "Google Docs, Sheets, and Slides",
  "chars": 14861,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/google-workspace/references/charts.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/google-workspace/references",
  "file": "charts.md",
  "title": "Charts",
  "chars": 15549,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/google-workspace/references/docs.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/google-workspace/references",
  "file": "docs.md",
  "title": "Google Docs reference",
  "chars": 40092,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/google-workspace/references/sheets.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/google-workspace/references",
  "file": "sheets.md",
  "title": "Google Sheets reference",
  "chars": 38565,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/google-workspace/references/slides.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/google-workspace/references",
  "file": "slides.md",
  "title": "Google Slides reference",
  "chars": 47177,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/import-memory/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/import-memory",
  "file": "SKILL.md",
  "title": "Importing memory from another assistant",
  "chars": 10615,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/init-new/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/init-new",
  "file": "SKILL.md",
  "title": "CLAUDE.md",
  "chars": 22037,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/init/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/init",
  "file": "SKILL.md",
  "title": "CLAUDE.md",
  "chars": 2406,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/keybindings-help/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/keybindings-help",
  "file": "SKILL.md",
  "title": "Keybindings Skill",
  "chars": 14420,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/loop/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/loop",
  "file": "SKILL.md",
  "title": "/loop — schedule a recurring or self-paced prompt",
  "chars": 8703,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/loop/autonomous-interval.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/loop",
  "file": "autonomous-interval.md",
  "title": "/loop — schedule the autonomous default",
  "chars": 6395,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/loop/autonomous.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/loop",
  "file": "autonomous.md",
  "title": "/loop — autonomous default with dynamic pacing",
  "chars": 8448,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/morning/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/morning",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/morning/SKILL",
  "chars": 17948,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/pdf/FORMS.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/pdf",
  "file": "FORMS.md",
  "title": "Fillable fields",
  "chars": 11854,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/pdf/REFERENCE.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/pdf",
  "file": "REFERENCE.md",
  "title": "PDF Processing Advanced Reference",
  "chars": 16692,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/pdf/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/pdf",
  "file": "SKILL.md",
  "title": "PDF Processing Guide",
  "chars": 8035,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/plugin-authoring/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/plugin-authoring",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/plugin-authoring/SKILL",
  "chars": 10081,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/plugin-authoring/reference.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/plugin-authoring",
  "file": "reference.md",
  "title": "Function hooks: the long form",
  "chars": 51016,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/pptx/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/pptx",
  "file": "SKILL.md",
  "title": "PPTX creation, editing, and analysis",
  "chars": 28424,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run-skill-generator/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run-skill-generator",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/run-skill-generator/SKILL",
  "chars": 16584,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run-skill-generator/examples/cli.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run-skill-generator/examples",
  "file": "cli.md",
  "title": "Example: CLI tool",
  "chars": 1542,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run-skill-generator/examples/electron.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run-skill-generator/examples",
  "file": "electron.md",
  "title": "Example: Electron / desktop GUI app",
  "chars": 14357,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run-skill-generator/examples/library.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run-skill-generator/examples",
  "file": "library.md",
  "title": "Example: Library / SDK",
  "chars": 2032,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run-skill-generator/examples/playwright.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run-skill-generator/examples",
  "file": "playwright.md",
  "title": "Example: Browser-driven web app",
  "chars": 3534,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run-skill-generator/examples/server.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run-skill-generator/examples",
  "file": "server.md",
  "title": "Example: Web server / API",
  "chars": 3316,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run-skill-generator/examples/tui.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run-skill-generator/examples",
  "file": "tui.md",
  "title": "Example: TUI / interactive terminal app",
  "chars": 3021,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run-skill-generator/template.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run-skill-generator",
  "file": "template.md",
  "title": "Example: Node 20 via nvm, Python 3.12 via uv, etc.",
  "chars": 4138,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/run/SKILL",
  "chars": 3591,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run/examples/cli.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run/examples",
  "file": "cli.md",
  "title": "Example: CLI tool",
  "chars": 1542,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run/examples/electron.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run/examples",
  "file": "electron.md",
  "title": "Example: Electron / desktop GUI app",
  "chars": 14357,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run/examples/library.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run/examples",
  "file": "library.md",
  "title": "Example: Library / SDK",
  "chars": 2032,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run/examples/playwright.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run/examples",
  "file": "playwright.md",
  "title": "Example: Browser-driven web app",
  "chars": 3534,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run/examples/server.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run/examples",
  "file": "server.md",
  "title": "Example: Web server / API",
  "chars": 3316,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/run/examples/tui.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/run/examples",
  "file": "tui.md",
  "title": "Example: TUI / interactive terminal app",
  "chars": 3021,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/schedule/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/schedule",
  "file": "SKILL.md",
  "title": "Schedule Cloud Agents",
  "chars": 11642,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/security-review/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/security-review",
  "file": "SKILL.md",
  "title": "Vuln 1: XSS: `foo.py:42`",
  "chars": 10928,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/session-start-hook/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/session-start-hook",
  "file": "SKILL.md",
  "title": "Startup Hook Skill for Claude Code on the web",
  "chars": 4903,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/setup-claude/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/setup-claude",
  "file": "SKILL.md",
  "title": "Guided setup",
  "chars": 11901,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/simplify/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/simplify",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/simplify/SKILL",
  "chars": 3036,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/skill-creator/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/skill-creator",
  "file": "SKILL.md",
  "title": "Skill Creator",
  "chars": 33168,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/skill-creator/agents/analyzer.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/skill-creator/agents",
  "file": "analyzer.md",
  "title": "Post-hoc Analyzer Agent",
  "chars": 10374,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/skill-creator/agents/comparator.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/skill-creator/agents",
  "file": "comparator.md",
  "title": "Blind Comparator Agent",
  "chars": 7281,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/skill-creator/agents/grader.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/skill-creator/agents",
  "file": "grader.md",
  "title": "Grader Agent",
  "chars": 9031,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/skill-creator/references/schemas.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/skill-creator/references",
  "file": "schemas.md",
  "title": "JSON Schemas",
  "chars": 12058,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/update-config/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/update-config",
  "file": "SKILL.md",
  "title": "Update Config Skill",
  "chars": 288426,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/verify/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/verify",
  "file": "SKILL.md",
  "title": "Anthropic/claude-code/skills/verify/SKILL",
  "chars": 12177,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/verify/examples/cli.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/verify/examples",
  "file": "cli.md",
  "title": "Verifying a CLI change",
  "chars": 1939,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/verify/examples/server.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/verify/examples",
  "file": "server.md",
  "title": "Verifying a server/API change",
  "chars": 1971,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/workflow-authoring/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/workflow-authoring",
  "file": "SKILL.md",
  "title": "Workflow authoring reference",
  "chars": 16899,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-code/skills/xlsx/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-code/skills/xlsx",
  "file": "SKILL.md",
  "title": "XLSX creation, editing, and analysis",
  "chars": 8542,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-cowork/claude-cowork-dispatch.md",
  "vendor": "Anthropic",
  "product": "claude-cowork",
  "file": "claude-cowork-dispatch.md",
  "title": "auto memory",
  "chars": 71303,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-cowork/claude-cowork.md",
  "vendor": "Anthropic",
  "product": "claude-cowork",
  "file": "claude-cowork.md",
  "title": "CRITICAL BROWSER STORAGE RESTRICTION",
  "chars": 174317,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-cowork/setup-cowork/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-cowork/setup-cowork",
  "file": "SKILL.md",
  "title": "Setup Cowork",
  "chars": 11955,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-cowork/setup-writing-style/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-cowork/setup-writing-style",
  "file": "SKILL.md",
  "title": "Setup Writing Style",
  "chars": 42076,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/claude-design.md",
  "vendor": "Anthropic",
  "product": "claude-design",
  "file": "claude-design.md",
  "title": "System Prompt",
  "chars": 142580,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/3d-object/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/3d-object",
  "file": "SKILL.md",
  "title": "3D object",
  "chars": 4284,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/animated-video/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/animated-video",
  "file": "SKILL.md",
  "title": "Animated video",
  "chars": 10118,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/claude-api-in-prototypes/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/claude-api-in-prototypes",
  "file": "SKILL.md",
  "title": "Claude API in prototypes",
  "chars": 1121,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/create-design-system/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/create-design-system",
  "file": "SKILL.md",
  "title": "Create design system",
  "chars": 18955,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/export-as-pptx-editable/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/export-as-pptx-editable",
  "file": "SKILL.md",
  "title": "Export as PPTX (editable)",
  "chars": 6062,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/export-as-pptx-screenshots/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/export-as-pptx-screenshots",
  "file": "SKILL.md",
  "title": "Export as PPTX (screenshots)",
  "chars": 1870,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/flier/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/flier",
  "file": "SKILL.md",
  "title": "Flier",
  "chars": 2113,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/frontend-design/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/frontend-design",
  "file": "SKILL.md",
  "title": "Frontend design",
  "chars": 2494,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/handoff-to-claude-code/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/handoff-to-claude-code",
  "file": "SKILL.md",
  "title": "Handoff to Claude Code",
  "chars": 4092,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/hi-fi-design/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/hi-fi-design",
  "file": "SKILL.md",
  "title": "Hi-fi design",
  "chars": 6379,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/html-email/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/html-email",
  "file": "SKILL.md",
  "title": "HTML email",
  "chars": 2636,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/interactive-prototype/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/interactive-prototype",
  "file": "SKILL.md",
  "title": "Interactive prototype",
  "chars": 445,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/make-a-deck/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/make-a-deck",
  "file": "SKILL.md",
  "title": "Make a deck",
  "chars": 9655,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/make-a-doc/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/make-a-doc",
  "file": "SKILL.md",
  "title": "Make a doc",
  "chars": 2635,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/make-tweakable/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/make-tweakable",
  "file": "SKILL.md",
  "title": "Make tweakable",
  "chars": 389,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/maps-geography/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/maps-geography",
  "file": "SKILL.md",
  "title": "Maps & geography",
  "chars": 2867,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/options/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/options",
  "file": "SKILL.md",
  "title": "Options",
  "chars": 3672,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/save-as-pdf/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/save-as-pdf",
  "file": "SKILL.md",
  "title": "Save as PDF",
  "chars": 9104,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/save-as-standalone-html/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/save-as-standalone-html",
  "file": "SKILL.md",
  "title": "Save as standalone HTML",
  "chars": 5794,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/web-research/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/web-research",
  "file": "SKILL.md",
  "title": "Web research",
  "chars": 2002,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-design/skills/wireframe/SKILL.md",
  "vendor": "Anthropic",
  "product": "claude-design/skills/wireframe",
  "file": "SKILL.md",
  "title": "Wireframe",
  "chars": 4149,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-fable-5.1.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-fable-5.1.md",
  "title": "claude_behavior",
  "chars": 474916,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-fable-5.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-fable-5.md",
  "title": "claude_behavior",
  "chars": 404644,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-for-excel.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-for-excel.md",
  "title": "Identity",
  "chars": 16884,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-for-word.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-for-word.md",
  "title": "WORD AGENT — SYSTEM INSTRUCTIONS",
  "chars": 27804,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-haiku-5.5.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-haiku-5.5.md",
  "title": "Claude behavior",
  "chars": 446384,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-in-chrome.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-in-chrome.md",
  "title": "Anthropic/claude-in-chrome",
  "chars": 73970,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-in-powerpoint.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-in-powerpoint.md",
  "title": "Anthropic/claude-in-powerpoint",
  "chars": 6116,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-mobile-ios.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-mobile-ios.md",
  "title": "Anthropic/claude-mobile-ios",
  "chars": 53434,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-opus-4.6-no-tools.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-opus-4.6-no-tools.md",
  "title": "Rules for use of the `<end_conversation>` tool:",
  "chars": 49652,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-opus-4.6.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-opus-4.6.md",
  "title": "Rules for use of the `<end_conversation>` tool:",
  "chars": 179139,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-opus-4.7.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-opus-4.7.md",
  "title": "Rules for use of the `<end_conversation>` tool:",
  "chars": 181696,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-opus-4.8.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-opus-4.8.md",
  "title": "Rules for use of the `<end_conversation>` tool:",
  "chars": 183108,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-opus-5.5.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-opus-5.5.md",
  "title": "claude_behavior",
  "chars": 477019,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-opus-5.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-opus-5.md",
  "title": "claude_behavior",
  "chars": 223257,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-projects-thread-claude.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-projects-thread-claude.md",
  "title": "Harness",
  "chars": 531979,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-science.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-science.md",
  "title": "Claude Science platform rules",
  "chars": 154788,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-sonnet-4.6-no-tools.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-sonnet-4.6-no-tools.md",
  "title": "Anthropic/claude-sonnet-4.6-no-tools",
  "chars": 47408,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-sonnet-4.6.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-sonnet-4.6.md",
  "title": "Rules for use of the `<end_conversation>` tool:",
  "chars": 173989,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-sonnet-5.5.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-sonnet-5.5.md",
  "title": "Claude behavior",
  "chars": 479741,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-sonnet-5.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-sonnet-5.md",
  "title": "Rules for use of the `<end_conversation>` tool:",
  "chars": 188043,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/claude-voice-mode.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "claude-voice-mode.md",
  "title": "Anthropic/claude-voice-mode",
  "chars": 1085,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2024-07-12-claude-haiku-3.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2024-07-12-claude-haiku-3.md",
  "title": "Anthropic/official/2024-07-12-claude-haiku-3",
  "chars": 737,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2024-07-12-claude-opus-3.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2024-07-12-claude-opus-3.md",
  "title": "Anthropic/official/2024-07-12-claude-opus-3",
  "chars": 2143,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2024-07-12-claude-sonnet-3.5-text-and-images.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2024-07-12-claude-sonnet-3.5-text-and-images.md",
  "title": "Claude info",
  "chars": 5786,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2024-09-09-claude-sonnet-3.5-text-and-images.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2024-09-09-claude-sonnet-3.5-text-and-images.md",
  "title": "Claude info",
  "chars": 5980,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2024-09-09-claude-sonnet-3.5-text-only.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2024-09-09-claude-sonnet-3.5-text-only.md",
  "title": "Claude info",
  "chars": 4880,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2024-10-22-claude-haiku-3.5-text-only.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2024-10-22-claude-haiku-3.5-text-only.md",
  "title": "Anthropic/official/2024-10-22-claude-haiku-3.5-text-only",
  "chars": 9581,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2024-10-22-claude-sonnet-3.5-text-and-images.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2024-10-22-claude-sonnet-3.5-text-and-images.md",
  "title": "Anthropic/official/2024-10-22-claude-sonnet-3.5-text-and-images",
  "chars": 13214,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2024-10-22-claude-sonnet-3.5-text-only.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2024-10-22-claude-sonnet-3.5-text-only.md",
  "title": "Anthropic/official/2024-10-22-claude-sonnet-3.5-text-only",
  "chars": 12144,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2024-11-22-claude-sonnet-3.5-text-and-images.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2024-11-22-claude-sonnet-3.5-text-and-images.md",
  "title": "Anthropic/official/2024-11-22-claude-sonnet-3.5-text-and-images",
  "chars": 13354,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2024-11-22-claude-sonnet-3.5-text-only.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2024-11-22-claude-sonnet-3.5-text-only.md",
  "title": "Anthropic/official/2024-11-22-claude-sonnet-3.5-text-only",
  "chars": 12286,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-02-24-claude-haiku-3.5-text-and-images.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-02-24-claude-haiku-3.5-text-and-images.md",
  "title": "Anthropic/official/2025-02-24-claude-haiku-3.5-text-and-images",
  "chars": 11745,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-02-24-claude-sonnet-3.7.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-02-24-claude-sonnet-3.7.md",
  "title": "Anthropic/official/2025-02-24-claude-sonnet-3.7",
  "chars": 12861,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-05-22-claude-opus-4.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-05-22-claude-opus-4.md",
  "title": "Anthropic/official/2025-05-22-claude-opus-4",
  "chars": 10865,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-05-22-claude-sonnet-4.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-05-22-claude-sonnet-4.md",
  "title": "Anthropic/official/2025-05-22-claude-sonnet-4",
  "chars": 10867,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-07-31-claude-opus-4.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-07-31-claude-opus-4.md",
  "title": "Anthropic/official/2025-07-31-claude-opus-4",
  "chars": 16549,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-07-31-claude-sonnet-4.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-07-31-claude-sonnet-4.md",
  "title": "Anthropic/official/2025-07-31-claude-sonnet-4",
  "chars": 16552,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-08-05-claude-opus-4.1.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-08-05-claude-opus-4.1.md",
  "title": "Election info",
  "chars": 18571,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-08-05-claude-opus-4.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-08-05-claude-opus-4.md",
  "title": "Anthropic/official/2025-08-05-claude-opus-4",
  "chars": 16549,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-08-05-claude-sonnet-4.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-08-05-claude-sonnet-4.md",
  "title": "Anthropic/official/2025-08-05-claude-sonnet-4",
  "chars": 16552,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-09-29-claude-sonnet-4.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-09-29-claude-sonnet-4.5.md",
  "title": "Behavior instructions",
  "chars": 12821,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-10-15-claude-haiku-4.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-10-15-claude-haiku-4.5.md",
  "title": "Behavior instructions",
  "chars": 12813,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-11-19-claude-haiku-4.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-11-19-claude-haiku-4.5.md",
  "title": "Claude behavior",
  "chars": 13949,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-11-19-claude-sonnet-4.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-11-19-claude-sonnet-4.5.md",
  "title": "Claude behavior",
  "chars": 13961,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2025-11-24-claude-opus-4.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2025-11-24-claude-opus-4.5.md",
  "title": "Claude behavior",
  "chars": 15383,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-01-18-claude-haiku-4.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-01-18-claude-haiku-4.5.md",
  "title": "Claude behavior",
  "chars": 14960,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-01-18-claude-opus-4.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-01-18-claude-opus-4.5.md",
  "title": "Claude behavior",
  "chars": 16195,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-01-18-claude-sonnet-4.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-01-18-claude-sonnet-4.5.md",
  "title": "Claude behavior",
  "chars": 14966,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-02-05-claude-opus-4.6.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-02-05-claude-opus-4.6.md",
  "title": "Claude behavior",
  "chars": 18528,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-02-17-claude-sonnet-4.6.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-02-17-claude-sonnet-4.6.md",
  "title": "Claude behavior",
  "chars": 18892,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-04-16-claude-opus-4.7.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-04-16-claude-opus-4.7.md",
  "title": "Claude behavior",
  "chars": 23816,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-05-28-claude-opus-4.8.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-05-28-claude-opus-4.8.md",
  "title": "Claude behavior",
  "chars": 22371,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-06-09-claude-fable-5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-06-09-claude-fable-5.md",
  "title": "Claude behavior",
  "chars": 21771,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-06-30-claude-sonnet-5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-06-30-claude-sonnet-5.md",
  "title": "Claude behavior",
  "chars": 23049,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-07-24-claude-opus-5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-07-24-claude-opus-5.md",
  "title": "Claude behavior",
  "chars": 21618,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-09-01-claude-fable-5.1.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-09-01-claude-fable-5.1.md",
  "title": "Claude behavior",
  "chars": 27675,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-09-22-claude-opus-5.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-09-22-claude-opus-5.5.md",
  "title": "Claude behavior",
  "chars": 26854,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-09-28-claude-sonnet-5.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-09-28-claude-sonnet-5.5.md",
  "title": "Claude behavior",
  "chars": 20023,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/2026-10-07-claude-haiku-5.5.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "2026-10-07-claude-haiku-5.5.md",
  "title": "Claude behavior",
  "chars": 27233,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/README.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "README.md",
  "title": "Official Claude system prompts",
  "chars": 4907,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/all.md",
  "vendor": "Anthropic",
  "product": "official",
  "file": "all.md",
  "title": "Claude Haiku 5.5 - October 7, 2026",
  "chars": 579941,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/claude-constitution/2023-05-09-claude-constitution-v1.md",
  "vendor": "Anthropic",
  "product": "official/claude-constitution",
  "file": "2023-05-09-claude-constitution-v1.md",
  "title": "Anthropic/official/claude-constitution/2023-05-09-claude-constitution-v1",
  "chars": 16651,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/official/claude-constitution/2026-01-20-claude-constitution-v2.md",
  "vendor": "Anthropic",
  "product": "official/claude-constitution",
  "file": "2026-01-20-claude-constitution-v2.md",
  "title": "Overview",
  "chars": 182505,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/old/claude-3.7-full-system-message-with-all-tools.md",
  "vendor": "Anthropic",
  "product": "old",
  "file": "claude-3.7-full-system-message-with-all-tools.md",
  "title": "You must use artifacts for",
  "chars": 112262,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/old/claude-3.7-sonnet-full-system-message-humanreadable.md",
  "vendor": "Anthropic",
  "product": "old",
  "file": "claude-3.7-sonnet-full-system-message-humanreadable.md",
  "title": "Tool-Specific Instructions",
  "chars": 113712,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/old/claude-3.7-sonnet-w-tools.md",
  "vendor": "Anthropic",
  "product": "old",
  "file": "claude-3.7-sonnet-w-tools.md",
  "title": "You must use artifacts for",
  "chars": 110024,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/old/claude-3.7-sonnet.md",
  "vendor": "Anthropic",
  "product": "old",
  "file": "claude-3.7-sonnet.md",
  "title": "You must use artifacts for",
  "chars": 112167,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/old/claude-4.1-opus-thinking.md",
  "vendor": "Anthropic",
  "product": "old",
  "file": "claude-4.1-opus-thinking.md",
  "title": "Rules for use of the ＜end_conversation＞ tool:",
  "chars": 105567,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/old/claude-4.5-sonnet.md",
  "vendor": "Anthropic",
  "product": "old",
  "file": "claude-4.5-sonnet.md",
  "title": "CRITICAL BROWSER STORAGE RESTRICTION",
  "chars": 143465,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/old/claude-opus-4.5.md",
  "vendor": "Anthropic",
  "product": "old",
  "file": "claude-opus-4.5.md",
  "title": "CRITICAL BROWSER STORAGE RESTRICTION",
  "chars": 90351,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/old/claude-sonnet-4.md",
  "vendor": "Anthropic",
  "product": "old",
  "file": "claude-sonnet-4.md",
  "title": "You must use artifacts for",
  "chars": 101438,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/old/default-styles.md",
  "vendor": "Anthropic",
  "product": "old",
  "file": "default-styles.md",
  "title": "Anthropic/old/default-styles",
  "chars": 5695,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/raw/claude-haiku-5.5-raw.md",
  "vendor": "Anthropic",
  "product": "raw",
  "file": "claude-haiku-5.5-raw.md",
  "title": "Rules for use of the <mcp__claude_ai__end_conversation> tool:",
  "chars": 419253,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/raw/claude-opus-4.6-no-tools-raw.md",
  "vendor": "Anthropic",
  "product": "raw",
  "file": "claude-opus-4.6-no-tools-raw.md",
  "title": "Rules for use of the ＜end_conversation＞ tool:",
  "chars": 42642,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/raw/claude-opus-4.6-raw.md",
  "vendor": "Anthropic",
  "product": "raw",
  "file": "claude-opus-4.6-raw.md",
  "title": "Rules for use of the <end_conversation> tool:",
  "chars": 232009,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/raw/claude-sonnet-4.6-no-tools-raw.md",
  "vendor": "Anthropic",
  "product": "raw",
  "file": "claude-sonnet-4.6-no-tools-raw.md",
  "title": "Anthropic/raw/claude-sonnet-4.6-no-tools-raw",
  "chars": 40450,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/raw/claude-sonnet-4.6-raw.md",
  "vendor": "Anthropic",
  "product": "raw",
  "file": "claude-sonnet-4.6-raw.md",
  "title": "CRITICAL BROWSER STORAGE RESTRICTION",
  "chars": 235827,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/raw/claude-sonnet-5.5-raw.md",
  "vendor": "Anthropic",
  "product": "raw",
  "file": "claude-sonnet-5.5-raw.md",
  "title": "Rules for use of the <end_conversation> tool:",
  "chars": 438777,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/research_instructions.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "research_instructions.md",
  "title": "Anthropic/research_instructions",
  "chars": 20741,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/sonnet-4.6-reminders.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "sonnet-4.6-reminders.md",
  "title": "Anthropic/sonnet-4.6-reminders",
  "chars": 3929,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Anthropic/visualize.md",
  "vendor": "Anthropic",
  "product": "",
  "file": "visualize.md",
  "title": "Imagine — Visual Creation Suite",
  "chars": 70198,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Cursor/cursor.md",
  "vendor": "Cursor",
  "product": "",
  "file": "cursor.md",
  "title": "Cursor/cursor",
  "chars": 18111,
  "vendored": true,
  "slug": "Cursor-cursor"
 },
 {
  "path": "DeepSeek/deepseek-chat.md",
  "vendor": "DeepSeek",
  "product": "",
  "file": "deepseek-chat.md",
  "title": "DeepSeek/deepseek-chat",
  "chars": 438,
  "vendored": true,
  "slug": "DeepSeek-deepseek-chat"
 },
 {
  "path": "GLM/README.md",
  "vendor": "GLM",
  "product": "",
  "file": "README.md",
  "title": "GLM/README",
  "chars": 132,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/ai-studio-build.md",
  "vendor": "Google",
  "product": "",
  "file": "ai-studio-build.md",
  "title": "Baseline Guidelines",
  "chars": 9331,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/antigravity-cli.md",
  "vendor": "Google",
  "product": "",
  "file": "antigravity-cli.md",
  "title": "Design Aesthetics",
  "chars": 24491,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-2.0-flash-webapp.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-2.0-flash-webapp.md",
  "title": "Google/gemini-2.0-flash-webapp",
  "chars": 2374,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-2.5-flash-image-preview.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-2.5-flash-image-preview.md",
  "title": "Google/gemini-2.5-flash-image-preview",
  "chars": 4875,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-2.5-pro-api.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-2.5-pro-api.md",
  "title": "place your python code here",
  "chars": 3196,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-2.5-pro-guided-learning.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-2.5-pro-guided-learning.md",
  "title": "Saved Information",
  "chars": 15453,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-2.5-pro-webapp.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-2.5-pro-webapp.md",
  "title": "Guidelines for answering questions",
  "chars": 1934,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-3-flash.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-3-flash.md",
  "title": "Saved Information",
  "chars": 15510,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-3-pro.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-3-pro.md",
  "title": "Google/gemini-3-pro",
  "chars": 14197,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-3.1-pro-api.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-3.1-pro-api.md",
  "title": "Google/gemini-3.1-pro-api",
  "chars": 2701,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-3.1-pro.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-3.1-pro.md",
  "title": "Google/gemini-3.1-pro",
  "chars": 26345,
  "vendored": true,
  "slug": "Google-gemini-3-1-pro"
 },
 {
  "path": "Google/gemini-3.5-flash-ai-studio.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-3.5-flash-ai-studio.md",
  "title": "Google/gemini-3.5-flash-ai-studio",
  "chars": 2328,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-3.5-flash.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-3.5-flash.md",
  "title": "Saved Information",
  "chars": 16091,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-3.7-flash.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-3.7-flash.md",
  "title": "Saved Information",
  "chars": 33373,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-3.8-flash.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-3.8-flash.md",
  "title": "Saved Information",
  "chars": 57657,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-cli.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-cli.md",
  "title": "Core Mandates",
  "chars": 28860,
  "vendored": true,
  "slug": "Google-gemini-cli"
 },
 {
  "path": "Google/gemini-diffusion.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-diffusion.md",
  "title": "Google/gemini-diffusion",
  "chars": 6541,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-in-chrome.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-in-chrome.md",
  "title": "Google/gemini-in-chrome",
  "chars": 11574,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-workspace.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-workspace.md",
  "title": "Gemini Google Workspace System Prompt",
  "chars": 21232,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/gemini-youtube.md",
  "vendor": "Google",
  "product": "",
  "file": "gemini-youtube.md",
  "title": "Task",
  "chars": 16939,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/google-search-ai-mode.md",
  "vendor": "Google",
  "product": "",
  "file": "google-search-ai-mode.md",
  "title": "Google/google-search-ai-mode",
  "chars": 4339,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/jules.md",
  "vendor": "Google",
  "product": "",
  "file": "jules.md",
  "title": "Google/jules",
  "chars": 16077,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/nano-banana-2-api.md",
  "vendor": "Google",
  "product": "",
  "file": "nano-banana-2-api.md",
  "title": "Google/nano-banana-2-api",
  "chars": 2427,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Google/notebooklm-chat.md",
  "vendor": "Google",
  "product": "",
  "file": "notebooklm-chat.md",
  "title": "Google/notebooklm-chat",
  "chars": 2526,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Kimi/kimi-2.6.md",
  "vendor": "Kimi",
  "product": "",
  "file": "kimi-2.6.md",
  "title": "memory",
  "chars": 13133,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Kimi/kimi-3.md",
  "vendor": "Kimi",
  "product": "",
  "file": "kimi-3.md",
  "title": "Kimi/kimi-3",
  "chars": 35888,
  "vendored": true,
  "slug": "Kimi-kimi-3"
 },
 {
  "path": "Meta/muse-agent/AGENTS.md",
  "vendor": "Meta",
  "product": "muse-agent",
  "file": "AGENTS.md",
  "title": "AGENTS.md",
  "chars": 886,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/HEARTBEAT.md",
  "vendor": "Meta",
  "product": "muse-agent",
  "file": "HEARTBEAT.md",
  "title": "HEARTBEAT.md",
  "chars": 113,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/IDENTITY.md",
  "vendor": "Meta",
  "product": "muse-agent",
  "file": "IDENTITY.md",
  "title": "IDENTITY.md",
  "chars": 276,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/MEMORY.md",
  "vendor": "Meta",
  "product": "muse-agent",
  "file": "MEMORY.md",
  "title": "MEMORY.md",
  "chars": 233,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/PROACTIVE_PREFERENCES.md",
  "vendor": "Meta",
  "product": "muse-agent",
  "file": "PROACTIVE_PREFERENCES.md",
  "title": "PROACTIVE_PREFERENCES.md",
  "chars": 496,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/SOUL.md",
  "vendor": "Meta",
  "product": "muse-agent",
  "file": "SOUL.md",
  "title": "SOUL.md",
  "chars": 795,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/TOOLS.md",
  "vendor": "Meta",
  "product": "muse-agent",
  "file": "TOOLS.md",
  "title": "TOOLS.md - Local Notes",
  "chars": 337,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/USER.md",
  "vendor": "Meta",
  "product": "muse-agent",
  "file": "USER.md",
  "title": "USER.md",
  "chars": 337,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/assets/onboarding_tour/memory_import.md",
  "vendor": "Meta",
  "product": "muse-agent/assets/onboarding_tour",
  "file": "memory_import.md",
  "title": "Bring context from another AI",
  "chars": 3829,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/artifacts.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "artifacts.md",
  "title": "Artifacts",
  "chars": 2669,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/browser.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "browser.md",
  "title": "Browser",
  "chars": 5722,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/calls-texts-notifications.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "calls-texts-notifications.md",
  "title": "Calls, Texts, and Notifications",
  "chars": 8773,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/chat-connections.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "chat-connections.md",
  "title": "Side-chat connections",
  "chars": 2035,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/chat-connections/whatsapp.md",
  "vendor": "Meta",
  "product": "muse-agent/docs/chat-connections",
  "file": "whatsapp.md",
  "title": "WhatsApp side chats",
  "chars": 2896,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/chat/payments-and-purchases.md",
  "vendor": "Meta",
  "product": "muse-agent/docs/chat",
  "file": "payments-and-purchases.md",
  "title": "Purchases and Payments",
  "chars": 20148,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/chat/scheduling-and-watching.md",
  "vendor": "Meta",
  "product": "muse-agent/docs/chat",
  "file": "scheduling-and-watching.md",
  "title": "Scheduling, monitoring, and services",
  "chars": 7334,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/client-surfaces.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "client-surfaces.md",
  "title": "Where users access Muse",
  "chars": 27368,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/connectors.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "connectors.md",
  "title": "Connectors and what they do",
  "chars": 9691,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/data-handling.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "data-handling.md",
  "title": "How the user's information is handled",
  "chars": 5219,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/devices/home_link.md",
  "vendor": "Meta",
  "product": "muse-agent/docs/devices",
  "file": "home_link.md",
  "title": "Muse Home Link",
  "chars": 9498,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/devices/home_link/integrations/brother_printers.md",
  "vendor": "Meta",
  "product": "muse-agent/docs/devices/home_link/integrations",
  "file": "brother_printers.md",
  "title": "Brother Printers: IPP Printing",
  "chars": 710,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/devices/home_link/integrations/lutron_smart_bridges.md",
  "vendor": "Meta",
  "product": "muse-agent/docs/devices/home_link/integrations",
  "file": "lutron_smart_bridges.md",
  "title": "Lutron Smart Bridges: Light and Shade Control",
  "chars": 1162,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/devices/home_link/integrations/shelly_plugs.md",
  "vendor": "Meta",
  "product": "muse-agent/docs/devices/home_link/integrations",
  "file": "shelly_plugs.md",
  "title": "Shelly Plugs (Gen 4): Switching and Power Metering",
  "chars": 4475,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/devices/mac_app.md",
  "vendor": "Meta",
  "product": "muse-agent/docs/devices",
  "file": "mac_app.md",
  "title": "Mac App",
  "chars": 4976,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/devices/tailscale.md",
  "vendor": "Meta",
  "product": "muse-agent/docs/devices",
  "file": "tailscale.md",
  "title": "Tailscale",
  "chars": 4978,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/feed.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "feed.md",
  "title": "The Feed",
  "chars": 5907,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/files-and-library.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "files-and-library.md",
  "title": "Files and the Library",
  "chars": 6447,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/goals.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "goals.md",
  "title": "Goals",
  "chars": 1964,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/ideas.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "ideas.md",
  "title": "Ideas",
  "chars": 1022,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/media.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "media.md",
  "title": "Media generation",
  "chars": 3561,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/memory.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "memory.md",
  "title": "Memory",
  "chars": 1659,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/muse.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "muse.md",
  "title": "Muse",
  "chars": 5877,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/payments-and-purchases.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "payments-and-purchases.md",
  "title": "Purchases and payments",
  "chars": 11702,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/privacy-and-credentials.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "privacy-and-credentials.md",
  "title": "Privacy and credentials",
  "chars": 9451,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/referrals.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "referrals.md",
  "title": "Referrals and invite codes",
  "chars": 3420,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/scheduling-and-watching.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "scheduling-and-watching.md",
  "title": "Scheduled work and watching",
  "chars": 3386,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/self_improvement.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "self_improvement.md",
  "title": "How You Evolve",
  "chars": 3136,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/docs/voice.md",
  "vendor": "Meta",
  "product": "muse-agent/docs",
  "file": "voice.md",
  "title": "Voice",
  "chars": 366,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/memory/bank/experience.md",
  "vendor": "Meta",
  "product": "muse-agent/memory/bank",
  "file": "experience.md",
  "title": "experience.md",
  "chars": 69,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/memory/bank/opinions.md",
  "vendor": "Meta",
  "product": "muse-agent/memory/bank",
  "file": "opinions.md",
  "title": "opinions.md",
  "chars": 68,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/memory/bank/world.md",
  "vendor": "Meta",
  "product": "muse-agent/memory/bank",
  "file": "world.md",
  "title": "world.md",
  "chars": 73,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/apple-healthkit/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/apple-healthkit",
  "file": "SKILL.md",
  "title": "Apple Health",
  "chars": 8824,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/document/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/document",
  "file": "SKILL.md",
  "title": "Word-document artifacts",
  "chars": 2080,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/document/references/editing.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/document/references",
  "file": "editing.md",
  "title": "Editing existing Word documents",
  "chars": 5732,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/document/references/visual.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/document/references",
  "file": "visual.md",
  "title": "Document Visual Guidance",
  "chars": 1078,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/map-runtime/README.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/map-runtime",
  "file": "README.md",
  "title": "Artifact map runtime",
  "chars": 5646,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/markdown/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/markdown",
  "file": "SKILL.md",
  "title": "Markdown artifacts",
  "chars": 1334,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/pdf/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/pdf",
  "file": "SKILL.md",
  "title": "PDF artifacts",
  "chars": 1996,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/pdf/references/existing-pdfs.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/pdf/references",
  "file": "existing-pdfs.md",
  "title": "Working with existing PDFs",
  "chars": 7301,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/pdf/references/visual.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/pdf/references",
  "file": "visual.md",
  "title": "PDF Visual Guidance",
  "chars": 4143,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/pdf/references/workflow.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/pdf/references",
  "file": "workflow.md",
  "title": "PDF artifacts",
  "chars": 13713,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/presentation/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/presentation",
  "file": "SKILL.md",
  "title": "Slide-deck artifacts",
  "chars": 2794,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/presentation/references/authoring.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/presentation/references",
  "file": "authoring.md",
  "title": "Slide authoring rulebook",
  "chars": 15320,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/presentation/references/design-system.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/presentation/references",
  "file": "design-system.md",
  "title": "Slide design system",
  "chars": 9787,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/presentation/references/editing.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/presentation/references",
  "file": "editing.md",
  "title": "Slide deck editing",
  "chars": 9100,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/presentation/references/image-directive.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/presentation/references",
  "file": "image-directive.md",
  "title": "Image generation directive",
  "chars": 5231,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/presentation/references/theme.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/presentation/references",
  "file": "theme.md",
  "title": "Theme schema and generation",
  "chars": 3725,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/presentation/references/visual.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/presentation/references",
  "file": "visual.md",
  "title": "Presentation Visual Guidance",
  "chars": 5076,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/presentation/references/workflow.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/presentation/references",
  "file": "workflow.md",
  "title": "Slide deck build workflow",
  "chars": 27493,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/references/charts.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/references",
  "file": "charts.md",
  "title": "Charts",
  "chars": 9955,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/references/live-data.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/references",
  "file": "live-data.md",
  "title": "Live external data",
  "chars": 8242,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/references/maps-recipes.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/references",
  "file": "maps-recipes.md",
  "title": "Map helpers",
  "chars": 5711,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/references/maps.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/references",
  "file": "maps.md",
  "title": "Maps and places",
  "chars": 15456,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/references/markdown.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/references",
  "file": "markdown.md",
  "title": "Markdown formatting for artifact files",
  "chars": 1849,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/references/prose.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/references",
  "file": "prose.md",
  "title": "Prose in a document artifact",
  "chars": 6113,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/references/social-embeds.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/references",
  "file": "social-embeds.md",
  "title": "Social posts, reels, and rich embeds",
  "chars": 3341,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/references/spoken-audio.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/references",
  "file": "spoken-audio.md",
  "title": "Spoken audio",
  "chars": 1675,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/spreadsheet/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/spreadsheet",
  "file": "SKILL.md",
  "title": "Spreadsheet artifacts",
  "chars": 3594,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/spreadsheet/references/formulas.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/spreadsheet/references",
  "file": "formulas.md",
  "title": "Formulas, recalculation, and editing existing workbooks",
  "chars": 3480,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/spreadsheet/references/visual.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/spreadsheet/references",
  "file": "visual.md",
  "title": "Spreadsheet Visual Guidance",
  "chars": 3065,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/artifacts/testing/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/artifacts/testing",
  "file": "SKILL.md",
  "title": "Artifact verification",
  "chars": 2391,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/asana/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/asana",
  "file": "SKILL.md",
  "title": "Asana",
  "chars": 1410,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/booking/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/booking",
  "file": "SKILL.md",
  "title": "Booking",
  "chars": 15959,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/booking/references/browser-booking.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/booking/references",
  "file": "browser-booking.md",
  "title": "Browser booking",
  "chars": 3915,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/booking/references/flights.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/booking/references",
  "file": "flights.md",
  "title": "Flights",
  "chars": 14699,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/booking/references/hotels.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/booking/references",
  "file": "hotels.md",
  "title": "Hotels",
  "chars": 7352,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/booking/references/presentation.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/booking/references",
  "file": "presentation.md",
  "title": "Booking presentation",
  "chars": 8406,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/booking/references/restaurants.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/booking/references",
  "file": "restaurants.md",
  "title": "Restaurants",
  "chars": 5544,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/booking/references/tickets.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/booking/references",
  "file": "tickets.md",
  "title": "Event tickets",
  "chars": 4101,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/box/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/box",
  "file": "SKILL.md",
  "title": "Box",
  "chars": 4210,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/calendly/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/calendly",
  "file": "SKILL.md",
  "title": "Calendly",
  "chars": 2771,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/canva/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/canva",
  "file": "SKILL.md",
  "title": "Canva",
  "chars": 8419,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/device-data/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/device-data",
  "file": "SKILL.md",
  "title": "Device Data",
  "chars": 7685,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/dropbox/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/dropbox",
  "file": "SKILL.md",
  "title": "Dropbox",
  "chars": 2304,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/duffel/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/duffel",
  "file": "SKILL.md",
  "title": "Duffel Flight Booking",
  "chars": 28810,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/evernote/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/evernote",
  "file": "SKILL.md",
  "title": "Evernote",
  "chars": 1117,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli",
  "file": "SKILL.md",
  "title": "Facebook CLI",
  "chars": 22488,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/comments.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "comments.md",
  "title": "Facebook Comments",
  "chars": 2302,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/events.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "events.md",
  "title": "Facebook Events",
  "chars": 4895,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/feed.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "feed.md",
  "title": "Facebook Feed",
  "chars": 2701,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/friends.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "friends.md",
  "title": "Facebook Friends",
  "chars": 10550,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/groups.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "groups.md",
  "title": "Facebook Groups",
  "chars": 4694,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/marketplace.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "marketplace.md",
  "title": "Facebook Marketplace",
  "chars": 33775,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/pages.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "pages.md",
  "title": "Facebook Page workflows",
  "chars": 12662,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/posts.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "posts.md",
  "title": "Facebook Posts",
  "chars": 4744,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/profile.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "profile.md",
  "title": "Facebook Profile",
  "chars": 2329,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/reactions.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "reactions.md",
  "title": "Facebook Reactions",
  "chars": 1964,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/saved.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "saved.md",
  "title": "Saved",
  "chars": 3751,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/story.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "story.md",
  "title": "Facebook Stories",
  "chars": 942,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook-cli/references/timeline.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook-cli/references",
  "file": "timeline.md",
  "title": "Facebook Timeline",
  "chars": 5144,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/facebook/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/facebook",
  "file": "SKILL.md",
  "title": "Facebook CLI",
  "chars": 22488,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/figma/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/figma",
  "file": "SKILL.md",
  "title": "Figma",
  "chars": 3741,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/figma/references/canvas-editing.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/figma/references",
  "file": "canvas-editing.md",
  "title": "Canvas editing",
  "chars": 2139,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/figma/references/code-connect.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/figma/references",
  "file": "code-connect.md",
  "title": "Code Connect",
  "chars": 1450,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/figma/references/design-to-code.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/figma/references",
  "file": "design-to-code.md",
  "title": "Design to code",
  "chars": 1754,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/figma/references/diagrams.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/figma/references",
  "file": "diagrams.md",
  "title": "FigJam diagrams",
  "chars": 1308,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/flightaware/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/flightaware",
  "file": "SKILL.md",
  "title": "FlightAware",
  "chars": 11271,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/flightaware/eval/findings.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/flightaware/eval",
  "file": "findings.md",
  "title": "FlightAware skill trim — findings",
  "chars": 7573,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/forget/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/forget",
  "file": "SKILL.md",
  "title": "Forget",
  "chars": 6569,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/forget/references/artifact-inventory.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/forget/references",
  "file": "artifact-inventory.md",
  "title": "Forget artifact inventory",
  "chars": 12653,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/function-health/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/function-health",
  "file": "SKILL.md",
  "title": "Function Health",
  "chars": 4400,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/generate_podcast/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/generate_podcast",
  "file": "SKILL.md",
  "title": "Generate Podcast",
  "chars": 26065,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/generate_podcast/references/save-to-spotify.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/generate_podcast/references",
  "file": "save-to-spotify.md",
  "title": "Add a generated episode to the user's Spotify",
  "chars": 8063,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/generate_podcast/save-to-spotify/vendor/save-to-spotify/README.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/generate_podcast/save-to-spotify/vendor/save-to-spotify",
  "file": "README.md",
  "title": "save-to-spotify CLI release pin",
  "chars": 2549,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/ghl/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/ghl",
  "file": "SKILL.md",
  "title": "HighLevel",
  "chars": 3900,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/github/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/github",
  "file": "SKILL.md",
  "title": "GitHub",
  "chars": 4535,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/gmail/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/gmail",
  "file": "SKILL.md",
  "title": "Gmail",
  "chars": 15988,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals",
  "file": "SKILL.md",
  "title": "Goals guidance assets",
  "chars": 3161,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/creation/career.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/creation",
  "file": "career.md",
  "title": "Creating a career goal",
  "chars": 5918,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/creation/health.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/creation",
  "file": "health.md",
  "title": "Creating a health goal",
  "chars": 6881,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/creation/interests.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/creation",
  "file": "interests.md",
  "title": "Creating an interest goal",
  "chars": 5331,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/creation/money.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/creation",
  "file": "money.md",
  "title": "Creating a money goal",
  "chars": 6106,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/creation/productivity.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/creation",
  "file": "productivity.md",
  "title": "Creating a productivity goal",
  "chars": 5944,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/creation/relationships.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/creation",
  "file": "relationships.md",
  "title": "Creating a relationship goal",
  "chars": 5818,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/creation/something_else.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/creation",
  "file": "something_else.md",
  "title": "Creating a goal for something else",
  "chars": 5190,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/guides/career/scaffold.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/guides/career",
  "file": "scaffold.md",
  "title": "Career goals",
  "chars": 1056,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/guides/health/scaffold.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/guides/health",
  "file": "scaffold.md",
  "title": "Health goals",
  "chars": 1799,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/guides/interests/scaffold.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/guides/interests",
  "file": "scaffold.md",
  "title": "Interest goals",
  "chars": 928,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/guides/money/scaffold.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/guides/money",
  "file": "scaffold.md",
  "title": "Money goals",
  "chars": 1427,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/guides/productivity/scaffold.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/guides/productivity",
  "file": "scaffold.md",
  "title": "Productivity goals",
  "chars": 929,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/guides/relationships/scaffold.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/guides/relationships",
  "file": "scaffold.md",
  "title": "Relationship goals",
  "chars": 1212,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/goals/guides/something_else/scaffold.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/goals/guides/something_else",
  "file": "scaffold.md",
  "title": "Custom goals",
  "chars": 155,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/google-calendar/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/google-calendar",
  "file": "SKILL.md",
  "title": "Google Calendar",
  "chars": 8555,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/google-contacts/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/google-contacts",
  "file": "SKILL.md",
  "title": "Google Contacts",
  "chars": 4508,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/google-docs/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/google-docs",
  "file": "SKILL.md",
  "title": "Google Docs",
  "chars": 4620,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/google-drive/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/google-drive",
  "file": "SKILL.md",
  "title": "Google Drive",
  "chars": 8227,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/google-forms/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/google-forms",
  "file": "SKILL.md",
  "title": "Google Forms",
  "chars": 3770,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/google-health-connect/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/google-health-connect",
  "file": "SKILL.md",
  "title": "Health Connect",
  "chars": 8861,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/google-sheets/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/google-sheets",
  "file": "SKILL.md",
  "title": "Google Sheets",
  "chars": 5442,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/google-slides/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/google-slides",
  "file": "SKILL.md",
  "title": "Google Slides",
  "chars": 4477,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/google-tasks/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/google-tasks",
  "file": "SKILL.md",
  "title": "Google Tasks",
  "chars": 5806,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/granola/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/granola",
  "file": "SKILL.md",
  "title": "Granola",
  "chars": 3221,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/healthex/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/healthex",
  "file": "SKILL.md",
  "title": "HealthEx (OAuth + MCP Health Records)",
  "chars": 14717,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/image-search/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/image-search",
  "file": "SKILL.md",
  "title": "Image Search",
  "chars": 3897,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/instagram-messages/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/instagram-messages",
  "file": "SKILL.md",
  "title": "Instagram Messages CLI",
  "chars": 10574,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/instagram/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/instagram",
  "file": "SKILL.md",
  "title": "Instagram CLI",
  "chars": 32517,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/instagram/references/account-insights-metrics.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/instagram/references",
  "file": "account-insights-metrics.md",
  "title": "Account insights metrics",
  "chars": 6624,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/instagram/references/content-questions.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/instagram/references",
  "file": "content-questions.md",
  "title": "Instagram content questions",
  "chars": 4931,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/klaviyo/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/klaviyo",
  "file": "SKILL.md",
  "title": "Klaviyo",
  "chars": 4396,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/linear/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/linear",
  "file": "SKILL.md",
  "title": "Linear",
  "chars": 2611,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/lovable/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/lovable",
  "file": "SKILL.md",
  "title": "Lovable",
  "chars": 1856,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/INSTALL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment",
  "file": "INSTALL.md",
  "title": "Installing magic-moment on a Muse VM",
  "chars": 2258,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment",
  "file": "SKILL.md",
  "title": "Magic Moment",
  "chars": 7564,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/guide/conversation_shape.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment/guide",
  "file": "conversation_shape.md",
  "title": "Conversation and pacing",
  "chars": 2021,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/guide/screenplay.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment/guide",
  "file": "screenplay.md",
  "title": "Screenplay: Dramatize the Interaction, Don't Caption the Narration",
  "chars": 7919,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/guide/screenplay_review.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment/guide",
  "file": "screenplay_review.md",
  "title": "Review the exact build",
  "chars": 3509,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/guide/story_and_canon.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment/guide",
  "file": "story_and_canon.md",
  "title": "Preserve the source story",
  "chars": 2302,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/guide/timeline.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment/guide",
  "file": "timeline.md",
  "title": "Source and timing",
  "chars": 1918,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/guide/visuals.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment/guide",
  "file": "visuals.md",
  "title": "Choose visuals from the evidence",
  "chars": 5479,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/reference/card-spec.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment/reference",
  "file": "card-spec.md",
  "title": "Card Spec — proof artifact cards + the web-artifact process",
  "chars": 6439,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/reference/design.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment/reference",
  "file": "design.md",
  "title": "Design Spec — the Muse Moments Kit is the design system",
  "chars": 26388,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/reference/overlay-spec.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment/reference",
  "file": "overlay-spec.md",
  "title": "Overlay Spec — deterministic bubble renderer",
  "chars": 5565,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/magic-moment/reference/visual-storytelling.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/magic-moment/reference",
  "file": "visual-storytelling.md",
  "title": "Compose the story visually",
  "chars": 3292,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/media-library/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/media-library",
  "file": "SKILL.md",
  "title": "Media Library",
  "chars": 5779,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/messenger/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/messenger",
  "file": "SKILL.md",
  "title": "Messenger",
  "chars": 23817,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads",
  "file": "SKILL.md",
  "title": "Meta Ads",
  "chars": 28747,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/eval/current-stack-canary.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/eval",
  "file": "current-stack-canary.md",
  "title": "Meta Ads current-stack canary",
  "chars": 4786,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/account-scope.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "account-scope.md",
  "title": "Meta Ads — account and object scope",
  "chars": 7525,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/analysis.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "analysis.md",
  "title": "Meta Ads — analytical substance",
  "chars": 21260,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/campaign-budget.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "campaign-budget.md",
  "title": "Campaign budget",
  "chars": 13078,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/campaign-creation.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "campaign-creation.md",
  "title": "Meta Ads — complete campaign creation",
  "chars": 8027,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/campaign-creative.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "campaign-creative.md",
  "title": "Campaign creative",
  "chars": 17625,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/campaign-delivery-compatibility.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "campaign-delivery-compatibility.md",
  "title": "Campaign delivery compatibility",
  "chars": 6819,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/campaign-execution.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "campaign-execution.md",
  "title": "Campaign review and execution",
  "chars": 10562,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/campaign-guided.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "campaign-guided.md",
  "title": "Campaign planning — explicit guided mode",
  "chars": 4328,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/campaign-handoff.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "campaign-handoff.md",
  "title": "Campaign handoff",
  "chars": 4198,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/campaign-manual-setup.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "campaign-manual-setup.md",
  "title": "Campaign setup the advertiser completes in Ads Manager",
  "chars": 4346,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/campaign-planning.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "campaign-planning.md",
  "title": "Campaign planning — full research",
  "chars": 18304,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/campaign-targeting.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "campaign-targeting.md",
  "title": "Campaign targeting resolution",
  "chars": 2150,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/evidence.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "evidence.md",
  "title": "Meta Ads — grounding and evidence",
  "chars": 12681,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/policy.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "policy.md",
  "title": "Meta Ads — policy retrieval",
  "chars": 9504,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/response-style.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "response-style.md",
  "title": "Meta Ads — response style and metric wording",
  "chars": 36564,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/safety.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "safety.md",
  "title": "Meta Ads — safety and compliance boundaries",
  "chars": 18651,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/tool-routing.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "tool-routing.md",
  "title": "Meta Ads — choosing the right tool and arguments",
  "chars": 30779,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-ads/references/writes.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-ads/references",
  "file": "writes.md",
  "title": "Meta Ads — changing things",
  "chars": 56094,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/meta-threads/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/meta-threads",
  "file": "SKILL.md",
  "title": "Threads CLI",
  "chars": 20209,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/muse-early-access/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/muse-early-access",
  "file": "SKILL.md",
  "title": "Muse early access",
  "chars": 2795,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/muse-feedback/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/muse-feedback",
  "file": "SKILL.md",
  "title": "Muse feedback",
  "chars": 10748,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/muse_db/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/muse_db",
  "file": "SKILL.md",
  "title": "Database inspection with `muse.db`",
  "chars": 2068,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/muse_db/references/schema.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/muse_db/references",
  "file": "schema.md",
  "title": "PostgreSQL schema for `muse.db`",
  "chars": 198354,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/notion/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/notion",
  "file": "SKILL.md",
  "title": "Notion",
  "chars": 2625,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/opentable/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/opentable",
  "file": "SKILL.md",
  "title": "OpenTable",
  "chars": 9376,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/outlook-calendar/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/outlook-calendar",
  "file": "SKILL.md",
  "title": "Outlook Calendar",
  "chars": 5109,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/outlook-contacts/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/outlook-contacts",
  "file": "SKILL.md",
  "title": "Outlook Contacts",
  "chars": 3494,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/outlook-mail/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/outlook-mail",
  "file": "SKILL.md",
  "title": "Outlook Mail",
  "chars": 5290,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/peloton/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/peloton",
  "file": "SKILL.md",
  "title": "Peloton",
  "chars": 6243,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/philips-hue/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/philips-hue",
  "file": "SKILL.md",
  "title": "Philips Hue (Smart Lighting)",
  "chars": 3486,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/places-search/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/places-search",
  "file": "SKILL.md",
  "title": "Places",
  "chars": 6900,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/plaid/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/plaid",
  "file": "SKILL.md",
  "title": "Plaid",
  "chars": 8184,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/podcast/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/podcast",
  "file": "SKILL.md",
  "title": "Generate Podcast",
  "chars": 26065,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/printify/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/printify",
  "file": "SKILL.md",
  "title": "Printify (Print on Demand)",
  "chars": 3188,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/quickbooks/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/quickbooks",
  "file": "SKILL.md",
  "title": "QuickBooks",
  "chars": 7714,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/replit/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/replit",
  "file": "SKILL.md",
  "title": "Replit",
  "chars": 1627,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/self-awareness/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/self-awareness",
  "file": "SKILL.md",
  "title": "Self-Awareness",
  "chars": 1838,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/self-awareness/references/extensions.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/self-awareness/references",
  "file": "extensions.md",
  "title": "Optional Self-Awareness Extensions",
  "chars": 1021,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/self-awareness/references/question_types.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/self-awareness/references",
  "file": "question_types.md",
  "title": "Self-Awareness Question Types",
  "chars": 2706,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/share-ideas/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/share-ideas",
  "file": "SKILL.md",
  "title": "Share ideas",
  "chars": 2372,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/shopify/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/shopify",
  "file": "SKILL.md",
  "title": "Shopify",
  "chars": 7847,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/shopping/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/shopping",
  "file": "SKILL.md",
  "title": "Shopping",
  "chars": 35496,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/shopping/references/backends.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/shopping/references",
  "file": "backends.md",
  "title": "Shopping Backends",
  "chars": 1738,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/shopping/references/browser-checkout.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/shopping/references",
  "file": "browser-checkout.md",
  "title": "Browser Checkout",
  "chars": 3490,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/shopping/references/shopify-ucp.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/shopping/references",
  "file": "shopify-ucp.md",
  "title": "Shopify UCP Checkout",
  "chars": 18513,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/skill-creator/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/skill-creator",
  "file": "SKILL.md",
  "title": "Skill Creator",
  "chars": 3633,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/skill-creator/references/authoring_guide.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/skill-creator/references",
  "file": "authoring_guide.md",
  "title": "Skill Authoring Guide",
  "chars": 2585,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/slack/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/slack",
  "file": "SKILL.md",
  "title": "Slack",
  "chars": 1445,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/social-content-performance/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/social-content-performance",
  "file": "SKILL.md",
  "title": "Social Content Performance",
  "chars": 7844,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/spaces/templates/space-static/workspace_agents.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/spaces/templates/space-static",
  "file": "workspace_agents.md",
  "title": "Building this web artifact",
  "chars": 895,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/spaces/templates/space-ts/workspace_agents.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/spaces/templates/space-ts",
  "file": "workspace_agents.md",
  "title": "Building this web artifact",
  "chars": 1246,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/spaces/ts-runtime/README.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/spaces/ts-runtime",
  "file": "README.md",
  "title": "TypeScript Web Artifact Runtime",
  "chars": 5941,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/spaces/ts-runtime/docs/vertical-tool-schemas.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/spaces/ts-runtime/docs",
  "file": "vertical-tool-schemas.md",
  "title": "`ctx.tool` vertical schemas",
  "chars": 13709,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/spotify/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/spotify",
  "file": "SKILL.md",
  "title": "Spotify",
  "chars": 13002,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/stripe/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/stripe",
  "file": "SKILL.md",
  "title": "Stripe",
  "chars": 2228,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/subscription-status/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/subscription-status",
  "file": "SKILL.md",
  "title": "Subscription Status",
  "chars": 1384,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/tailscale/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/tailscale",
  "file": "SKILL.md",
  "title": "Tailscale",
  "chars": 703,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/tessie/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/tessie",
  "file": "SKILL.md",
  "title": "Tessie (Tesla Vehicle Control)",
  "chars": 2952,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/threads-messages/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/threads-messages",
  "file": "SKILL.md",
  "title": "Threads Messages CLI",
  "chars": 13332,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/threads/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/threads",
  "file": "SKILL.md",
  "title": "Threads CLI",
  "chars": 20209,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/ticketmaster/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/ticketmaster",
  "file": "SKILL.md",
  "title": "Ticketmaster",
  "chars": 9856,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/todoist/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/todoist",
  "file": "SKILL.md",
  "title": "Todoist",
  "chars": 1507,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/travel-planning/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/travel-planning",
  "file": "SKILL.md",
  "title": "Travel Planning",
  "chars": 19749,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/travel-planning/references/booking-handoff.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/travel-planning/references",
  "file": "booking-handoff.md",
  "title": "Planning-to-booking handoff",
  "chars": 7464,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/travel-planning/references/flight-itinerary-discovery.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/travel-planning/references",
  "file": "flight-itinerary-discovery.md",
  "title": "Flight itinerary discovery",
  "chars": 4164,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/travel-planning/references/operational-itinerary.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/travel-planning/references",
  "file": "operational-itinerary.md",
  "title": "Operational itinerary",
  "chars": 13299,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/travel-planning/references/planning-kickoff.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/travel-planning/references",
  "file": "planning-kickoff.md",
  "title": "Complex planning kickoff",
  "chars": 6955,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/travel-planning/references/travel-fact-verification.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/travel-planning/references",
  "file": "travel-fact-verification.md",
  "title": "Travel-fact verification",
  "chars": 4068,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/tts/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/tts",
  "file": "SKILL.md",
  "title": "TTS",
  "chars": 11194,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/vercel/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/vercel",
  "file": "SKILL.md",
  "title": "Vercel",
  "chars": 2434,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/voice-calls/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/voice-calls",
  "file": "SKILL.md",
  "title": "Voice Catalog Data",
  "chars": 560,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/voice-design/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/voice-design",
  "file": "SKILL.md",
  "title": "Voice design",
  "chars": 5652,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/voice-selector/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/voice-selector",
  "file": "SKILL.md",
  "title": "Voice Catalog Data",
  "chars": 560,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/wearable-device-skills/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/wearable-device-skills",
  "file": "SKILL.md",
  "title": "Wearable Device Skills",
  "chars": 3354,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/wearables-comms/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/wearables-comms",
  "file": "SKILL.md",
  "title": "Wearables Calls and Messages",
  "chars": 13982,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/wide-research/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/wide-research",
  "file": "SKILL.md",
  "title": "Wide Research",
  "chars": 1911,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/withings/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/withings",
  "file": "SKILL.md",
  "title": "Withings",
  "chars": 6073,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/withings/references/commands.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/withings/references",
  "file": "commands.md",
  "title": "Withings CLI Commands",
  "chars": 8484,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/zapier/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/zapier",
  "file": "SKILL.md",
  "title": "Zapier",
  "chars": 1312,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/skills/zoom/SKILL.md",
  "vendor": "Meta",
  "product": "muse-agent/skills/zoom",
  "file": "SKILL.md",
  "title": "Zoom",
  "chars": 2498,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/subscriptions/activity_feed/subscription.md",
  "vendor": "Meta",
  "product": "muse-agent/subscriptions/activity_feed",
  "file": "subscription.md",
  "title": "Activity Feed",
  "chars": 2288,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/subscriptions/device_syncs/subscription.md",
  "vendor": "Meta",
  "product": "muse-agent/subscriptions/device_syncs",
  "file": "subscription.md",
  "title": "Data Source Events",
  "chars": 1778,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/subscriptions/spaces_actions/subscription.md",
  "vendor": "Meta",
  "product": "muse-agent/subscriptions/spaces_actions",
  "file": "subscription.md",
  "title": "Web artifact actions",
  "chars": 1909,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/workspace/cron.d/minutely/heartbeat__interval@30m.md",
  "vendor": "Meta",
  "product": "muse-agent/workspace/cron.d/minutely",
  "file": "heartbeat__interval@30m.md",
  "title": "Meta/muse-agent/workspace/cron.d/minutely/heartbeat__interval@30m",
  "chars": 212,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-agent/workspace/system/system_prompt.md",
  "vendor": "Meta",
  "product": "muse-agent/workspace/system",
  "file": "system_prompt.md",
  "title": "Meta/muse-agent/workspace/system/system_prompt",
  "chars": 85404,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/muse-spark-1.3-muse-code.md",
  "vendor": "Meta",
  "product": "muse-code",
  "file": "muse-spark-1.3-muse-code.md",
  "title": "Valid recipients: \"self\", \"commentary\", \"user\".",
  "chars": 109352,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs",
  "file": "SKILL.md",
  "title": "Three.js",
  "chars": 1495,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/references/threejs-animation.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs/references",
  "file": "threejs-animation.md",
  "title": "Three.js Animation",
  "chars": 12557,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/references/threejs-fundamentals.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs/references",
  "file": "threejs-fundamentals.md",
  "title": "Three.js Fundamentals",
  "chars": 11520,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/references/threejs-geometry.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs/references",
  "file": "threejs-geometry.md",
  "title": "Three.js Geometry",
  "chars": 13829,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/references/threejs-interaction.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs/references",
  "file": "threejs-interaction.md",
  "title": "Three.js Interaction",
  "chars": 16318,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/references/threejs-lighting.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs/references",
  "file": "threejs-lighting.md",
  "title": "Three.js Lighting",
  "chars": 12027,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/references/threejs-loaders.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs/references",
  "file": "threejs-loaders.md",
  "title": "Three.js Loaders",
  "chars": 14032,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/references/threejs-materials.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs/references",
  "file": "threejs-materials.md",
  "title": "Three.js Materials",
  "chars": 13418,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/references/threejs-postprocessing.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs/references",
  "file": "threejs-postprocessing.md",
  "title": "Three.js Post-Processing",
  "chars": 14427,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/references/threejs-shaders.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs/references",
  "file": "threejs-shaders.md",
  "title": "Three.js Shaders",
  "chars": 14056,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/plugins/threejs/skills/threejs/references/threejs-textures.md",
  "vendor": "Meta",
  "product": "muse-code/plugins/threejs/skills/threejs/references",
  "file": "threejs-textures.md",
  "title": "Three.js Textures",
  "chars": 13643,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/prompts/approval-review-policy.md",
  "vendor": "Meta",
  "product": "muse-code/prompts",
  "file": "approval-review-policy.md",
  "title": "Built-in approval-review policy v1",
  "chars": 16256,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/prompts/compaction-remaining-work-addendum.md",
  "vendor": "Meta",
  "product": "muse-code/prompts",
  "file": "compaction-remaining-work-addendum.md",
  "title": "Meta/muse-code/prompts/compaction-remaining-work-addendum",
  "chars": 431,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/prompts/compaction.md",
  "vendor": "Meta",
  "product": "muse-code/prompts",
  "file": "compaction.md",
  "title": "Meta/muse-code/prompts/compaction",
  "chars": 2115,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/prompts/delegated-child-agent.md",
  "vendor": "Meta",
  "product": "muse-code/prompts",
  "file": "delegated-child-agent.md",
  "title": "Meta/muse-code/prompts/delegated-child-agent",
  "chars": 948,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/prompts/reminders/goal-reminder.md",
  "vendor": "Meta",
  "product": "muse-code/prompts/reminders",
  "file": "goal-reminder.md",
  "title": "Meta/muse-code/prompts/reminders/goal-reminder",
  "chars": 8691,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/prompts/reminders/scope-reminder.md",
  "vendor": "Meta",
  "product": "muse-code/prompts/reminders",
  "file": "scope-reminder.md",
  "title": "Meta/muse-code/prompts/reminders/scope-reminder",
  "chars": 3621,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/prompts/reminders/verify-reminder.md",
  "vendor": "Meta",
  "product": "muse-code/prompts/reminders",
  "file": "verify-reminder.md",
  "title": "Meta/muse-code/prompts/reminders/verify-reminder",
  "chars": 9360,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/CREDITS.md",
  "vendor": "Meta",
  "product": "muse-code/skills",
  "file": "CREDITS.md",
  "title": "Credits",
  "chars": 432,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/agents/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/agents",
  "file": "SKILL.md",
  "title": "agents",
  "chars": 11631,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/agents/references/allow-list.md",
  "vendor": "Meta",
  "product": "muse-code/skills/agents/references",
  "file": "allow-list.md",
  "title": "Allow-listable and prompted verbs",
  "chars": 7870,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/agents/references/coordinator.md",
  "vendor": "Meta",
  "product": "muse-code/skills/agents/references",
  "file": "coordinator.md",
  "title": "The moments",
  "chars": 8011,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/agents/references/open-and-ask.md",
  "vendor": "Meta",
  "product": "muse-code/skills/agents/references",
  "file": "open-and-ask.md",
  "title": "Opening, telling and arming — the mechanics",
  "chars": 6495,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/agents/references/roles.md",
  "vendor": "Meta",
  "product": "muse-code/skills/agents/references",
  "file": "roles.md",
  "title": "Roles: four brief templates",
  "chars": 7655,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/agents/references/session-protocol.md",
  "vendor": "Meta",
  "product": "muse-code/skills/agents/references",
  "file": "session-protocol.md",
  "title": "The inbox path (`TBH_AGENTS_SESSION_PROTOCOL`)",
  "chars": 3754,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/agents/references/verbs.md",
  "vendor": "Meta",
  "product": "muse-code/skills/agents/references",
  "file": "verbs.md",
  "title": "agents verb contract (`scripts/agents.py`)",
  "chars": 132147,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/browser-app-delivery/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/browser-app-delivery",
  "file": "SKILL.md",
  "title": "Browser App Delivery",
  "chars": 10280,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/create-plugin/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/create-plugin",
  "file": "SKILL.md",
  "title": "Create Plugin",
  "chars": 7251,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/create-plugin/references/native-plugin-contract.md",
  "vendor": "Meta",
  "product": "muse-code/skills/create-plugin/references",
  "file": "native-plugin-contract.md",
  "title": "Native Muse Plugin Contract",
  "chars": 4640,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/create-skill/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/create-skill",
  "file": "SKILL.md",
  "title": "Create Skill",
  "chars": 5683,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/doctor/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/doctor",
  "file": "SKILL.md",
  "title": "Diagnose",
  "chars": 14077,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/durable-test-collateral/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/durable-test-collateral",
  "file": "SKILL.md",
  "title": "Durable Test Collateral",
  "chars": 2748,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/fleet-manager/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/fleet-manager",
  "file": "SKILL.md",
  "title": "fleet-manager",
  "chars": 9809,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/fleet-manager/references/allow-list.md",
  "vendor": "Meta",
  "product": "muse-code/skills/fleet-manager/references",
  "file": "allow-list.md",
  "title": "Allow-list template",
  "chars": 2792,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/fleet-manager/references/getting-started.md",
  "vendor": "Meta",
  "product": "muse-code/skills/fleet-manager/references",
  "file": "getting-started.md",
  "title": "Getting started: nothing → first session in five steps",
  "chars": 4881,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/fleet-manager/references/provider-notes.md",
  "vendor": "Meta",
  "product": "muse-code/skills/fleet-manager/references",
  "file": "provider-notes.md",
  "title": "Provider notes: verified behaviours by version",
  "chars": 9634,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/fleet-manager/references/verbs.md",
  "vendor": "Meta",
  "product": "muse-code/skills/fleet-manager/references",
  "file": "verbs.md",
  "title": "fleet-manager verbs (`scripts/fleet_manager.py`)",
  "chars": 25902,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/git/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/git",
  "file": "SKILL.md",
  "title": "Git source-control safety",
  "chars": 4110,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/greenfield-project-scaffolding/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/greenfield-project-scaffolding",
  "file": "SKILL.md",
  "title": "Greenfield Project Scaffolding",
  "chars": 6211,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/grill-and-record/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/grill-and-record",
  "file": "SKILL.md",
  "title": "Grill and Record",
  "chars": 3645,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/grill/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/grill",
  "file": "SKILL.md",
  "title": "Grill",
  "chars": 6647,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/import/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/import",
  "file": "SKILL.md",
  "title": "Resume Third Party Session",
  "chars": 14025,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/manage-settings/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/manage-settings",
  "file": "SKILL.md",
  "title": "Manage Settings",
  "chars": 12386,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/migrate/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/migrate",
  "file": "SKILL.md",
  "title": "Migrate",
  "chars": 15211,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/plan/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/plan",
  "file": "SKILL.md",
  "title": "Plan",
  "chars": 20574,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/python-env/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/python-env",
  "file": "SKILL.md",
  "title": "Python environments",
  "chars": 2704,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/read-session/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/read-session",
  "file": "SKILL.md",
  "title": "Read Session",
  "chars": 9560,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/requirements-clarification/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/requirements-clarification",
  "file": "SKILL.md",
  "title": "Requirements Clarification",
  "chars": 2745,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/resume-claude/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/resume-claude",
  "file": "SKILL.md",
  "title": "Resume Claude Code",
  "chars": 2864,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/resume-codex/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/resume-codex",
  "file": "SKILL.md",
  "title": "Resume Codex",
  "chars": 2751,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/table-fit/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/table-fit",
  "file": "SKILL.md",
  "title": "Table Fit",
  "chars": 3087,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/taste/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/taste",
  "file": "SKILL.md",
  "title": "Anti-Slop: Frontend DON'Ts",
  "chars": 2023,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-code/skills/workflow-authoring/SKILL.md",
  "vendor": "Meta",
  "product": "muse-code/skills/workflow-authoring",
  "file": "SKILL.md",
  "title": "Workflow Authoring",
  "chars": 30190,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-spark-1.0-web.md",
  "vendor": "Meta",
  "product": "",
  "file": "muse-spark-1.0-web.md",
  "title": "Valid recipients: \"self\", None, \"media.*\", \"meta_1p.*\", \"container.*\", \"browser.*\", \"third",
  "chars": 56989,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Meta/muse-spark-1.1-web.md",
  "vendor": "Meta",
  "product": "",
  "file": "muse-spark-1.1-web.md",
  "title": "Shopping Skill - Full Instructions",
  "chars": 72391,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Microsoft/copilot-cli.md",
  "vendor": "Microsoft",
  "product": "",
  "file": "copilot-cli.md",
  "title": "Tone and style",
  "chars": 72626,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Microsoft/copilot-in-microsoft-word.md",
  "vendor": "Microsoft",
  "product": "",
  "file": "copilot-in-microsoft-word.md",
  "title": "Core Responding Instructions to Remember:",
  "chars": 15265,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Microsoft/copilot-macos-app.md",
  "vendor": "Microsoft",
  "product": "",
  "file": "copilot-macos-app.md",
  "title": "GitHub Copilot for macOS (Desktop App) System Instructions",
  "chars": 16418,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Microsoft/github-copilot.md",
  "vendor": "Microsoft",
  "product": "",
  "file": "github-copilot.md",
  "title": "Microsoft/github-copilot",
  "chars": 35869,
  "vendored": true,
  "slug": "Microsoft-github-copilot"
 },
 {
  "path": "Microsoft/vscode-copilot-agent.md",
  "vendor": "Microsoft",
  "product": "",
  "file": "vscode-copilot-agent.md",
  "title": "GitHub Copilot CLI System Prompt (v1.0.39)",
  "chars": 11063,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/amp-code.md",
  "vendor": "Misc",
  "product": "",
  "file": "amp-code.md",
  "title": "Amp CLI System Prompts",
  "chars": 54593,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/brave-search.md",
  "vendor": "Misc",
  "product": "",
  "file": "brave-search.md",
  "title": "Misc/brave-search",
  "chars": 138,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/character-ai.md",
  "vendor": "Misc",
  "product": "",
  "file": "character-ai.md",
  "title": "The character info",
  "chars": 1294,
  "vendored": true,
  "slug": "Misc-character-ai"
 },
 {
  "path": "Misc/commandcode-cli.md",
  "vendor": "Misc",
  "product": "",
  "file": "commandcode-cli.md",
  "title": "Misc/commandcode-cli",
  "chars": 34431,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/confer.md",
  "vendor": "Misc",
  "product": "",
  "file": "confer.md",
  "title": "Tools",
  "chars": 4171,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/devin-cli.md",
  "vendor": "Misc",
  "product": "",
  "file": "devin-cli.md",
  "title": "Modes",
  "chars": 17985,
  "vendored": true,
  "slug": "Misc-devin-cli"
 },
 {
  "path": "Misc/docker-gordon-ai.md",
  "vendor": "Misc",
  "product": "",
  "file": "docker-gordon-ai.md",
  "title": "Misc/docker-gordon-ai",
  "chars": 41363,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/elevenlabs-voice-agent.md",
  "vendor": "Misc",
  "product": "",
  "file": "elevenlabs-voice-agent.md",
  "title": "Misc/elevenlabs-voice-agent",
  "chars": 2939,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/fellou-browser.md",
  "vendor": "Misc",
  "product": "",
  "file": "fellou-browser.md",
  "title": "Tools",
  "chars": 22772,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/gizmo-ai.md",
  "vendor": "Misc",
  "product": "",
  "file": "gizmo-ai.md",
  "title": "Misc/gizmo-ai",
  "chars": 6077,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/hermes.md",
  "vendor": "Misc",
  "product": "",
  "file": "hermes.md",
  "title": "SOUL.md - Who You Are",
  "chars": 17541,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/indus-ai.md",
  "vendor": "Misc",
  "product": "",
  "file": "indus-ai.md",
  "title": "Misc/indus-ai",
  "chars": 16727,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/kagi-assistant.md",
  "vendor": "Misc",
  "product": "",
  "file": "kagi-assistant.md",
  "title": "Misc/kagi-assistant",
  "chars": 5255,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/minimax-m2.5.md",
  "vendor": "Misc",
  "product": "",
  "file": "minimax-m2.5.md",
  "title": "Misc/minimax-m2.5",
  "chars": 5174,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/proton-lumo-ai.md",
  "vendor": "Misc",
  "product": "",
  "file": "proton-lumo-ai.md",
  "title": "Lumo System Prompt",
  "chars": 11535,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/raycast-ai.md",
  "vendor": "Misc",
  "product": "",
  "file": "raycast-ai.md",
  "title": "Misc/raycast-ai",
  "chars": 1173,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/reddit-answers.md",
  "vendor": "Misc",
  "product": "",
  "file": "reddit-answers.md",
  "title": "SEARCH TOOL EXECUTION",
  "chars": 3696,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/sesame-ai-maya.md",
  "vendor": "Misc",
  "product": "",
  "file": "sesame-ai-maya.md",
  "title": "Misc/sesame-ai-maya",
  "chars": 15569,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/stack-overflow-ai-assist.md",
  "vendor": "Misc",
  "product": "",
  "file": "stack-overflow-ai-assist.md",
  "title": "Misc/stack-overflow-ai-assist",
  "chars": 6339,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/t3-code.md",
  "vendor": "Misc",
  "product": "",
  "file": "t3-code.md",
  "title": "Plan Mode (Conversational)",
  "chars": 10055,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/t3.chat.md",
  "vendor": "Misc",
  "product": "",
  "file": "t3.chat.md",
  "title": "Misc/t3.chat",
  "chars": 2362,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/warp-2.0-agent.md",
  "vendor": "Misc",
  "product": "",
  "file": "warp-2.0-agent.md",
  "title": "Question",
  "chars": 13734,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Misc/zed.md",
  "vendor": "Misc",
  "product": "",
  "file": "zed.md",
  "title": "First Header",
  "chars": 29578,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Mistral/mistral-code.md",
  "vendor": "Mistral",
  "product": "",
  "file": "mistral-code.md",
  "title": "Note: The bash tool operates in a *sandboxed* environment with the following restrictions:",
  "chars": 13583,
  "vendored": true,
  "slug": "Mistral-mistral-code"
 },
 {
  "path": "Mistral/mistral-medium-3.5.md",
  "vendor": "Mistral",
  "product": "",
  "file": "mistral-medium-3.5.md",
  "title": "General guidelines",
  "chars": 21945,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Notion/notion-ai.md",
  "vendor": "Notion",
  "product": "",
  "file": "notion-ai.md",
  "title": "AI",
  "chars": 46728,
  "vendored": true,
  "slug": "Notion-notion-ai"
 },
 {
  "path": "OpenAI/4o-2025-09-03-new-personality.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "4o-2025-09-03-new-personality.md",
  "title": "OpenAI/4o-2025-09-03-new-personality",
  "chars": 2669,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/API/README.md",
  "vendor": "OpenAI",
  "product": "API",
  "file": "README.md",
  "title": "Valid channels: analysis, commentary, final. Channel must be included for every message.",
  "chars": 2192,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/API/gpt-5-reasoning-effort-high-api.md",
  "vendor": "OpenAI",
  "product": "API",
  "file": "gpt-5-reasoning-effort-high-api.md",
  "title": "Desired oververbosity for the final answer (not analysis): 3",
  "chars": 1114,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/API/o3-high-api.md",
  "vendor": "OpenAI",
  "product": "API",
  "file": "o3-high-api.md",
  "title": "Valid channels: analysis, final. Channel must be included for every message.",
  "chars": 878,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/API/o3-low-api.md",
  "vendor": "OpenAI",
  "product": "API",
  "file": "o3-low-api.md",
  "title": "Valid channels: analysis, final. Channel must be included for every message.",
  "chars": 877,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/API/o3-medium-api.md",
  "vendor": "OpenAI",
  "product": "API",
  "file": "o3-medium-api.md",
  "title": "Valid channels: analysis, final. Channel must be included for every message.",
  "chars": 877,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/API/o4-mini-high.md",
  "vendor": "OpenAI",
  "product": "API",
  "file": "o4-mini-high.md",
  "title": "Valid channels: analysis, final. Channel must be included for every message.",
  "chars": 878,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/API/o4-mini-low-api.md",
  "vendor": "OpenAI",
  "product": "API",
  "file": "o4-mini-low-api.md",
  "title": "Valid channels: analysis, final. Channel must be included for every message.",
  "chars": 877,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/API/o4-mini-medium-api.md",
  "vendor": "OpenAI",
  "product": "API",
  "file": "o4-mini-medium-api.md",
  "title": "Valid channels: analysis, final. Channel must be included for every message.",
  "chars": 877,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/codex-auto-review.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "codex-auto-review.md",
  "title": "General",
  "chars": 12896,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/codex-desktop-realtime-voice-agent.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "codex-desktop-realtime-voice-agent.md",
  "title": "OpenAI/Codex/codex-desktop-realtime-voice-agent",
  "chars": 2544,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/codex-full.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "codex-full.md",
  "title": "SYSTEM INSTRUCTIONS",
  "chars": 359517,
  "vendored": true,
  "slug": "OpenAI-Codex-codex-full"
 },
 {
  "path": "OpenAI/Codex/codex-thread-title.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "codex-thread-title.md",
  "title": "OpenAI/Codex/codex-thread-title",
  "chars": 3626,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/computer-use.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "computer-use.md",
  "title": "Computer Use",
  "chars": 6182,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/control-chrome.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "control-chrome.md",
  "title": "Chrome",
  "chars": 13507,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/control-in-app-browser.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "control-in-app-browser.md",
  "title": "Browser",
  "chars": 11146,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/gpt-5.3-codex-spark.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-5.3-codex-spark.md",
  "title": "General",
  "chars": 11966,
  "vendored": true,
  "slug": "OpenAI-Codex-gpt-5-3-codex-spark"
 },
 {
  "path": "OpenAI/Codex/gpt-5.4-mini.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-5.4-mini.md",
  "title": "General",
  "chars": 11114,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/gpt-5.4.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-5.4.md",
  "title": "General",
  "chars": 12896,
  "vendored": true,
  "slug": "OpenAI-Codex-gpt-5-4"
 },
 {
  "path": "OpenAI/Codex/gpt-5.5.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-5.5.md",
  "title": "General",
  "chars": 19754,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/gpt-5.6.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-5.6.md",
  "title": "Personality",
  "chars": 17753,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/gpt-6-astra-chatgpt-work-local.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-6-astra-chatgpt-work-local.md",
  "title": "When to ask the user for permission",
  "chars": 392107,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/gpt-6-astra.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-6-astra.md",
  "title": "When to ask the user for permission",
  "chars": 479803,
  "vendored": true,
  "slug": "OpenAI-Codex-gpt-6-astra"
 },
 {
  "path": "OpenAI/Codex/gpt-6-luna.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-6-luna.md",
  "title": "Personality",
  "chars": 476082,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/gpt-6-sol.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-6-sol.md",
  "title": "Personality",
  "chars": 477037,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/gpt-6.1-sol-chatgpt-work-local.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-6.1-sol-chatgpt-work-local.md",
  "title": "When to ask the user for permission",
  "chars": 506778,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/gpt-6.1-sol.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "gpt-6.1-sol.md",
  "title": "When to ask the user for permission",
  "chars": 503559,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/gpt-5-codex-mini.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "gpt-5-codex-mini.md",
  "title": "OpenAI Codex — gpt-5-codex-mini",
  "chars": 6993,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/gpt-5-codex.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "gpt-5-codex.md",
  "title": "OpenAI Codex — gpt-5-codex",
  "chars": 6948,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/gpt-5.1-codex-max.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "gpt-5.1-codex-max.md",
  "title": "OpenAI Codex — gpt-5.1-codex-max",
  "chars": 7932,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/gpt-5.1-codex-mini.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "gpt-5.1-codex-mini.md",
  "title": "OpenAI Codex — gpt-5.1-codex-mini",
  "chars": 6997,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/gpt-5.1-codex.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "gpt-5.1-codex.md",
  "title": "OpenAI Codex — gpt-5.1-codex",
  "chars": 6952,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/gpt-5.1.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "gpt-5.1.md",
  "title": "OpenAI Codex — gpt-5.1",
  "chars": 24397,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/gpt-5.2-codex.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "gpt-5.2-codex.md",
  "title": "OpenAI Codex — gpt-5.2-codex",
  "chars": 7909,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/gpt-5.2.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "gpt-5.2.md",
  "title": "How you work",
  "chars": 21544,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/gpt-5.3-codex.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "gpt-5.3-codex.md",
  "title": "General",
  "chars": 10507,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/gpt-5.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "gpt-5.md",
  "title": "OpenAI Codex — gpt-5",
  "chars": 21118,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/personality_friendly_gpt-5.2-codex.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "personality_friendly_gpt-5.2-codex.md",
  "title": "Codex Personality — Friendly",
  "chars": 3360,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/old/personality_pragmatic_gpt-5.2-codex.md",
  "vendor": "OpenAI",
  "product": "Codex/old",
  "file": "personality_pragmatic_gpt-5.2-codex.md",
  "title": "Codex Personality — Pragmatic",
  "chars": 2069,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/personality_friendly.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "personality_friendly.md",
  "title": "Codex Personality — Friendly",
  "chars": 2714,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/personality_friendly_gpt-5.5.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "personality_friendly_gpt-5.5.md",
  "title": "Codex Personality — Friendly",
  "chars": 1941,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/personality_pragmatic.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "personality_pragmatic.md",
  "title": "Codex Personality — Pragmatic",
  "chars": 2150,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/personality_pragmatic_gpt-5.5.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "personality_pragmatic_gpt-5.5.md",
  "title": "Codex Personality — Pragmatic",
  "chars": 1818,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Codex/plan_mode.md",
  "vendor": "OpenAI",
  "product": "Codex",
  "file": "plan_mode.md",
  "title": "Plan Mode (Conversational)",
  "chars": 8748,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/chatgpt-4o-mini.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "chatgpt-4o-mini.md",
  "title": "Tools",
  "chars": 6952,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/chatgpt.com-o4-mini.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "chatgpt.com-o4-mini.md",
  "title": "Tools",
  "chars": 15706,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/gpt-4o-whatsapp.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "gpt-4o-whatsapp.md",
  "title": "OpenAI/Old/gpt-4o-whatsapp",
  "chars": 2626,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/image-safety-policies.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "image-safety-policies.md",
  "title": "OpenAI/Old/image-safety-policies",
  "chars": 1735,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/monday-gpt.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "monday-gpt.md",
  "title": "OpenAI/Old/monday-gpt",
  "chars": 7806,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/o3.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "o3.md",
  "title": "Penalty for oververbosity: 3.0.",
  "chars": 32193,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/o4-mini.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "o4-mini.md",
  "title": "Tools",
  "chars": 30572,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/prompt-automation-context.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "prompt-automation-context.md",
  "title": "OpenAI/Old/prompt-automation-context",
  "chars": 1004,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/prompt-image-safety-policies.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "prompt-image-safety-policies.md",
  "title": "OpenAI/Old/prompt-image-safety-policies",
  "chars": 1060,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/study-and-learn.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "study-and-learn.md",
  "title": "OpenAI/Old/study-and-learn",
  "chars": 2680,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/tool-canvas-canmore.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "tool-canvas-canmore.md",
  "title": "The `canmore` tool creates and updates textdocs that are shown in a \"canvas\" next to the c",
  "chars": 2888,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/tool-create-image-image_gen.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "tool-create-image-image_gen.md",
  "title": "OpenAI/Old/tool-create-image-image_gen",
  "chars": 1998,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/tool-file_search.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "tool-file_search.md",
  "title": "OpenAI/Old/tool-file_search",
  "chars": 8159,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/tool-python-code.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "tool-python-code.md",
  "title": "OpenAI/Old/tool-python-code",
  "chars": 984,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/Old/tool-web-search.md",
  "vendor": "OpenAI",
  "product": "Old",
  "file": "tool-web-search.md",
  "title": "OpenAI/Old/tool-web-search",
  "chars": 1389,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/README.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "README.md",
  "title": "OpenAI — which file is which product?",
  "chars": 987,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/chatgpt-4.5.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "chatgpt-4.5.md",
  "title": "Model Response Spec",
  "chars": 31302,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/chatgpt-4o-deprecation-preparedness-prompt.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "chatgpt-4o-deprecation-preparedness-prompt.md",
  "title": "OpenAI/chatgpt-4o-deprecation-preparedness-prompt",
  "chars": 2021,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/chatgpt-atlas.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "chatgpt-atlas.md",
  "title": "Instructions",
  "chars": 3159,
  "vendored": true,
  "slug": "OpenAI-chatgpt-atlas"
 },
 {
  "path": "OpenAI/chatgpt-gpt-5-agent-mode.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "chatgpt-gpt-5-agent-mode.md",
  "title": "Financial activities",
  "chars": 21381,
  "vendored": true,
  "slug": "OpenAI-chatgpt-gpt-5-agent-mode"
 },
 {
  "path": "OpenAI/chatgpt-personality-instructions.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "chatgpt-personality-instructions.md",
  "title": "OpenAI/chatgpt-personality-instructions",
  "chars": 7946,
  "vendored": true,
  "slug": "OpenAI-chatgpt-personality-instructions"
 },
 {
  "path": "OpenAI/dots/available-skills.md",
  "vendor": "OpenAI",
  "product": "dots",
  "file": "available-skills.md",
  "title": "OpenAI/dots/available-skills",
  "chars": 17101,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/dreamer.md",
  "vendor": "OpenAI",
  "product": "dots",
  "file": "dreamer.md",
  "title": "Your role",
  "chars": 21171,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/action-items/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/action-items",
  "file": "SKILL.md",
  "title": "Action items",
  "chars": 19501,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/docs-artifact/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/docs-artifact",
  "file": "SKILL.md",
  "title": "Document Artifacts",
  "chars": 5840,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/document-signing/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/document-signing",
  "file": "SKILL.md",
  "title": "Document signing",
  "chars": 6132,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/documents/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/documents",
  "file": "SKILL.md",
  "title": "Documents",
  "chars": 4842,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/email/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/email",
  "file": "SKILL.md",
  "title": "Email",
  "chars": 14114,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/faq/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/faq",
  "file": "SKILL.md",
  "title": "dot FAQ",
  "chars": 9776,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/flights/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/flights",
  "file": "SKILL.md",
  "title": "Flights",
  "chars": 8488,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/food-ordering/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/food-ordering",
  "file": "SKILL.md",
  "title": "Food ordering",
  "chars": 5795,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/form-filling/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/form-filling",
  "file": "SKILL.md",
  "title": "Form filling",
  "chars": 1598,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/library/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/library",
  "file": "SKILL.md",
  "title": "ChatGPT Library",
  "chars": 16143,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/maintain-space/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/maintain-space",
  "file": "SKILL.md",
  "title": "Maintain page content",
  "chars": 6398,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/manage-schedules/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/manage-schedules",
  "file": "SKILL.md",
  "title": "Manage schedules for this page",
  "chars": 7653,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/o-computer-personalization/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/o-computer-personalization",
  "file": "SKILL.md",
  "title": "OpenAI/dots/skills/o-computer-personalization/SKILL",
  "chars": 276,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/organize-space/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/organize-space",
  "file": "SKILL.md",
  "title": "Organize pages",
  "chars": 6597,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/presentations/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/presentations",
  "file": "SKILL.md",
  "title": "Presentations",
  "chars": 3431,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/remote-environments/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/remote-environments",
  "file": "SKILL.md",
  "title": "Remote environments",
  "chars": 5675,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/restaurant-booking/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/restaurant-booking",
  "file": "SKILL.md",
  "title": "Restaurant Booking",
  "chars": 10292,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/restaurant-recommendations/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/restaurant-recommendations",
  "file": "SKILL.md",
  "title": "Restaurant Recommendations",
  "chars": 3017,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/scheduling/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/scheduling",
  "file": "SKILL.md",
  "title": "Scheduling",
  "chars": 5554,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/secure-me/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/secure-me",
  "file": "SKILL.md",
  "title": "dot Secure Me",
  "chars": 5284,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/sheets-artifact/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/sheets-artifact",
  "file": "SKILL.md",
  "title": "Spreadsheet Artifacts",
  "chars": 4928,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/shopping/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/shopping",
  "file": "SKILL.md",
  "title": "Shopping",
  "chars": 14618,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/sites/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/sites",
  "file": "SKILL.md",
  "title": "Sites with your dot",
  "chars": 6228,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/slack/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/slack",
  "file": "SKILL.md",
  "title": "dot on Slack",
  "chars": 4295,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/slides-artifact/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/slides-artifact",
  "file": "SKILL.md",
  "title": "Slide Artifacts",
  "chars": 5976,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/software-engineering/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/software-engineering",
  "file": "SKILL.md",
  "title": "Software Engineering",
  "chars": 22142,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/write-page/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/write-page",
  "file": "SKILL.md",
  "title": "Write and edit a page",
  "chars": 11636,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/skills/writing-style/SKILL.md",
  "vendor": "OpenAI",
  "product": "dots/skills/writing-style",
  "file": "SKILL.md",
  "title": "Writing style",
  "chars": 5211,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/tools.md",
  "vendor": "OpenAI",
  "product": "dots",
  "file": "tools.md",
  "title": "OpenAI/dots/tools",
  "chars": 15905,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/dots/voice.md",
  "vendor": "OpenAI",
  "product": "dots",
  "file": "voice.md",
  "title": "OpenAI/dots/voice",
  "chars": 31778,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-4.1-mini.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-4.1-mini.md",
  "title": "Tools",
  "chars": 4865,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-4.1.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-4.1.md",
  "title": "Tools",
  "chars": 12914,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-4.5.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-4.5.md",
  "title": "OpenAI/gpt-4.5",
  "chars": 11018,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-4o-advanced-voice-mode.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-4o-advanced-voice-mode.md",
  "title": "OpenAI/gpt-4o-advanced-voice-mode",
  "chars": 2208,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-4o-legacy-voice-mode.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-4o-legacy-voice-mode.md",
  "title": "Tools",
  "chars": 5843,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-4o.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-4o.md",
  "title": "Model Response Spec",
  "chars": 31575,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5-listener-personality.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5-listener-personality.md",
  "title": "OpenAI/gpt-5-listener-personality",
  "chars": 2147,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5-nerdy-personality.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5-nerdy-personality.md",
  "title": "OpenAI/gpt-5-nerdy-personality",
  "chars": 3199,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5-robot-personality.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5-robot-personality.md",
  "title": "OpenAI/gpt-5-robot-personality",
  "chars": 2577,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5-thinking.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5-thinking.md",
  "title": "Desired oververbosity for the final answer (not analysis): 3",
  "chars": 78961,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.1-efficient.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.1-efficient.md",
  "title": "OpenAI/gpt-5.1-efficient",
  "chars": 1103,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.1-nerdy.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.1-nerdy.md",
  "title": "OpenAI/gpt-5.1-nerdy",
  "chars": 3492,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.1-professional.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.1-professional.md",
  "title": "OpenAI/gpt-5.1-professional",
  "chars": 1058,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.2-mini-free-account.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.2-mini-free-account.md",
  "title": "Model Response Spec",
  "chars": 4590,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.2-thinking.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.2-thinking.md",
  "title": "Model Response Spec",
  "chars": 70017,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.3-chat-api.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.3-chat-api.md",
  "title": "Desired oververbosity for the final answer (not analysis): 0.0",
  "chars": 2200,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.3-codex-api.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.3-codex-api.md",
  "title": "Valid channels: analysis, commentary, final. Channel must be included for every message.",
  "chars": 194,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.3-instant.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.3-instant.md",
  "title": "Model Response Spec",
  "chars": 76029,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.4-api.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.4-api.md",
  "title": "Desired oververbosity for the final answer (not analysis):  1 (low), 3 (medium), 7 (high)",
  "chars": 864,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.4-thinking.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.4-thinking.md",
  "title": "Artifacts",
  "chars": 98177,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.5-api.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.5-api.md",
  "title": "Desired oververbosity for the final answer (not analysis):  1 (low), 3 (medium), 7 (high)",
  "chars": 862,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.5-instant.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.5-instant.md",
  "title": "Additional Extensive User Context Source (personal_context)",
  "chars": 84835,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.5-pro-api.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.5-pro-api.md",
  "title": "Desired oververbosity for the final answer (not analysis):  1 (low), 3 (medium), 7 (high)",
  "chars": 835,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.5-thinking.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.5-thinking.md",
  "title": "Environment",
  "chars": 115924,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/gpt-5.6-sol.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "gpt-5.6-sol.md",
  "title": "Environment",
  "chars": 126855,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/tool-advanced-memory.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "tool-advanced-memory.md",
  "title": "Assistant Response Preferences",
  "chars": 6092,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "OpenAI/tool-deep-research.md",
  "vendor": "OpenAI",
  "product": "",
  "file": "tool-deep-research.md",
  "title": "OpenAI/tool-deep-research",
  "chars": 2556,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Perplexity/comet-browser-assistant.md",
  "vendor": "Perplexity",
  "product": "",
  "file": "comet-browser-assistant.md",
  "title": "Instructions",
  "chars": 25372,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Perplexity/deep-research.md",
  "vendor": "Perplexity",
  "product": "",
  "file": "deep-research.md",
  "title": "Cell 1",
  "chars": 30168,
  "vendored": true,
  "slug": "Perplexity-deep-research"
 },
 {
  "path": "Perplexity/perplexity-ai.md",
  "vendor": "Perplexity",
  "product": "",
  "file": "perplexity-ai.md",
  "title": "Personalization Guidelines",
  "chars": 7864,
  "vendored": true,
  "slug": "Perplexity-perplexity-ai"
 },
 {
  "path": "Perplexity/perplexity-computer.md",
  "vendor": "Perplexity",
  "product": "",
  "file": "perplexity-computer.md",
  "title": "Perplexity/perplexity-computer",
  "chars": 38183,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Perplexity/voice-assistant.md",
  "vendor": "Perplexity",
  "product": "",
  "file": "voice-assistant.md",
  "title": "Task",
  "chars": 2082,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Pi/instructions.md",
  "vendor": "Pi",
  "product": "",
  "file": "instructions.md",
  "title": "Pi/instructions",
  "chars": 2785,
  "vendored": true,
  "slug": "Pi-instructions"
 },
 {
  "path": "Qwen/qwen3.6-plus.md",
  "vendor": "Qwen",
  "product": "",
  "file": "qwen3.6-plus.md",
  "title": "Qwen/qwen3.6-plus",
  "chars": 6703,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "Qwen/qwen3.8-max.md",
  "vendor": "Qwen",
  "product": "",
  "file": "qwen3.8-max.md",
  "title": "Tools",
  "chars": 2415,
  "vendored": true,
  "slug": "Qwen-qwen3-8-max"
 },
 {
  "path": "README.md",
  "vendor": "README.md",
  "product": "",
  "title": "System Prompts Leaks",
  "chars": 37365,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-3.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-3.md",
  "title": "xAI/grok-3",
  "chars": 4259,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-4-with-new-safety-instructions.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-4-with-new-safety-instructions.md",
  "title": "xAI/grok-4-with-new-safety-instructions",
  "chars": 20203,
  "vendored": true,
  "slug": "xAI-grok-4-with-new-safety-instructions"
 },
 {
  "path": "xAI/grok-4.1-beta.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-4.1-beta.md",
  "title": "xAI/grok-4.1-beta",
  "chars": 14599,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-4.2.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-4.2.md",
  "title": "xAI/grok-4.2",
  "chars": 17303,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-4.3-beta.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-4.3-beta.md",
  "title": "xAI/grok-4.3-beta",
  "chars": 27178,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-4.5.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-4.5.md",
  "title": "User Memory",
  "chars": 36128,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-4.6.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-4.6.md",
  "title": "xAI/grok-4.6",
  "chars": 35751,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-4.7-cli.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-4.7-cli.md",
  "title": "Global memory index",
  "chars": 77686,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-4.7.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-4.7.md",
  "title": "xAI/grok-4.7",
  "chars": 45164,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-4.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-4.md",
  "title": "xAI/grok-4",
  "chars": 12225,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-account.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-account.md",
  "title": "xAI/grok-account",
  "chars": 3235,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-api.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-api.md",
  "title": "xAI/grok-api",
  "chars": 790,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-bot.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-bot.md",
  "title": "1. System Prompt",
  "chars": 305343,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-build.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-build.md",
  "title": "App Builder Workspace",
  "chars": 130449,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-expert.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-expert.md",
  "title": "xAI/grok-expert",
  "chars": 21010,
  "vendored": false,
  "slug": ""
 },
 {
  "path": "xAI/grok-personas.md",
  "vendor": "xAI",
  "product": "",
  "file": "grok-personas.md",
  "title": "❤️ Companion",
  "chars": 23649,
  "vendored": false,
  "slug": ""
 }
]
