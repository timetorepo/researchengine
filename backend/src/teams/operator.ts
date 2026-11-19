/** Offline operator primitives. Caller must stop all writers and provide trusted local paths. */
import { mkdir, lstat, open, link, unlink, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createHostKeyring, unlockHostKeyring, clearHostKeys, type UnlockedHostKeys } from './keyring'
import { TeamJournal } from './journal'
import { TeamObjects } from './objects'
import { exportRecovery, inspectRecovery, restoreRecovery, verifyRestored } from './recovery'
async function syncDirectory(path: string) { const file=await open(path,'r');try {await file.sync()} finally {await file.close()} }
async function privatePath(path: string, directory: boolean) {
  const metadata=await lstat(path)
  if ((directory ? !metadata.isDirectory() : !metadata.isFile()) || (metadata.mode & 0o077) !== 0 || (process.getuid && metadata.uid !== process.getuid())) throw new Error('Expected an owner-only regular file/directory, not a symlink')
}
/** Publish one new owner-only file without replacement; interrupted publication may leave valid ciphertext. */
async function publish(path: string, bytes: Buffer) {
  const parent=dirname(path),temporary=join(parent,`.teams-pending-${randomBytes(16).toString('hex')}`)
  const file=await open(temporary,'wx',0o600)
  try {
    try {await file.writeFile(bytes);await file.sync()} finally {await file.close()}
    await link(temporary,path);await syncDirectory(parent)
  } finally {await unlink(temporary)}
  await syncDirectory(parent)
}
async function load(root: string, password: Buffer): Promise<UnlockedHostKeys> {
  await privatePath(root,true);await privatePath(join(root,'host.keys'),false)
  return unlockHostKeyring(await readFile(join(root,'host.keys')),password)
}
export async function initializeOfflineHost(root: string, team: string, password: Buffer): Promise<void> {
  const sealed=await createHostKeyring(team,password)
  await mkdir(root,{mode:0o700});await syncDirectory(dirname(root)) // Refuse any existing destination.
  await publish(join(root,'host.keys'),sealed)
  const unlocked=await unlockHostKeyring(sealed,password)
  let journal: TeamJournal|undefined
  try {
    journal=await TeamJournal.open(join(root,'journal'),unlocked.keys.journal)
    await TeamObjects.open(join(root,'objects'),unlocked.keys.objects,team)
  } finally {try {await journal?.close()} finally {clearHostKeys(unlocked)}}
}
export async function backupOfflineHost(root: string, destination: string, password: Buffer) {
  const unlocked=await load(root,password)
  let journal: TeamJournal|undefined
  try {
    await privatePath(join(root,'journal'),true);await privatePath(join(root,'journal','operations.log'),false);await privatePath(join(root,'objects'),true)
    // Never create a missing journal or silently truncate a damaged source during backup.
    journal=await TeamJournal.open(join(root,'journal'),unlocked.keys.journal,{create:false,recoverTail:false})
    const objects=await TeamObjects.open(join(root,'objects'),unlocked.keys.objects,unlocked.team,{create:false})
    const bytes=await exportRecovery(journal,objects,unlocked.keys,unlocked.team,'team-state-v1')
    const checkpoint=inspectRecovery(bytes,unlocked.keys,unlocked.team,'team-state-v1')
    await publish(destination,bytes)
    return {team:unlocked.team,checkpoint}
  } finally {try {await journal?.close()} finally {clearHostKeys(unlocked)}}
}
export async function verifyOfflinePackage(root: string, path: string, password: Buffer) {
  const unlocked=await load(root,password)
  try {return {team:unlocked.team,checkpoint:inspectRecovery(await readFile(path),unlocked.keys,unlocked.team,'team-state-v1')}}
  finally {clearHostKeys(unlocked)}
}
/** Keys remain in their original protected root, never copied into restored data automatically. */
export async function restoreOfflinePackage(root: string, path: string, destination: string, password: Buffer) {
  const unlocked=await load(root,password)
  try {
    const checkpoint=await restoreRecovery(await readFile(path),destination,unlocked.keys,unlocked.team,'team-state-v1')
    await verifyRestored(destination,unlocked.keys,unlocked.team,'team-state-v1')
    return {team:unlocked.team,checkpoint}
  } finally {clearHostKeys(unlocked)}
}
export async function verifyOfflineRestore(root: string, destination: string, password: Buffer) {
  const unlocked=await load(root,password)
  try {return {team:unlocked.team,checkpoint:await verifyRestored(destination,unlocked.keys,unlocked.team,'team-state-v1')}}
  finally {clearHostKeys(unlocked)}
}
