/**
 * A short banner with one public-domain painting, shown at the top of a settings
 * page. It always carries the artist, title and a link to the source, so the
 * credit is never hidden. Motion is off under reduced motion.
 */
export interface ArtCredit { src: string; alt: string; artist: string; title: string; year: string; source: string }

export function ArtBanner({ art, position = 'center 40%', className = '' }: { art: ArtCredit; position?: string; className?: string }) {
  return (
    <figure className={`relative overflow-hidden rounded-[16px] mb-4 ${className}`} style={{ border: '1px solid var(--surface-border)' }}>
      <img src={art.src} alt={art.alt} loading="lazy" decoding="async" className="w-full h-[150px] object-cover" style={{ objectPosition: position }} />
      <figcaption className="absolute inset-x-0 bottom-0 px-3 py-1.5 text-[11px] flex items-baseline justify-between gap-3"
        style={{ background: 'color-mix(in srgb, #000 55%, transparent)', color: '#fff' }}>
        <span className="truncate">{art.title}, {art.artist}, {art.year}</span>
        <a href={art.source} target="_blank" rel="noreferrer" className="shrink-0 underline underline-offset-2">Public domain · source</a>
      </figcaption>
    </figure>
  )
}

export const ART = {
  constable: { src: '/art/constable-cloud-study.jpg', alt: 'A painted study of white and grey clouds over a flat landscape', artist: 'John Constable', title: 'Cloud study', year: 'c. 1820s', source: 'https://commons.wikimedia.org/w/index.php?search=John+Constable+Cloud+Study+Google+Art+Project' },
  monet: { src: '/art/monet-impression-sunrise.jpg', alt: 'Claude Monet, Impression, Sunrise: a red sun over a grey harbour', artist: 'Claude Monet', title: 'Impression, Sunrise', year: '1872', source: 'https://commons.wikimedia.org/w/index.php?search=Monet+Impression+Sunrise' },
  vangogh: { src: '/art/van-gogh-self-portrait-1887.jpg', alt: 'Vincent van Gogh, Self-Portrait (1887)', artist: 'Vincent van Gogh', title: 'Self-Portrait', year: '1887', source: 'https://commons.wikimedia.org/w/index.php?search=Van+Gogh+Self-Portrait+1887' },
} satisfies Record<string, ArtCredit>
