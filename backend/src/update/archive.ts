/**
 * Unpacking an update — tar.gz and zip, in pure Node.
 *
 * The updater downloads a release archive and puts its contents on disk, which
 * makes this the one piece of the update path that runs untrusted input through
 * a parser. It is written accordingly:
 *
 *   • every entry path is rejected unless it resolves *inside* the destination
 *     (no `..`, no absolute paths, no Windows drive letters, no NUL bytes);
 *   • links are not created at all — a symlink in an archive is a way to write
 *     outside the extraction root, and this updater has no need for them;
 *   • sizes are bounded, so a corrupt or hostile archive cannot expand until the
 *     disk is full;
 *   • the format is decided by magic bytes, never by the file name.
 *
 * Both readers are complete for what we publish (`node:zlib` does the heavy
 * lifting) and are covered by tests that unpack the real release archives
 * committed under `downloads/`.
 */
import { chmodSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { gunzipSync, inflateRawSync } from 'node:zlib'

export interface ExtractOptions {
  /** Drop this many leading path segments (`pkg-folder/file` → `file`). */
  strip?: number
  /** Per-file uncompressed ceiling. */
  maxFileBytes?: number
  /** Total uncompressed ceiling for the whole archive. */
  maxTotalBytes?: number
}

export interface ExtractResult {
  files: string[]
  bytes: number
  format: 'tar.gz' | 'zip'
}

const DEFAULT_MAX_FILE = 256 * 1024 * 1024
const DEFAULT_MAX_TOTAL = 1024 * 1024 * 1024

/**
 * Join an archive entry onto the destination, refusing anything that would land
 * outside it. This is the only place a path from an archive becomes a real path.
 */
export function safeEntryPath(dest: string, entry: string): string | null {
  if (typeof entry !== 'string' || !entry) return null
  if (entry.includes('\0')) return null
  const normalized = entry.replace(/\\/g, '/')
  if (normalized.startsWith('/')) return null
  if (/^[a-zA-Z]:/.test(normalized)) return null
  const segments = normalized.split('/').filter((s) => s.length && s !== '.')
  if (!segments.length) return null
  if (segments.some((s) => s === '..' || s.includes('://'))) return null
  const full = resolve(dest, ...segments)
  const rel = relative(resolve(dest), full)
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return null
  return full
}

/** Strip `n` leading path segments; null when nothing is left. */
export function stripSegments(entry: string, n: number): string | null {
  const parts = entry.split('/').filter(Boolean)
  if (parts.length <= n) return null
  return parts.slice(n).join('/')
}

function assertBudget(totalSoFar: number, fileSize: number, opts: ExtractOptions) {
  const maxFile = opts.maxFileBytes ?? DEFAULT_MAX_FILE
  const maxTotal = opts.maxTotalBytes ?? DEFAULT_MAX_TOTAL
  if (fileSize > maxFile) throw new Error(`archive entry is ${fileSize} bytes — larger than the ${maxFile} byte limit`)
  if (totalSoFar + fileSize > maxTotal) throw new Error(`archive expands past the ${maxTotal} byte limit — refusing to unpack it`)
}

interface State { bytes: number; files: string[] }

/** Write one entry (after stripping), creating parents. Never lands outside `dest`. */
function writeEntry(dest: string, rawEntry: string, data: Buffer, mode: number | undefined, opts: ExtractOptions, state: State) {
  const entry = stripSegments(rawEntry, Math.max(0, opts.strip ?? 0))
  if (!entry) return
  assertBudget(state.bytes, data.length, opts)
  const target = safeEntryPath(dest, entry)
  if (!target) throw new Error(`unsafe path in archive: ${rawEntry}`)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, data)
  if (mode !== undefined && (mode & 0o111) !== 0) {
    try { chmodSync(target, mode & 0o777) } catch { /* filesystems without modes */ }
  }
  state.bytes += data.length
  state.files.push(entry)
}

function mkdirEntry(dest: string, rawEntry: string, opts: ExtractOptions) {
  const entry = stripSegments(rawEntry, Math.max(0, opts.strip ?? 0))
  if (!entry) return
  const dir = safeEntryPath(dest, entry)
  if (dir) mkdirSync(dir, { recursive: true })
}

/* ------------------------------------------------------------------ tar ---- */

const oct = (buf: Buffer, start: number, len: number): number => {
  if (buf[start] & 0x80) {
    let n = 0
    for (let i = start; i < start + len; i++) n = n * 256 + (i === start ? buf[i] & 0x7f : buf[i])
    return n
  }
  const s = buf.subarray(start, start + len).toString('latin1').replace(/\0.*$/, '').trim()
  if (!s) return 0
  const v = parseInt(s, 8)
  return Number.isFinite(v) ? v : 0
}

const str = (buf: Buffer, start: number, len: number): string =>
  buf.subarray(start, start + len).toString('utf8').replace(/\0.*$/, '').trim()

function tarChecksumOk(header: Buffer): boolean {
  const stored = oct(header, 148, 8)
  if (!stored) return true
  let sum = 0
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : header[i]
  return sum === stored
}

