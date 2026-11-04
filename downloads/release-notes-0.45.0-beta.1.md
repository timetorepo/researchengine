# Research Engine 0.45.0-beta.1

Jev, a decision model, joins the providers; the rest of the React Bits set is real and used; and the interface learns to think out loud and to ship. A decision model answers typed questions with probabilities instead of prose, so routing and classification stop costing frontier prices. Every remaining micro component from the list is a reimplementation against its documented behaviour and is wired into a surface you can point at, and the chain of thought now shows as the phases it actually went through.

This release also folds in the work since 0.44.0-beta.1: a sorted, named list of every system prompt; Strix running inside the coding workspace; Learn, the renamed Read and Quiz with named techniques and levels; Claude and ChatGPT themes and a Replicate gradient; Snaffy, a router over the models you already have; Full Throttle, which runs the six design directives as one ordered pass; and the eight components from the first React Bits pass, now used for real. The r32 suite (388 checks) and the earlier suites all pass. Live provider calls, Docker containers and VMs were not exercised in our test environment, so those are the first things to try on your machine. The desktop installers are built by CI from this exact commit.

## Jev, a decision model, not a chat model

- TypeSafe AI's System One model is a provider of its own kind. It takes a state and typed questions and returns answers with calibrated probabilities: a choice from options you name, a score on a ladder you set, or a yes/no.
- It cannot leave the schema, which removes the malformed answer but not the mistaken one, so the probability is there for you to set a threshold on. The Settings tab shows the distribution per question.
- It also runs through OpenRouter as `typesafe/jev-1.13` (the decision model) and `typesafe/jev-router` (a router that picks a model and an effort level).

## The rest of React Bits, written here and used

- Every remaining micro component is a reimplementation against the documented behaviour, not a vendored copy. reactbits.dev is not reachable from this environment, and a provenance header that lies is worse than none.
- Each is wired into a surface: the agent indicator on the top bar (expanding to a named list at two or more agents), the update-notify switch, the agent command timings, the font-scale dial and density control, the image-generating frame, a drag-to-confirm commit, the welcome screen, and the home and chat backgrounds.
- The ones with real mechanics keep their accessibility: the dial is a real slider with keyboard, the radio a radiogroup, the slide-commit only fires on a drag that travels, and the swipe row only listens to horizontal motion so the list still scrolls.

## Thinking phases, and Full Throttle

- The chain of thought now shows as the phases it went through: reading, planning, reasoning, doubting, deciding, verifying and answering, split by what the model was actually doing.
- Full Throttle runs the six design directives — research, premium, design, prototype, sweep, ship — in order, blocking only what a missing input actually blocks.

## Also in this release

- Every system prompt in one sorted, named list, each carrying its model.
- Strix in the coding workspace, with the Apache-2.0 skills it runs on.
- Learn: Read and Quiz renamed, with seven named techniques and three levels.
- Claude and ChatGPT themes, and a Replicate gradient.
- Snaffy: a router over the providers you already have, with five personas.
