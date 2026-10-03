/**
 * Features Section — Aceternity UI, vendored from `features-section-demo-3`
 * (public MIT checkout; ui.aceternity.com is unreachable from this machine).
 *
 * This is the bento grid the round asked for, doing what it is good at: four
 * unequal cells with hairline dividers, one of them tall enough to hold a real
 * screenshot, with the title and the line of copy sitting above the picture
 * rather than inside a card. What changed, on purpose:
 *
 *   • the demo's own copy ("Packed with thousands of features", a YouTube link,
 *     a cobe globe and five Unsplash photographs) is gone. The cells are filled
 *     with this app's screenshots and this app's facts, because a marketing page
 *     that shows stock art is the thing the round is trying to get away from;
 *   • the globe is dropped rather than vendored, which is why `cobe` is not a
 *     dependency of this site;
 *   • colours are this site's tokens instead of `neutral-800` / `white`;
 *   • the grid takes the cells as children, so the page owns its own content.
 */
import type * as React from "react";
import { cn } from "@/lib/utils";

export interface BentoCell {
  id: string;
  title: string;
  body: string;
  /** The picture or panel that fills the cell below the copy. */
  skeleton: React.ReactNode;
  /** The column span on wide screens, e.g. `lg:col-span-4`. */
  className?: string;
}

function FeatureCard({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden p-6 sm:p-8 border-b border-[var(--surface-border)] last:border-b-0 lg:border-b-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FeatureTitle({ children }: { children?: React.ReactNode }) {
  return (
    <p className="mx-auto max-w-5xl text-left text-[19px] leading-snug font-medium tracking-tight text-foreground md:text-[21px]">
      {children}
    </p>
  );
}

function FeatureDescription({ children }: { children?: React.ReactNode }) {
  return (
    <p className="mx-0 my-2 max-w-sm text-left text-[14px] leading-relaxed font-normal text-[var(--text-2)]">
      {children}
    </p>
  );
}

export function FeaturesBento({
  cells,
  className,
}: {
  cells: BentoCell[];
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="mt-10 grid grid-cols-1 rounded-2xl border border-[var(--surface-border)] bg-[rgba(255,255,255,0.015)] lg:grid-cols-6">
        {cells.map((cell) => (
          <FeatureCard className={cell.className} key={cell.id}>
            <FeatureTitle>{cell.title}</FeatureTitle>
            <FeatureDescription>{cell.body}</FeatureDescription>
            <div className="h-full w-full">{cell.skeleton}</div>
          </FeatureCard>
        ))}
      </div>
    </div>
  );
}

export { FeatureCard, FeatureTitle, FeatureDescription };
