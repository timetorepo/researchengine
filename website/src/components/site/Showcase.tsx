import { ContainerScroll } from '@/components/aceternity/ContainerScrollAnimation'
import { Badge } from '@/components/ui/badge'

/**
 * The scroll reveal: Aceternity's container-scroll-animation, with the image
 * the repository's own README opens with. It is the "look at the whole thing"
 * moment between the feature grid and the details.
 */
export function Showcase() {
  return (
    <section className="relative scroll-mt-24" id="look">
      <ContainerScroll
        titleComponent={
          <div className="mx-auto max-w-3xl px-4">
            <Badge className="mb-5" tone="brand">
              Look inside
            </Badge>
            <h2 className="text-[clamp(1.75rem,4.4vw,3rem)] leading-[1.08] font-semibold">
              One window, from the first question to the finished draft
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--text-2)]">
              Chats, saved sources, your library, reading and quizzes, articles, agent squads, workflows, a coding desk
              and a design studio. All of it on your machine, in one folder you can copy or delete.
            </p>
          </div>
        }
        content={
          <div className="h-full w-full overflow-hidden rounded-[22px] border border-white/10 bg-[#0b0913] p-1.5">
            <img
              alt="Research Engine's workspace, with a chat, its sources and the library beside it"
              className="h-full w-full rounded-[18px] object-cover"
              height={675}
              src="/shots/reveal.webp"
              width={900}
            />
          </div>
        }
      />
    </section>
  )
}
