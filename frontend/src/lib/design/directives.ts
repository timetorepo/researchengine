/**
 * What the agent does when it is asked to build something — in the order the
 * user asked for it:
 *
 *   1. Research is key      — look at Awwwards, Dribbble and the rest first.
 *   2. Premium is vague     — ask what "premium" means *before* writing code.
 *   3. Design is life       — typography, colour, references, components, on a
 *                             board, Stitch-style.
 *   4. Prototype before prod— test responsiveness and every microinteraction,
 *                             pixel by pixel.
 *   5. No cons, just the pros— hunt the bugs, the unsynced UI, the UX breakers.
 *   6. Idea to Production   — on the user's signal, prepare the deploy for the
 *                             host they picked.
 *
 * This file holds the text and the deploy mechanics; the prompts in
 * `lib/prompts/masters.ts` and `lib/ide/agents.ts` include it, so the same
 * instructions reach every agent in the app instead of being repeated in three
 * places and drifting.
 */
import { frameworkById } from './frameworks'

export interface Directive {
  id: 'research' | 'premium' | 'design' | 'prototype' | 'sweep' | 'ship'
  title: string
  /** One line, shown in the UI. */
  summary: string
  /** What the agent actually does, in order. */
  steps: string[]
}

export const DESIGN_DIRECTIVES: Directive[] = [
  {
    id: 'research', title: 'Research is key', summary: 'Look at real work before drawing anything.',
    steps: [
      'Search Awwwards, Dribbble, and a reference library (Refero, Mobbin-style screens) for the exact thing being built — not "websites", the actual screen type.',
      'Collect three to five references and write down the one decision each one settles (layout, type, motion, density).',
      'Name what would be plagiarism and avoid it: take structure and restraint, never another product\'s identity.',
    ],
  },
  {
    id: 'premium', title: 'Premium is vague', summary: 'Ask what premium means to this person before writing code.',
    steps: [
      'Ask the questions in the Design Brief — style, density, motion, theme, type, accent, references, must-haves, avoid-list.',
      'Do not write UI code before the brief is answered. If the user says "you decide", say what you decided and why, in one sentence each.',
      'Turn the answers into a one-paragraph style contract at the top of the work, so every later decision can be checked against it.',
    ],
  },
  {
    id: 'design', title: 'Design is life', summary: 'Type, colour, references and components, on one board.',
    steps: [
      'Produce two or three directions on a board — each with a type pairing, a palette with real values, a motion rule, and the components it would use.',
      'Every palette entry is a token (background, surface, line, text, muted, accent), not a colour named loosely.',
      'Pull components from the providers in the hub and put their install lines in the box; never hand-roll what a registry already ships.',
      'Pick one direction with the user before building it out.',
    ],
  },
  {
    id: 'prototype', title: 'Prototype before prod', summary: 'Test it, check responsiveness, sync every microinteraction.',
    steps: [
      'Build the real thing at real sizes; check phone, tablet, laptop and TV (1920×1080) before calling it done.',
      'Run every interaction: hover, press, focus, drag, scroll, enter and leave. Motion must be interruptible and must not animate layout.',
      'Check the pixel details: alignment, spacing rhythm, optical centring, image aspect ratios, text truncation with long words.',
      'Fix what the checks find; a known misalignment is not "good enough".',
    ],
  },
  {
    id: 'sweep', title: 'No cons, just the pros', summary: 'Every corner checked for bugs and broken states.',
    steps: [
      'Walk the states: empty, loading, error, offline, permission denied, very long content, very fast clicks.',
      'Hunt unsynced UI: two things that should move together but do not; a number that lags its label; a theme that half-applies.',
      'Check accessibility: focus order, labels, contrast, reduced motion, 200% text.',
      'Report what was found and what was fixed — a sweep that found nothing is suspicious, not impressive.',
    ],
  },
  {
    id: 'ship', title: 'Idea to Production', summary: 'On the signal, get it ready for the host the user picks.',
    steps: [
      'Ask for the signal explicitly. Never deploy because the build passed.',
      'Write the host\'s config into the repo, set the build and output settings, and list the environment variables the app needs.',
      'Run the production build locally and serve it once, so the first deploy is not the first test.',
      'After the user deploys, check the live URL — a green build is not a working site.',
    ],
  },
]

export function directivesPrompt(): string {
  const blocks = DESIGN_DIRECTIVES.map((d, i) => [
    `${i + 1}. ${d.title} — ${d.summary}`,
    ...d.steps.map((s) => `   · ${s}`),
  ].join('\n'))
  return [
    'You follow these six design directives on every build task, in order. They are not optional and not a summary at the end — they are the method.',
    ...blocks,
  ].join('\n')
}

/* ------------------------------ deployment -------------------------------- */

export type ShipTargetId = 'vercel' | 'netlify' | 'cloudflare' | 'render' | 'github-pages'

