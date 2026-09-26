import React from 'react'
import { ArrowUpRight, Link2, Quote } from 'lucide-react'
import { clsx } from 'clsx'

/**
 * CssLink — reimplemented from Skiper UI's "CSS link" (skiper40) against this
 * app's tokens.
 *
 * The original is a link whose underline is drawn in CSS rather than by the
 * browser: a background-image gradient wiped in over a transition, so the rule
 * grows out of the text instead of switching on. That is the whole idea, and it
 * is worth having in a chat transcript — answers carry a lot of links, and the
 * default blue underline reads like a document, not like something you can
 * touch.
 *
 * What is added for this app:
 *  - three variants, because links in ResearchEngine do three different jobs:
 *    `inline` in prose, `chip` for a source/citation, `standalone` for a
 *    call-to-action card;
 *  - an external marker that slides in on hover instead of always sitting there;
 *  - reduced-motion support (the rule is simply always shown);
 *  - internal links (`#/…`) go through the router rather than a full reload.
 */
export type CssLinkVariant = 'inline' | 'chip' | 'standalone'

export interface CssLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string
  children: React.ReactNode
  variant?: CssLinkVariant
  /** Small leading icon (a site favicon, a hash for citations…). */
  icon?: React.ReactNode
  /** Force the external arrow on/off; by default it is inferred from the href. */
  external?: boolean
  /** Citation styling: a leading quote mark and tabular number. */
  cite?: boolean
}

const isExternal = (href: string) => /^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)

export function CssLink({
  href = '#', children, variant = 'inline', icon, external, cite, className, onClick, ...rest
}: CssLinkProps) {
  const ext = external ?? isExternal(href)
  const internal = href.startsWith('#/')

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    // An internal route is hash-based: navigate in place instead of reloading
    // the app (which would drop you back to Home and re-mount everything).
    if (internal) {
      e.preventDefault()
      window.location.hash = href.slice(1)
    }
  }

  return (
    <a
      {...rest}
      href={href}
      target={internal ? undefined : '_blank'}
      rel={internal ? undefined : 'noreferrer noopener'}
      onClick={handleClick}
      data-variant={variant}
      data-external={ext ? 'true' : 'false'}
      className={clsx('re-css-link', className)}
    >
      {cite && <Quote size={11} className="re-css-link-quote" aria-hidden />}
      {icon && <span className="re-css-link-icon" aria-hidden>{icon}</span>}
      <span className="re-css-link-text">{children}</span>
      {ext && (
        <span className="re-css-link-arrow" aria-hidden>
          {variant === 'chip' ? <Link2 size={11} /> : <ArrowUpRight size={12} />}
        </span>
      )}
    </a>
  )
}

/** A source row for citations — a CssLink with the citation affordances filled in. */
export function CssSourceLink({ index, title, url }: { index?: number; title: string; url: string }) {
  let host = url
  try { host = new URL(url).hostname.replace(/^www\./, '') } catch { /* keep the raw string */ }
  return (
    <CssLink href={url} variant="chip" cite external icon={<span className="re-css-link-index">{index ?? '·'}</span>}>
      <span className="re-css-link-title">{title}</span>
      <span className="re-css-link-host">{host}</span>
    </CssLink>
  )
}
