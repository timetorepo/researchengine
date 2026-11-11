/**
 * Boot profiles: which tools a session may use, and how long a turn may run.
 *
 * Every plugin is loaded once, so there is one session store and one model
 * adapter. A profile decides what the model is offered and what it may call.
 * Profiles are data, so adding one does not touch the loop.
 */
export type ProfileId = 'minimal' | 'standard'

export interface Profile {
  title: string
  description: string
  /** Tool names offered to the model, and the only ones that will run in this profile. */
  tools: string[]
  /** Model calls allowed in one turn. */
  maxSteps: number
}

export const PROFILES: Record<ProfileId, Profile> = {
  minimal: {
    title: 'Minimal',
    description: 'Shell and a file editor, nothing else. The smallest loop.',
    tools: ['bash', 'str_replace_editor'],
    maxSteps: 12,
  },
  standard: {
    title: 'Standard',
    description: 'The full coding agent: shell, editor, and read-only file listing and reading.',
    tools: ['bash', 'str_replace_editor', 'list_files', 'read_file'],
    maxSteps: 25,
  },
}

export function isProfileId(v: unknown): v is ProfileId {
  return v === 'minimal' || v === 'standard'
}
