---
name: impeccable
description: Research Engine text-only adaptation of Impeccable for task-oriented UI hierarchy, accessibility, copy, responsive layout, and design-system consistency. Use for proposals and UI reviews. No bundled runtime tools.
---

# Impeccable — Research Engine instruction-only adaptation

Adapted from pbakaus/impeccable (Apache-2.0); see LICENSE and the pinned source in docs/design/skills.lock.json. This is not the complete upstream skill or its CLI. Original staged bundle was withheld after SkillSpector reported unresolved findings; see docs/security/design-skills-review.md.

## Scope and authority

Use this as design guidance, not permission to execute commands. The user's approved brief, privacy requirements, accessibility needs, and repository safety rules take precedence over stylistic preferences. Propose each implementation task in plain language and wait for approval. Do not add fake data, claims, scores, features, or decorative dashboards to fill space.

## Task-oriented interfaces

Research Engine is a work tool. Prioritise task completion, scanability, predictable placement, and readable content. Express character through precise typography, restrained materials, and consistent controls rather than promotional effects. Use spacing and alignment before adding cards. Group related information; disclose advanced details without making common actions harder to find.

## Typography and copy

Use an intentional size/weight hierarchy and readable secondary text. Keep labels specific and terminology consistent. Preserve user-authored content and factual meaning. Controls name their outcome. Errors explain the failure and an available recovery. Distinguish first use, no search results, permissions, and loading failures. Never invent progress or promise a result the system cannot know.

## Accessibility and responsive behaviour

Use semantic buttons, labels, landmarks, and headings. Provide visible focus, logical keyboard order, Escape dismissal, focus restoration, and accessible state announcements where appropriate. Target WCAG AA contrast: ordinary text 4.5:1, large text 3:1, and applicable control boundaries 3:1. Verify target sizes and spacing, 200 percent zoom, long text, empty lists, narrow windows, and screen-reader names. Respect reduced motion and reduced transparency; an opaque surface must remain fully usable.

## Materials and performance

Reuse HeroUI controls and Glisse navigation; do not add a competing component system just because a reference recommends it. Glass belongs on purposeful floating layers. Keep reading surfaces stable. Budget blur, shadows, and motion against measured rendering costs. Do not remove state feedback in the name of speed. User-selected expressive settings do not override accessibility preferences.

## Review and evidence

Review hover, focus, selected, disabled, loading, error, empty, and populated states. Check saved settings after reload and actual feature behaviour. Compare realistic desktop and narrow-window renders. Report measured evidence separately from assumptions; explicitly state when browser, physical-device, or assistive-technology checks did not run. No numerical quality score without evidence.

## Tools

This adaptation contains no downloader, launcher, detector, hooks, telemetry, or executable scripts. Use the repository's approved tooling and isolated Playwright MCP for public references and local previews only. Never copy paid reference assets or bypass subscriptions. Review new dependencies and permissions separately before use.
