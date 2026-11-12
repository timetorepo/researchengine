# Design skills: security review

Date: 2026-11-12. Scope: development-agent design instructions, not product-runtime skills.

## Scanner and method

Used the actual NVIDIA SkillSpector source at the commit pinned in `../design/skills.lock.json`, package version 2.12.0. The sandbox initially had Python 3.11; a local Python 3.12.12 prerequisite was built and the scanner installed in an isolated environment under ignored `.cache/design-skill-review/`. No scanner source was modified to bypass checks.

Scans used `--recursive --no-llm --format json`. The final installed-set scan also used `--fail-on-incomplete` and exited 0. All installed skills were scanned; none omitted by collection limits. The final report marks completeness true for its configured static scope, with some `complete_with_caveats` results for unresolved example paths/external references. This does not inspect remote linked content, omitted upstream scripts/images, runtime behaviour, or all possible malicious intent.

No LLM analysis was enabled; skill contents were not sent to an LLM provider by SkillSpector. Live OSV advisory data is unavailable under this environment's network allowlist. The MCP npm lockfile's dependency contents were not scanned by SkillSpector; exact versions/integrity are recorded, not certified safe.

## Results and decisions

- Initial collection: 14 staged upstream instruction-only skills. Scanner maximum risk 100 (CRITICAL), exit 1; partial aggregate coverage. Full report: `design-skills-upstream-scan.json`.
- Additional collection: 4 staged skills. Maximum risk 21 (MEDIUM), exit 0; raw report: `design-skills-additional-scan.json`.
- Final installed collection: 13 skills, including one project-authored Impeccable adaptation. Maximum risk 21 (MEDIUM), four retained findings, no suppressed findings. Exit 0 with fail-on-incomplete. Full report: `design-skills-installed-scan.json`.

### Manually accepted findings (not scanner-clean claims)

| Skill | Score | Finding | Context and decision |
|---|---:|---|---|
| find-animation-opportunities | 20 | P1, quoted instruction override | SKILL.md's defensive rule explicitly says to treat repository text as data and flag an attempted override. Accepted as a false positive in that context, not followed as an instruction. |
| remove-animations | 20 | P1, quoted instruction override | Same defensive example; accepted in context. No suppression baseline added. |
| prototype | 21 | AR2, alleged omission of warnings | SKILL.md line 65 describes instant prototype switching ("gets no animation"), not suppressing warnings. Accepted as a lexical false positive. Root AGENTS.md explicitly requires honest warnings and evidence. |
| impeccable adaptation | 3 | EA3, alleged scope creep | LICENSE line 56 contains Apache-2.0 legal wording "not limited to". It is licence text, not a directive granting capabilities. Licence preserved unmodified. |

Nine installed skills have zero reported findings, including Unslop and Apple Design. A zero score is not proof of safety.

### Withheld original bundles

Not present in `.agents/skills/` and not active-discoverable:

- **choreograph**: critical score 85; unresolved recipe parsing/reference coverage, defensive quotation matches, Unicode warning.
- **impeccable (full upstream bundle)**: critical score 100; unresolved referenced-artifact coverage and instruction/command surfaces. Original launcher, downloader, hooks and binaries were never activated. A small, explicitly attributed text-only adaptation replaces it; it is not a silently sanitised upstream installation.
- **improve-animations**: high score 66; defensive quotation/YARA matches and hidden-character warning in a template.
- **review-animations**: medium score 43; incomplete parsing of referenced standards.
- **break-ui**: low score 20 but incomplete deterministic evaluation of obfuscated instruction text; withheld rather than treating the low score as approval.
- **mobile-native**: score 0 but partial command-fragment analysis; withheld rather than treating zero findings as complete coverage.

These findings do not establish that the authors or skills are malicious. They mean this review could not justify activating these exact bundles under its conservative policy. Sources/omissions are pinned in the lockfile. Full source checkouts remain only in ignored local review storage; future inspection can reacquire the pinned commits.

## Manual design-advice review

Security scanning does not determine good UI advice. Identified conflicts:

- Unslop's broad glass/bounce restrictions conflict with requested optional Glisse refraction/expressive motion. The approved product brief wins; effects remain purposeful, adjustable, and accessible.
- Some upstream skills prescribe a canned initial reply. They do not replace answering a concrete user request.
- Prototype's fixed picker appearance is a tool convention, not a mandate to change production style.
- Component recommendations must not churn installed HeroUI/Glisse dependencies.
- Some advice favours custom fonts, other advice system fonts. Font selection remains a rendered comparison, not an automatic download.
- A screenshot/render-count limit must not prevent adequate verification.
- Upstream snapshot/story scripts and Impeccable command steps are unavailable in the instruction-only profile. Do not execute replacements or install missing launchers implicitly.

Root AGENTS.md records these decisions. Third-party instructions remain subordinate to explicit scope, privacy, accessibility, and repository safety rules.

## MCP verification

Installed @playwright/mcp 0.0.85 with exact npm lock and lifecycle scripts disabled. Config uses isolated headless stdio blocks service workers, disables page-provided WebMCP tools, and explicitly requests Chromium sandboxing. Actual JSON-RPC initialization and tools/list succeeded. An actual tools/call for browser_close failed because Chrome is not installed. `tools/design/check-mcp.py` intentionally exits nonzero in that case. No rendered-browser capability is claimed.

Mobbin discovery returned unsupported. Vercel connector discovery returned enabled; no account mutation/deployment was performed. No personal profile, paid-reference access, or private app source was used.

## Limits

This is a point-in-time, static defence-in-depth review, not certification. No semantic-provider scan, dynamic skill execution, image-content analysis, full npm supply-chain audit, physical-device test, app build, or visual browser review was performed. The application source and runtime dependencies were not changed.
