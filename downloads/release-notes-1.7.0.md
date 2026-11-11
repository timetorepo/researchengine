## 1.7.0 — A liquid-glass intro, answers that bill every request, and new effects in onboarding

This release makes the first launch feel finished and makes the usage numbers honest. The app now opens on a liquid-glass version of its own logo. Settings can show that intro on every launch, and it is off by default. A chat answer that stops, fails or breaks off halfway is now counted, both in the message's cost and in the daily budget, so no spend goes unrecorded. Experiential Labs joins as a provider, and the keyboard is the Serenity UI mechanical keyboard.

Onboarding gains several new effects: a flip card on the privacy step, a portal carousel of the modes, a monthly-price chart drawn from the real prices of the apps it replaces, a pipeline diagram, a stack loader while setup runs, and a pixel-font headline on the final step. The Projects and Codersa tabs use a liquid-glass control, and the thinking indicator has a new typing style. Every effect is credited in Settings → About.

## What changed

- **A liquid-glass intro on the first launch.** The app's logo melts into glass and settles, with the name below it. Any key or click skips it. Settings → Appearance has "Show the intro on every launch" (off by default) and a "Play intro now" button.
- **Every answer is billed, including the ones that stop.** Tokens count toward the daily budget as each request settles. An answer you stop, a request that fails part way, and a council member that is cancelled are all counted, and the failed attempt in free routing is counted too.
- **Broken streams are visible.** An empty answer is reported as an error instead of a blank bubble. A connection that breaks mid-answer says so, and the text received so far is kept. A model that ignores streaming and returns one JSON body still shows its answer.
- **Experiential Labs is a provider.** It speaks the OpenAI-compatible API at api.experientiallabs.ai, with keys that start with xpl_. Its models come from the live model list.
- **The 3D keyboard is the Serenity UI mechanical keyboard.** It replaces the approximate keyboard from earlier builds. It is still off by default, and it still asks before it listens to keys.
- **An experimental fan gallery.** When you attach two or more images to a message, they can fan out into a carousel you hover through. It is off by default, and it is switched on in Settings → Appearance.
- **A typing loading style.** Settings → Flow → Thinking indicator now offers "Typing", which types the stage label one letter at a time under the orb.
- **New effects in onboarding.** A card flip on the privacy step, a portal carousel of the modes, a chart of monthly prices for the apps this replaces, a pipeline diagram on the demo step, a stack loader while setup runs, a block transition between steps, and a pixel-font "You're set" headline. The effects are rebuilt from their 21st.dev listings and credited in Settings → About.
- **A liquid-glass tab switch in Codersa.** Projects and Codersa use Glisse's segmented control (MIT). The routes are unchanged.
- **Credits.** Settings → About lists Glisse, Hyperiux Vault and badtzx0, and links the full notices.
