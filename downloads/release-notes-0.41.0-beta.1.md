# Research Engine 0.41.0-beta.1

Eight asks, one cut: the wiki search bug that read out the wrong article
is fixed at its root, feeds are typeset for reading instead of shown as
XML, file icons wear their language's own mark, design-mode components
save into the Library with a one-command install-all, the coding
workspace shows its dependencies, MCP moves out of Settings into the
workspace with one-click installs, screenshots and screen recordings
become code, and the README is current again.

This round is about the parts of the app that were technically present
but not honest: a reader that resolved a wiki search to an article about
a slash character, a feed view that showed source, an explorer whose
icons were one grey family, a component hub with nowhere to keep what you
liked, and an MCP configuration that lived in Settings far from where
tool servers are used. Every fix ships with checks in the new r28-test,
so none of it can quietly regress.

## The wiki bug, fixed at the root

- Search hits link articles by their stable page id (`?curid=<id>`), and
  the reader now resolves by that id. Before, the resolver read the
  pathname of those URLs, which is `/`, and asked Wikipedia for the
  article titled `/` — which redirects to *Slash (punctuation)*. That is
  exactly how a search for "javascript wiki" came back with an article
  about punctuation.
- Bare host URLs and non-article paths now resolve to nothing instead of
  guessing, and the resolver is exported and unit-tested: curid, pageid,
  `/wiki/` titles, percent-encoded titles and garbage ids.

## Feeds that read like reading

- The reader detects RSS and Atom (root element or content type) and
  typesets them: the channel becomes the title and standfirst, every item
  becomes a heading with its date, author and link riding along, and
  descriptions lose their markup. Bodies longer than a digest are cut
  honestly, with an ellipsis.
- The Read tab labels a reduced feed "feed, typeset for reading" and the
  footer says "via the feed reader", so you always know what you are
  looking at. XML source stays in the Browser tab if you want it.

## Language marks on every file

- Twenty-five language marks ship in `public/lang-logos/` and the
  explorer's `FileGlyph` prefers them over the generic kind glyph:
  JavaScript, TypeScript, React, HTML, CSS, JSON, Markdown, Python,
  C / C++ / C#, Rust, Go, Java, Kotlin, Swift, Ruby, PHP, Vue, Svelte,
  SQL, shell, SVG, YAML and images.
- The set is an offline-safe drawn version committed to the repo, plus
  `scripts/vendor-lang-logos.mjs`, which fetches the real CC0
  simple-icons brand marks in one run on any machine with a network —
  "get it from an API once, save it to the repo", exactly.
- A mark that fails to load falls back to the kind glyph rather than
  showing a broken image.

## Components you save, and install in one go

- Every component card in the design-mode hub has a Save button. It
  writes a `component` item into the Library carrying the exact install
  command.
- Saved components in the Library show their command, open their preview
  back in design mode, and a single button copies every saved command at
  once, joined and ready to paste into a terminal.

## Dependencies, visible in the coding workspace

- A new Dependencies panel reads the open project's `package.json`
  through the backend (`/api/ide/deps`): declared versus dev, whether
  `node_modules` is present, and which lockfile pins the tree.
- Below it, a curated list of the dependencies AI coding usually reaches
  for — openai, @anthropic-ai/sdk, ollama, ai, @ai-sdk/react, zod,
  @langchain/core, hono — each with a one-click copy of its install
  command.

## MCP, where it is used

- MCP is gone from Settings. The Settings tab now only says where it
  went.
- The coding workspace rail has an MCP panel: your configured servers
  (enable, test against the live bridge, remove), a custom paste-in, and
  a curated list of recommended servers — filesystem, fetch, memory,
  sequential thinking, time, GitHub, Puppeteer, Brave search — each with
  a one-click install (inline key entry where the server needs one) and
  links out to Smithery, Glama, mcp.so and the official server repo.

## Screenshot to code, images and video

- The coding rail gained a screenshot panel. Drop an image and a vision
  model writes it back as code: a single HTML file with Tailwind, or a
  React component.
- Screen recordings work too: the panel samples up to six frames across
  the clip and asks the model to rebuild the final state.
- The result copies to the clipboard or saves into the project as
  `generated/screenshot.html` / `generated/screenshot.tsx`, and a missing
  provider key is reported honestly instead of failing silently.

## The README, current

- The dead image at the top is gone, the badge points at the current
  release, and the feature lists cover everything above — feeds, page-id
  resolution, dependencies, one-click MCP, screenshot-to-code with video
  and the UI-component shelf.

## Numbers

- New: r28-test, 67 checks (wiki id resolution, feed typesetting incl.
  Atom and escaped markup, language-mark coverage and shelf integrity,
  saved components and the copy-all, the deps route and panel, the MCP
  move, screenshot-to-code, the README).
- Green: r27 47, render 857, smoke 65, ui 60, library 58, workbench 36,
  ide-chrome 35, updates 34, resources 19, update-test 81.
- The installers below are built by CI from this tag; the portable
  builds in the repository's downloads folder carry their own SHA-256
  sums.
