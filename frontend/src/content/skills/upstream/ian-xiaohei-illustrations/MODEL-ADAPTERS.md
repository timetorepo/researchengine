# Running this skill outside Codex

This pack was written for Codex, but every rule in it is plain language, so
any instruction-following model can run it. When the host is not Codex:

1. Treat "the model" as whichever model is answering. Nothing in the skill
   depends on Codex tooling; the modes (plan_only, generate, edit, save) map
   onto ordinary image-generation turns.
2. For image generation, call whatever image tool the host offers (DALL-E,
   imagen, Flux, a local renderer). The prompt template in
   references/prompt-template.md is model-agnostic: fill its slots and hand
   the paragraph to the tool.
3. Codex-specific knobs (shell save paths, file moves) become host file
   actions; if the host cannot write files, return the final prompt and the
   suggested filename instead.
4. Keep the style contract exactly: 16:9, pure white ground, Xiaohei IP,
   sparse red/orange/blue annotations, English handwritten labels. The QA
   checklist in references/qa-checklist.md is the acceptance gate whichever
   model produced the image.
