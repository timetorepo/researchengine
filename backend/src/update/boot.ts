/**
 * What happens to an update *after* the files were swapped and the server was
 * restarted.
 *
 * The sequence the updater promises:
 *
 *   1. files swapped, marker written, process restarted          (service.ts)
 *   2. the new version boots; the marker's attempt count goes up   (here)
 *   3. it serves pages; after HEALTHY_AFTER_MS the marker is cleared — the
 *      update is now permanent and the previous files are dropped
 *   4. if instead it dies while booting, the old files are put back, the reason
 *      is written beside them, and the old version is started again
 *
 * Step 4 has two triggers, because a broken build can fail in two ways: it can
 * throw on the way up (caught by the fatal handler below) or it can hang or
 * crash-loop (caught on the *next* boot, when the attempt count has run out).
 */
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import {
  HEALTHY_AFTER_MS, MAX_BOOT_ATTEMPTS,
  clearPending, markHealthy, noteBootAttempt, readPending, rollback, updateDir,
  type PendingUpdate, type UpdateDeps,
} from './service'

/** Where the update marker lives, for logs and for the failure note. */
export const markerPath = (deps: UpdateDeps) => deps.appRoot ? join(updateDir(deps), 'pending.json') : ''

/**
 * Start the server again after a swap. Detached on purpose: the process that
 * spawned it is about to exit, and the new one must outlive it.
 */
export function respawn(deps: UpdateDeps, argv: string[] = process.argv.slice(1)): boolean {
  try {
    const child = spawn(process.execPath, argv, {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd(),
      env: process.env,
    })
    child.unref()
    deps.log?.(`restarting: ${process.execPath} ${argv.join(' ')}`)
    return true
  } catch (e: any) {
    deps.log?.(`could not restart automatically (${e?.message ?? e}) — start it again from your launcher`)
    return false
  }
}

export interface BootPlan {
  /** The marker, if there is one. */
  pending: PendingUpdate | null
  /** Too many failed boots — roll back before serving anything. */
  shouldRollback: boolean
  attempts: number
  note?: string
}

/**
 * Decide what to do at boot. Pure decision + the two filesystem writes it needs,
 * so a test can drive every branch.
 */
export function bootUpdateCheck(deps: UpdateDeps): BootPlan {
  const pending = readPending(deps)
  if (!pending) return { pending: null, shouldRollback: false, attempts: 0 }
  if (pending.attempts >= MAX_BOOT_ATTEMPTS) {
    return {
      pending,
      shouldRollback: true,
      attempts: pending.attempts,
      note: `${pending.to} did not come up after ${pending.attempts} attempts`,
    }
  }
  const next = noteBootAttempt(deps, pending)
  return { pending: next, shouldRollback: false, attempts: next.attempts }
}

/**
 * Called once the server is actually listening. If a new version is on trial,
 * this is what makes the swap permanent.
 */
export function scheduleHealthy(deps: UpdateDeps, plan: BootPlan) {
  if (!plan.pending || plan.shouldRollback) return
  const timer = setTimeout(() => {
    try { markHealthy(deps, plan.pending!) } catch (e: any) { deps.log?.(`could not finalise the update: ${e?.message ?? e}`) }
  }, HEALTHY_AFTER_MS)
  timer.unref?.()
}

/**
 * The last line of defence: the new version threw while starting. Put the old
 * version back and start it — the user asked for an update, not for a broken
 * app.
 */
export function handleFatalWithPending(deps: UpdateDeps, error: unknown): boolean {
  const pending = readPending(deps)
  if (!pending) return false
  try {
    const outcome = rollback(deps, `the update to ${pending.to} failed to start: ${String((error as any)?.message ?? error)}`)
    deps.log?.(`rolled back to ${outcome.to || 'the previous version'} — ${outcome.reason}`)
    return respawn(deps)
  } catch (e: any) {
    deps.log?.(`rollback failed: ${e?.message ?? e} — the previous version is in ${updateDir(deps)}/backup`)
    return false
  }
}

/**
 * Roll back a *candidate* version that keeps failing, from the boot path, before
 * it serves anything. Returns true when the process should exit (a restart is
 * already on its way).
 */
export function rollbackAndRestart(deps: UpdateDeps, plan: BootPlan): boolean {
  if (!plan.shouldRollback || !plan.pending) return false
  try {
    const outcome = rollback(deps, plan.note ?? 'the new version did not start')
    deps.log?.(`rolled back to ${outcome.to || 'the previous version'}`)
    const restarted = respawn(deps)
    if (!restarted) clearPending(deps)
    return true
  } catch (e: any) {
    deps.log?.(`rollback failed: ${e?.message ?? e}`)
    clearPending(deps)
    return false
  }
}