export interface ShipTarget {
  id: ShipTargetId
  name: string
  /** Where the settings live. */
  control: string
  summary: string
  /** Files this app writes into the repo for this host. */
  files: string[]
  /** The settings a person still has to set in the host's dashboard. */
  manual: string[]
}

export const SHIP_TARGETS: ShipTarget[] = [
  {
    id: 'vercel', name: 'Vercel', control: 'the Vercel dashboard or CLI',
    summary: 'Zero-config for most frameworks; the config file only pins what you want fixed.',
    files: ['vercel.json'],
    manual: ['Connect the Git repository (or run `npx vercel`).', 'Add the environment variables the app reads.', 'Set the production branch if it is not main.'],
  },
  {
    id: 'netlify', name: 'Netlify', control: 'netlify.toml + the Netlify dashboard',
    summary: 'Build command and publish directory in a file that lives with the code.',
    files: ['netlify.toml', 'public/_redirects'],
    manual: ['Connect the repository in Netlify, or run `npx netlify deploy --prod`.', 'Add environment variables in Site configuration → Environment variables.', 'SPA fallback is written for you; keep it if the app has client-side routes.'],
  },
  {
    id: 'cloudflare', name: 'Cloudflare Pages', control: 'the Cloudflare dashboard',
    summary: 'Fast static hosting on their edge; the wrangler file makes builds reproducible.',
    files: ['wrangler.toml'],
    manual: ['Create a Pages project and connect the repository.', 'Set the build command and output directory from the file, or type them again in the dashboard.', 'Add environment variables (and any secrets) in the Pages settings, not in the repo.'],
  },
  {
    id: 'render', name: 'Render', control: 'render.yaml + the Render dashboard',
    summary: 'A blueprint file that describes the service so it can be recreated.',
    files: ['render.yaml'],
    manual: ['Create a Static Site (or Web Service) from the repository.', 'Confirm the plan — free instances sleep, which is visible to users.', 'Set secrets in the dashboard; render.yaml only lists the names.'],
  },
  {
    id: 'github-pages', name: 'GitHub Pages', control: 'a workflow in .github/workflows',
    summary: 'Free hosting straight from the repository, built by a GitHub Action.',
    files: ['.github/workflows/pages.yml', 'public/.nojekyll'],
    manual: ['Settings → Pages → Source: GitHub Actions, once.', 'If the site is served from /<repo>/, set the base path in the framework config.', 'Private repositories need a paid plan for Pages.'],
  },
]

export interface ShipContext {
  target: ShipTargetId
  framework: string
  outDir?: string
  /** Where the SPA should fall back to, for client-side routing. */
  spa?: boolean
}

export const SPA_DEFAULT = 'index.html'

/** The files that get written, with their real contents. */
export function shipFiles(ctx: ShipContext): { path: string; content: string }[] {
  const fw = frameworkById(ctx.framework)
  const out = ctx.outDir || fw?.outDir || 'dist'
  const build = fw?.build ?? 'npm run build'
  const install = fw?.install ?? 'npm install'
  const spa = ctx.spa !== false

  switch (ctx.target) {
    case 'vercel':
      return [{
        path: 'vercel.json',
        content: JSON.stringify({
          $schema: 'https://openapi.vercel.sh/vercel.json',
          buildCommand: build,
          installCommand: install,
          outputDirectory: out,
          ...(spa ? { rewrites: [{ source: '/(.*)', destination: '/index.html' }] } : {}),
        }, null, 2) + '\n',
      }]
    case 'netlify': {
      const files = [{
        path: 'netlify.toml',
        content: [
          '[build]',
          `  command = "${build}"`,
          `  publish = "${out}"`,
          '',
          '[build.environment]',
          '  NODE_VERSION = "22"',
          '',
          ...(spa ? ['[[redirects]]', '  from = "/*"', '  to = "/index.html"', '  status = 200', ''] : []),
        ].join('\n'),
      }]
      if (spa) files.push({ path: 'public/_redirects', content: '/*  /index.html  200\n' })
      return files
    }
    case 'cloudflare':
      return [{
        path: 'wrangler.toml',
        content: [
          `name = "site"`,
          'compatibility_date = "' + new Date().toISOString().slice(0, 10) + '"',
          '',
          '[build]',
          `command = "${build}"`,
          'cwd = "."',
          '',
          '# Cloudflare Pages reads the output directory from the project settings;',
          '# this file keeps the build command in the repository where it can be reviewed.',
          `# output directory: ${out}`,
          '',
        ].join('\n'),
      }]
    case 'render':
      return [{
        path: 'render.yaml',
        content: [
          'services:',
          '  - type: web',
          '    name: site',
          '    runtime: static',
          `    buildCommand: ${install} && ${build}`,
          `    staticPublishPath: ./${out}`,
          ...(spa ? ['    routes:', '      - type: rewrite', '        source: /*', `        destination: /${SPA_DEFAULT}`] : []),
          '    envVars:',
          '      - key: NODE_VERSION',
          '        value: 22',
          '',
        ].join('\n'),
      }]
    case 'github-pages':
      return [
        {
          path: '.github/workflows/pages.yml',
          content: [
            'name: Deploy to GitHub Pages',
            '',
            'on:',
            '  push:',
            '    branches: [main]',
            '  workflow_dispatch:',
            '',
            'permissions:',
            '  contents: read',
            '  pages: write',
            '  id-token: write',
            '',
            'jobs:',
            '  build:',
            '    runs-on: ubuntu-latest',
            '    steps:',
            '      - uses: actions/checkout@v4',
            '      - uses: actions/setup-node@v4',
            '        with:',
            '          node-version: 22',
            '          cache: npm',
            `      - run: ${install}`,
            `      - run: ${build}`,
            '      - uses: actions/configure-pages@v5',
            '      - uses: actions/upload-pages-artifact@v3',
            '        with:',
            `          path: ${out}`,
            '',
            '  deploy:',
            '    needs: build',
            '    runs-on: ubuntu-latest',
            '    environment:',
            '      name: github-pages',
            '      url: ${{ steps.deployment.outputs.page_url }}',
            '    steps:',
            '      - id: deployment',
            '        uses: actions/deploy-pages@v4',
            '',
          ].join('\n'),
        },
        { path: 'public/.nojekyll', content: '' },
      ]
  }
}

