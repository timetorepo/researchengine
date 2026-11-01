/**
 * A prompt typed on the Coding start screen, waiting for its project.
 *
 * The start screen creates the project and opens it. The agent panel for that
 * project then takes the prompt once and sends it as a build request, so the
 * user never has to create a project first. A module-level map is enough: the
 * prompt lives for one hand-off and is removed the moment it is taken.
 */

const pending = new Map<string, string>()

export function queueBuild(project: string, prompt: string): void {
  pending.set(project, prompt)
}

/** True while a prompt is waiting for this project. Does not consume it. */
export function hasBuild(project: string): boolean {
  return pending.has(project)
}

/** Returns the queued prompt once, then forgets it. */
export function takeBuild(project: string): string | undefined {
  const prompt = pending.get(project)
  if (prompt !== undefined) pending.delete(project)
  return prompt
}

/**
 * A readable folder name from the first few meaningful words of a prompt.
 * "Make a todo app with dark mode and drag-and-drop" → "make-a-todo-app-with-dark".
 * The result still goes through normalizeProjectName when the project is created.
 */
export function nameFromPrompt(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .slice(0, 4)
  return words.join('-').slice(0, 48).replace(/-+$/, '') || 'new-project'
}

/** Words that describe the request rather than the thing asked for. */
const FILLER = new Set([
  'a', 'an', 'the', 'with', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'my', 'me', 'us', 'i', 'we',
  'please', 'can', 'you', 'could', 'would', 'make', 'build', 'create', 'write', 'generate', 'give',
  'want', 'need', 'some', 'that', 'this', 'it', 'is', 'be', 'like', 'just', 'new',
])
