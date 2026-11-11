# Research Engine 0.40.0-beta.1

Two rounds in one cut: the interiors of both workspaces that the previous
release only shelled, and the six asks that came after it, each done for
real. Components are previewable inside design mode, the app goes
fullscreen, integrations ship with a step-by-step tutorial, the Library
reader can no longer crash the app, "refused to connect" has an answer in
the form of a local embedding proxy, and the composer's mode menu unfolds
sideways instead of popping over the page.

This cut folds two rounds into one tag. The first did the interiors that
the 0.39 shells promised: file-kind glyphs, a splittable bottom panel and
a current-line wash on the coding side; the glass mode switch, the grouped
toolbar, the two-tier rail and the filmstrip captures on the design side.
The second answered the six asks that came after, and every one of them
carries a check in the new r27-test, so none of them can quietly regress.

## The coding workspace, inside

- Every file wears the glyph and the theme colour of its kind, in the tree
  and in the open-file tabs: code, data, text, style, markup, image, shell,
  config, database.
- The bottom panel is a splittable pane: the gutter above it drags between
  140 and 560 px, the height is remembered per machine, and a double click
  resets it to 220.
- The editor washes the line the caret is on, and the wash rides the
  scroll, the way the reference editors do.

## The design studio, inside

- The Code/Design switch is the same glass segmented control the code page
  uses; the device bar groups into the same glass pills as the status bar.
- The eleven-tool rail is two tiers (look, build) instead of one scrolling
  row, and captures are a two-column filmstrip whose pictures carry their
  own hover actions.

## Components you can look at, in design mode

- The hub gained a preview stage. For the components this app vendors
  (SmoothUI's set and the Aceternity pieces it ships, 28 live demos) the
  real component renders in place, with a light/dark switch and an error
  boundary per demo so one bad render cannot take the studio down.
- Registries that are not vendored get the honest card: no live demo, here
  is the exact install line and the provider's page.
- Library UI hits open design mode on the hub, already searching, instead
  of a toast that pointed elsewhere.

## Fullscreen

- A top-bar toggle on the real Fullscreen API. The icon tracks the
  browser's state (F11 included) and the button is absent on shells
  without the API rather than dead.

## The integrations tutorial

- Settings → Integrations and the composer's plug menu open a wizard per
  service: what it gives you, the numbered console walk with the token's
  shape and the classic miss, the real credential form, and a Save & test
  that finishes only when the service itself says yes. All seven services
  are covered; the local files service skips the credential steps.

## The reader that cannot crash

- The source viewer normalizes every answer before it touches the render
  tree. An error body, an empty body, a missing field or a non-JSON answer
  is a failure card, never a blank page; the crash you could hit by reading
  a source is gone.

## "Refused to connect" has an answer

- A local embedding proxy (`/api/proxy`): the server fetches the page,
  drops base tags, CSP metas and frame-busters, makes subresources
  absolute and loops links back through itself, so navigation stays in the
  app. The route is SSRF-guarded by the same rule as the reader.
- Awwwards, Dribbble, Refero and the other policy-hostile hosts start on
  the proxied view with a line saying why; everything else keeps the
  direct frame, with a Direct/Proxied switch beside Reload. Design mode's
  reference browser uses the same viewer and inherits the fix.

## The composer

- The three-lines button no longer opens a menu: it unfolds the five modes
  sideways next to itself, each pill carrying its own tooltip on hover.
  Presses toggle and stay open, because modes combine.

## Numbers

- New: r27-test, 47 checks (proxy rewrite offline, hostile-list parity
  between frontend and backend, the viewer crash matrix, the embed switch,
  the mode strip, fullscreen, the tutorial walk, the demo registry).
- Green: render 857, r17 107, ui 60, library 58, integrations 51, ui-lab
  44, workbench 36, design-browse 38, ide-chrome 35, updates 34,
  resilience 33, smoke 65, bridge-pick 24 (one measurement per hover),
  resources 19, api-json 11.
- The installers below are built by CI from this tag; the portable builds
  in the repository's downloads folder carry their own SHA-256 sums.
