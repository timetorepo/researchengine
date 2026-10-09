import { motion } from 'motion/react'
import { Apple, Download, FileArchive, Github, HardDriveDownload, Info, Package, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Eyebrow } from '@/components/site/Section'
import {
  INSTALLER_NAMES,
  RELEASE_ASSET,
  RELEASES_URL,
  SOURCE_URL,
  VERSION,
  humanSize,
  useRelease,
} from '@/lib/release'

const FALLBACKS = [
  { kind: 'windows' as const, name: INSTALLER_NAMES.windows, platform: 'Windows 10/11 x64', note: 'per-user, no admin password' },
  { kind: 'deb' as const, name: INSTALLER_NAMES.deb, platform: 'Debian / Ubuntu x64', note: 'apt install ./<file>' },
  { kind: 'appimage' as const, name: INSTALLER_NAMES.appimage, platform: 'Any x64 Linux', note: 'no install, just run it' },
]

const ICONS = {
  windows: <HardDriveDownload className="h-4 w-4" />,
  deb: <Package className="h-4 w-4" />,
  appimage: <Download className="h-4 w-4" />,
}

/**
 * The download, in the order a person decides: which computer, then what kind of
 * install. The portable builds are served by this site itself, so the page works
 * even before someone has a GitHub account (or when the repository is private).
 */
export function DownloadSection() {
  const { release, failed } = useRelease()

  const installers =
    release?.installers.length
      ? release.installers
      : FALLBACKS.map((f) => ({ ...f, href: RELEASE_ASSET(f.name), size: '', sha256: '' }))

  return (
    <section className="site-section scroll-mt-24" id="download">
      <div className="site-shell">
        <motion.header
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: '-80px' }}
          whileInView={{ opacity: 1 }}
        >
          <Eyebrow>Download</Eyebrow>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-semibold">
            Get Research Engine {VERSION}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-2)]">
            Free, no account, and no email address to type. Pick your computer.
          </p>
        </motion.header>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {installers.map((installer, index) => (
            <motion.div
              className="panel flex flex-col gap-4 p-6"
              initial={{ opacity: 0 }}
              key={installer.name}
              transition={{ delay: index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true, margin: '-60px' }}
              whileInView={{ opacity: 1 }}
            >
              <div className="flex items-center gap-2 text-[13px] text-[var(--text-3)]">
                {ICONS[installer.kind as keyof typeof ICONS] ?? <Download className="h-4 w-4" />}
                {installer.platform}
              </div>
              <div>
                <div className="text-[16px] font-medium">
                  {installer.kind === 'windows' ? 'Windows installer' : installer.kind === 'deb' ? 'Linux .deb' : installer.kind === 'appimage' ? 'Linux AppImage' : 'Desktop build'}
                </div>
                {installer.size ? <div className="mt-1 text-[13px] text-[var(--text-3)]">{installer.size}</div> : null}
              </div>
              <ButtonLink className="mt-auto w-full" href={installer.href} rel="noreferrer" target="_blank">
                <Download className="h-4 w-4" />
                Download
              </ButtonLink>
              <code className="truncate text-[11px] text-[var(--text-3)]" title={installer.name}>
                {installer.name}
              </code>
            </motion.div>
          ))}

          <motion.div
            className="panel flex flex-col gap-4 p-6 md:col-span-3"
            initial={{ opacity: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true, margin: '-60px' }}
            whileInView={{ opacity: 1 }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13px] text-[var(--text-3)]">
                <FileArchive className="h-4 w-4" /> No installer, or you would rather keep it on a USB stick
              </div>
              <Badge>needs Node.js 20+</Badge>
            </div>
            <p className="text-[14px] leading-relaxed text-[var(--text-2)]">
              The portable builds are hosted right here on the site, so nothing about getting the app depends on GitHub.
              Unzip it, run it, and your library appears in your home folder.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(release?.portables ?? []).map((portable) => (
                <div
                  className="flex flex-col gap-3 rounded-xl border border-[var(--surface-border)] bg-white/[0.03] p-4"
                  key={portable.name}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-medium">{portable.platform}</span>
                    <span className="text-[12px] text-[var(--text-3)]">{humanSize(portable.bytes)}</span>
                  </div>
                  <ButtonLink className="w-full" href={portable.href} size="sm" variant="outline">
                    <Download className="h-3.5 w-3.5" />
                    {portable.format === 'zip' ? 'Download .zip' : 'Download .tar.gz'}
                  </ButtonLink>
                  <code className="truncate text-[10.5px] text-[var(--text-3)]" title={portable.sha256}>
                    sha256 {portable.sha256.slice(0, 24)}…
                  </code>
                </div>
              ))}
              {!release?.portables.length ? (
                <p className="text-[13px] text-[var(--text-3)] sm:col-span-2">
                  The portable archives for {VERSION} are attached to{' '}
                  <a className="site-link-underline text-[var(--text-2)]" href={RELEASES_URL} rel="noreferrer" target="_blank">
                    the release
                  </a>
                  . This page lists them here as soon as they are built.
                </p>
              ) : null}
            </div>
          </motion.div>
        </div>

        <motion.div
          className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[13px] text-[var(--text-3)]"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1 }}
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Free and open source, MIT licence
          </span>
          <a className="site-link-underline inline-flex items-center gap-1.5" href={RELEASES_URL} rel="noreferrer" target="_blank">
            <Github className="h-3.5 w-3.5" /> Every release, with checksums
          </a>
          <span className="inline-flex items-center gap-1.5">
            <Apple className="h-3.5 w-3.5" /> No macOS build. There is no runner for it.
          </span>
          {failed ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--text-3)]">
              <Info className="h-3.5 w-3.5" /> Showing the release page: this page could not read the local manifest.
            </span>
          ) : null}
        </motion.div>

      </div>
    </section>
  )
}
