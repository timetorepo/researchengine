import AnimatedStepper from '@/components/smoothui/animated-stepper'
import { Section } from '@/components/site/Section'
import { STEPS } from '@/data/steps'

/**
 * Four steps, using SmoothUI's animated stepper. It is clickable because on the
 * real first run the app walks you through the same four things.
 */
export function HowItWorks() {
  return (
    <Section
      eyebrow="How it works"
      id="how"
      lead="No configuration ceremony. The app sets up search on its own, explains the one thing it needs from you, and then gets out of the way."
      title="From nothing to your first answer"
    >
      <div className="mt-12">
        <AnimatedStepper allowClickNavigation defaultStep={0} steps={STEPS} variant="horizontal" />
      </div>
    </Section>
  )
}