/** Parse a tar archive (already decompressed). */
export function extractTar(buf: Buffer, dest: string, opts: ExtractOptions = {}, state: State = { bytes: 0, files: [] }): ExtractResult {
  let offset = 0
  let longName: string | null = null
  let paxPath: string | null = null
  let paxBytes = 0
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break
    if (!tarChecksumOk(header)) throw new Error('tar header checksum mismatch — the archive is corrupt')
    const size = oct(header, 124, 12)
    const type = String.fromCharCode(header[156] || 0x30)
    const prefix = str(header, 345, 155)
    const plain = prefix ? `${prefix}/${str(header, 0, 100)}` : str(header, 0, 100)
    const name = paxPath ?? longName ?? plain
    longName = null
    paxPath = null
    const dataStart = offset + 512
    if (dataStart + size > buf.length + 512) throw new Error('tar entry runs past the end of the archive')
    const data = buf.subarray(dataStart, Math.min(dataStart + size, buf.length))
    offset = dataStart + Math.ceil(size / 512) * 512

    if (type === 'L') { longName = data.toString('utf8').replace(/\0.*$/, ''); continue }
    if (type === 'K') continue
    if (type === 'x' || type === 'g') {
      paxBytes += data.length
      assertBudget(paxBytes, data.length, opts)
      for (const rec of data.toString('utf8').split('\n')) {
        const m = /^\d+ path=(.*)$/.exec(rec)
        if (m) paxPath = m[1]
      }
      continue
    }
    if (type === '2' || type === '1') throw new Error(`archive contains a link (${name}) — refusing to unpack it`)
    if (type === '5' || (!size && name.endsWith('/'))) { mkdirEntry(dest, name, opts); continue }
    if (type !== '0' && type !== '\0' && type !== '7') continue
    writeEntry(dest, name, Buffer.from(data), oct(header, 100, 8), opts, state)
  }
  return { files: state.files, bytes: state.bytes, format: 'tar.gz' }
}

/* ------------------------------------------------------------------ zip ---- */

const u16 = (b: Buffer, o: number) => b.readUInt16LE(o)
const u32 = (b: Buffer, o: number) => b.readUInt32LE(o)

/** Parse a zip archive. */
export function extractZip(buf: Buffer, dest: string, opts: ExtractOptions = {}, state: State = { bytes: 0, files: [] }): ExtractResult {
  const EOCD = 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (u32(buf, i) === EOCD) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not a zip archive (no end-of-central-directory record)')
  const count = u16(buf, eocd + 10)
  const cdOffset = u32(buf, eocd + 16)
  if (count === 0xffff || cdOffset === 0xffffffff) throw new Error('zip64 archives are not supported by the updater')

  let p = cdOffset
  for (let i = 0; i < count; i++) {
    if (u32(buf, p) !== 0x02014b50) throw new Error('zip central directory is corrupt')
    const flags = u16(buf, p + 8)
    const method = u16(buf, p + 10)
    const compSize = u32(buf, p + 20)
    const uncompSize = u32(buf, p + 24)
    const nameLen = u16(buf, p + 28)
    const extraLen = u16(buf, p + 30)
    const commentLen = u16(buf, p + 32)
    const localOffset = u32(buf, p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')
    p += 46 + nameLen + extraLen + commentLen

    if (flags & 0x1) throw new Error(`archive entry ${name} is encrypted`)
    if (uncompSize === 0xffffffff || compSize === 0xffffffff) throw new Error('zip64 archives are not supported by the updater')
    if (name.endsWith('/')) { mkdirEntry(dest, name, opts); continue }
    if (u32(buf, localOffset) !== 0x04034b50) throw new Error(`zip entry ${name} has no local header`)
    const dataStart = localOffset + 30 + u16(buf, localOffset + 26) + u16(buf, localOffset + 28)
    const raw = buf.subarray(dataStart, dataStart + compSize)

    let data: Buffer
    if (method === 0) data = Buffer.from(raw)
    else if (method === 8) {
      data = inflateRawSync(raw, { maxOutputLength: Math.min(uncompSize + 1024, opts.maxFileBytes ?? DEFAULT_MAX_FILE) })
    } else throw new Error(`zip entry ${name} uses unsupported compression (method ${method})`)
    if (uncompSize && data.length !== uncompSize) throw new Error(`zip entry ${name} is truncated (${data.length} of ${uncompSize} bytes)`)
    writeEntry(dest, name, data, undefined, opts, state)
  }
  return { files: state.files, bytes: state.bytes, format: 'zip' }
}

/* --------------------------------------------------------------- public ---- */

/** Which format is this? Decided by magic bytes, never by the file name. */
export function sniffFormat(buf: Buffer): 'tar.gz' | 'zip' | 'tar' | null {
  if (buf.length > 4 && buf[0] === 0x1f && buf[1] === 0x8b) return 'tar.gz'
  if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) return 'zip'
  if (buf.length > 512 && str(buf, 257, 6).startsWith('ustar')) return 'tar'
  return null
}

/** Unpack an archive buffer into `dest`, stripping the leading folder by default. */
export function extractArchive(buffer: Buffer, dest: string, opts: ExtractOptions = {}): ExtractResult {
  const format = sniffFormat(buffer)
  if (!format) throw new Error('unrecognised archive format — expected a .tar.gz or .zip release')
  mkdirSync(dest, { recursive: true })
  const state: State = { bytes: 0, files: [] }
  if (format === 'zip') return extractZip(buffer, dest, opts, state)
  const raw = format === 'tar.gz' ? gunzipSync(buffer) : buffer
  const out = extractTar(raw, dest, opts, state)
  return { ...out, format: 'tar.gz' }
}

export function rmrf(path: string) {
  if (!existsSync(path)) return
  rmSync(path, { recursive: true, force: true, maxRetries: 3 })
}
