// Streaming answer renderer. Settled paragraphs render as Markdown; the live
// tail reveals word by word with SpaceUI's blur-reveal text. Reduced-motion
// users get the static Markdown path.
import { memo, useMemo } from 'react'
import { useReducedMotion } from 'motion/react'
import { BlurRevealText } from '@/components/spaceui/blur-reveal-text'
import { Markdown } from './Markdown'
import { splitStable, plainifyTail, chunkTail } from '@/lib/chat/streamSplit'

type Src = { url?: string }[]

export const StreamingText = memo(function StreamingText({ content, sources }: { content: string; sources?: Src }) {
  const reduce = useReducedMotion()
  const { stable, tail } = useMemo(() => splitStable(content), [content])

  if (reduce) return <Markdown content={content} streaming={false} sources={sources} />

  const plain = plainifyTail(tail)
  const { settled, live } = useMemo(() => chunkTail(plain), [plain])
  const liveKey = settled.length

  return (
    <div className="md-body md-streaming">
      {stable && <Markdown content={stable} streaming={false} sources={sources} />}
      {plain && (
        <p>
          {settled.map((chunk, i) => (
            <span key={i}>{chunk} </span>
          ))}
          {live && (
            <BlurRevealText
              key={liveKey}
              as="span"
              text={live}
              splitBy="words"
              stagger={0.03}
              delay={0}
              duration={0.3}
              blurAmount="8px"
              yOffset={4}
              inView={false}
              className="inline"
            />
          )}
        </p>
      )}
    </div>
  )
})