/** The checklist shown in the Ship panel, so nothing is silently assumed. */
export function shipChecklist(ctx: ShipContext): string[] {
  const fw = frameworkById(ctx.framework)
  return [
    `Run the production build once: ${fw?.build ?? 'npm run build'}`,
    `Serve the built output and click through the whole app: ${fw?.dev ? 'a static server over ' + (ctx.outDir || fw?.outDir || 'dist') : 'the output directory'}`,
    'Check the deploy preview on a phone, not just on this machine.',
    'Set every environment variable in the host\'s dashboard — never in the repository.',
  ]
}

/* ---------------------- what reaches every agent prompt -------------------- */

/**
 * Does this request ask for something to be built?
 *
 * Kept deliberately narrow: the pipeline below is long, and adding it to a
 * question about history would spend the user's context on instructions that do
 * not apply. Building, designing, redesigning, shipping — those qualify.
 */
export function isBuildIntent(prompt: string): boolean {
  const p = prompt.toLowerCase()
  if (/\b(explain|what is|why does|summar(y|ise|ize)|difference between|compare)\b/.test(p) && !/\b(build|create|make|design|redesign|ship|deploy)\b/.test(p)) return false
  return /\b(build|create|make|design|redesign|restyle|prototype|ship|deploy|landing page|website|web app|mobile app|dashboard|screen|component|ui|ux|frontend|interface)\b/.test(p)
}

/**
 * The six directives, condensed for a running agent. This is the version that
 * goes into the system prompt of any build request, so the order is never left
 * to chance: research, ask, design, prototype, sweep, ship on signal.
 */
export const PIPELINE_PROMPT = `BUILD PIPELINE (in this order, every time the user asks for something built or redesigned):
1. RESEARCH IS KEY — before designing, look at how the best work solves this exact screen. Search Awwwards, Dribbble and unicorn.studio for the screen type, not for "inspiration". Name three references and the one decision each settles. Copy structure and restraint; never copy another product's identity.
2. PREMIUM IS VAGUE — do not write UI code until you know what "premium" means to this person. Ask the Design Brief questions (style, density, motion, theme, type, accent, references, must-haves, avoid-list) with the ask_user tool, 2-5 at a time. If they say "you decide", state each decision in one sentence and proceed.
3. DESIGN IS LIFE — produce two or three directions on the design board, each with a type pairing, a real palette of tokens, a motion rule and the components it uses. Pick one with the user before building it out. Install components from the provider hub instead of hand-rolling what a registry ships, and put every install line in the dependency box.
4. PROTOTYPE BEFORE PROD — build at real sizes and test them: phone 390, tablet 834, laptop 1280, TV 1920×1080. Check every microinteraction actually fires and is in sync (hover, press, focus, enter/exit, reduced-motion). Use the design tools — snapshot, audit, controls, assert — not your eyes.
5. NO CONS, JUST THE PROS — then hunt: broken layout at a size, unsynced animation, contrast below 4.5:1, tap targets under 44px, unreachable states, console errors, stale copy. Fix, re-check with a passing assert, and report only what you verified.
6. IDEA TO PRODUCTION — never deploy on your own initiative. When the user says ship, prepare the repository for the host they choose (Vercel, Netlify, Cloudflare Pages, Render, GitHub Pages) with the config files and the checklist, and tell them the one thing only they can do.`

/** The condensed pipeline, ready to append to a system prompt. */
export const pipelinePrompt = (): string => PIPELINE_PROMPT
