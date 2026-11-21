# Optional source logos (Logo.dev)

Source logos are optional decoration, not citations, trust badges, identity verification or endorsements. Existing source-preview favicons are unchanged. Website work remains paused.

## Configuration

Operator environment (restart backend):

```
LOGO_DEV_ENABLED=1
LOGO_DEV_PUBLISHABLE_KEY=pk_your_publishable_key
```

Use only the Logo.dev **publishable CDN** key. A secret `sk_` API key is rejected. Never paste keys into AI chat. This integration supports domain-logo images, not the separate secret-key brand/search API. It does not discover companies by name. Disable by removing the enabled flag. No settings UI or secret-key storage was added.

The AI can call `source_logo` with a known public source domain/URL. The tool strips paths/queries before the same-origin descriptor request. Results contain only a local image URL, domain, attribution and evidence warning; no key. Missing configuration produces a bounded error and instructions to omit rather than invent a logo. Tool instructions prohibit bulk enumeration, fabricated identities and logo-based credibility claims.

Markdown recognizes canonical source-logo image descriptors and renders an explicit **Load … logo via Logo.dev** button, privacy notice and visible **Logos provided by Logo.dev** link. No logo image request occurs until the user clicks. Missing images display unavailable, without generated monograms. Arbitrary direct Logo.dev CDN image URLs and malformed internal logo URLs are refused by this rendering path.

The local image endpoint is a 302 URL resolver, **not an image-byte proxy**. The browser directly requests `img.logo.dev` using the publishable key. No CDN server fetch, storage, preflight or scripted scraping occurs. The key is intentionally visible in browser network traffic, never a secret. Requests carry the domain, browser network identity and origin (strict-origin-when-cross-origin referrer policy); no chat/source path is forwarded. The redirect is no-store, fixed to the provider host, with `fallback=404` and `redirect=404` to avoid fake monograms or silently substituted brands. Each load may count against the operator's plan; review plan/limits before enabling on a public instance. No automatic request retries or API discovery calls.

Official documentation reviewed: https://www.logo.dev/docs/logo-images/introduction and https://www.logo.dev/docs/platform/fair-use . The required visible attribution is retained regardless of paid/free plan. Model-generated Markdown links are not used as the sole attribution.

## Validation and limitations

- `npx tsx backend/scripts/logos-test.ts`: configuration/missing/sk-key rejection, token-free/domain-only descriptor, fixed-host no-store redirect contract, credential/private/port/domain rejection, extra query rejection. Synthetic publishable fixture; no real provider requests.
- `tools/design/check-source-logos.mjs`: actual browser execution through `executeTool`/`toolSpecs`, mocked provider descriptor then real Markdown rendering; no pre-consent image request, click-to-load, attribution/warning, direct/noncanonical refusal, invalid-input no request, unavailable and tampered descriptor refusal, narrow viewport containment.
- These tests review the tool boundary and rendering interaction. They are **not a live AI conversation/evaluation**, proof of model compliance or real Logo.dev key validation.
- No Logo.dev key was configured in the checked process environment. This sandbox's outbound network allowlist excludes Logo.dev. Live-key/provider testing and live-model behavior evaluation remain outstanding; do not report them as passed. Configure a publishable key securely and run in a network-permitted installation for live validation. Never script CDN downloads to test it; use the browser Load action.
- Domain validation is conservative syntax filtering, not DNS ownership/public-routability attestation. It performs no server network lookup and cannot cause server SSRF. User-chosen arbitrary images outside this provider retain existing Markdown behavior.
