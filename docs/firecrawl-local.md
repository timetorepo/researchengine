# Firecrawl Local scraper integration

Working branch, 2026-11-12; not a release. This integrates the official `firecrawl-local` Rust CLI identified by the supplied quickstart:

- https://docs.firecrawl.dev/quickstarts/firecrawl-local
- https://github.com/firecrawl/firecrawl/tree/main/apps/local

Source inspected at Firecrawl repository commit `41b36dfd28ad69df7da221d1d51f3d5fb4838be3`; `apps/local/Cargo.toml` declared `firecrawl-local` 0.1.1, AGPL-3.0. Documentation/current main are mutable; this reference is evidence of the reviewed CLI contract, not a checksum of an installed binary.

## Operator setup

Install/review the official binary separately on your own host following upstream instructions (Rust and a C compiler are prerequisites for the documented Cargo install). Verify its source/version/license and provenance before configuring it. Do not substitute similarly named third-party rewrites. No binary, crate or executable is bundled/downloaded by Research Engine; this change adds no Rust or npm dependency and does not change other agents' MCP files.

Set an absolute executable path in the **backend process environment**, then restart the backend:

```
FIRECRAWL_LOCAL_BIN=/absolute/path/to/firecrawl-local
```

No executable path, shell command, arbitrary argument, credentials or policy overrides are accepted from browser requests. The administrator controls this executable; replacing it with malicious software defeats the adapter's assumptions. AGPL licensing and distribution obligations should be reviewed before bundling or distributing a binary; this change does not bundle one.

Open a web source in Library's source viewer and explicitly choose **Scrape with Firecrawl Local**. The normal reader remains the default. The explicit request is `/api/library/read?url=…&engine=firecrawl-local`; unsupported engine values are refused. Local scrape failure is displayed on the Read tab and does not automatically open Browser, invoke the default scraper or use cloud fallback. This is scraper integration, not a local search index; the existing Firecrawl search adapter is a separate hosted/self-hosted API configuration and `/v2/search` must not be advertised as cloud-free Local search.

## Enforced invocation policy

The configured binary is spawned directly (`shell:false`) with fixed arguments:

```
--browser never scrape PUBLIC_URL --public-only --timeout 12000 --format markdown
```

- `FIRECRAWL_CLOUD=off`: the documented default `auto` would permit cloud fallback, so it is never inherited.
- `FIRECRAWL_LOCAL_BROWSER=never` and `--browser never`: no Chromium installation, sandbox override, browser profile or browser subprocess is needed by this adapter. JavaScript-only pages may fail. Browser support would require separate validation; it is not silently enabled.
- Fresh per-request temporary HOME/USERPROFILE, local-home and credential-file paths; no saved Firecrawl login is reused.
- Minimal environment: PATH (plus Windows SystemRoot), temporary locations and fixed policies only. API keys, proxy variables, arbitrary cloud endpoints and other app credentials are not inherited.
- Public HTTP(S) targets without embedded credentials only. Early URL checks are backed by the official binary's `--public-only` network guard, which upstream documents as covering redirects/DNS. This upstream network guard remains a security dependency and was not live-certified here.
- Two concurrent scrapes maximum, 12-second per-page CLI timeout, 15-second outer process deadline, 2 MB combined stdout/stderr cap, abort with SIGTERM then bounded SIGKILL fallback. No automatic retry. Diagnostics returned to web callers do not expose stderr, binary paths or internal errors.
- No daemon, listening port, `init`, `login`, MCP, crawl, batch, search, output path or install command is run.
- Temporary per-request files are removed after child close. Hard-kill/power-loss cleanup and Windows process handling are unverified.

Only successful nonblocked JSON with nonempty Markdown is accepted. Cloud-labelled output is refused defensively. Scraped text is returned as a plain text reader block, not executable HTML; it is untrusted source content, not instructions or trusted agent output. Title/provenance are labelled Firecrawl Local. Markdown-specific heading/outline extraction, screenshots, rich document/image parsing and JavaScript rendering are not implemented in this adapter. Source URL is the requested URL, not a promise of verified final redirect provenance.

## Verification and limits

```
npm run firecrawl-local-test --workspace backend
LD_LIBRARY_PATH=$PWD/.cache/native-browser/libs/lib BROWSER_EXECUTABLE=/tmp/chromium node tools/design/check-firecrawl-local.mjs
```

The adapter test uses a temporary executable fixture, verifying fixed argv, isolated environment/cloud-off policy, public-target early refusal, untrusted text handling, cloud/blocked/malformed/empty/output-budget refusal, abort and concurrency limits. The browser test intercepts reader responses and verifies explicit engine choice, default-reader preservation, provenance, nonexecuted script-like text, failure without fallback and document containment at 1440/390/320px. A narrow screenshot was inspected. Browser testing is not physical-device/accessibility certification.

**Official binary live verification is outstanding.** This sandbox has no Cargo/Rust toolchain and outbound hosts exclude crates.io build dependencies. No unverified substitute or remote installer was used. Tests do not certify upstream DNS/redirect guards, executable licensing compliance, a real scrape, JS rendering, production network isolation, Windows support or power-loss cleanup. No Firecrawl account, cloud request or chargeable provider test was made.
