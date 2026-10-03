# 12 — Platform differences

Identical on both: tokens, type scale, spacing, radius, motion curves, copy,
component inventory, quality ladder semantics, latency tiers. What differs is the
mechanism. This table is the contract; when they *accidentally* diverge, the
screenshot-diff CI (brief §15) catches it.

| Concern | iOS | Android | Notes |
|---|---|---|---|
| Fonts | bundles Geist Sans/Mono via @fontsource (same as web). "HK Guise first" only exists where installed | same stack + `fontFeatureSettings` sanity on OEM fonts | mobile does *not* ship HK Guise (desktop-pref font); documented in `01` §3 |
| Back | interactive edge swipe, continues from interrupt | predictive back with system animation | `04-navigation.md` |
| Long-press menus | UIKit context menu where native, else in-app sheet | in-app sheet (Menu anchors fight the design tokens) | capability identical |
| Share | native share sheet | `ACTION_SEND` chooser | Share Studio output is the same PNG, different sheet |
| Tab bar | home-indicator inset, Dynamic Island awareness (focus timer compact = the *app's own* pill, not a system one — Android has no equivalent; that is a feature difference, shipped as such) | gesture-nav inset; 3-button nav respected | |
| Study timer | Live Activity + ActivityKit; when unavailable: push-less in-app pill | foreground service, visible dismissible notification, declared type `specialUse` (not `mediaPlayback`; honesty over reach) | FocusPill's 25/5 state machine is shared, the surface differs |
| Background jobs | BGTaskScheduler best-effort; jobs must resume on reopen; UI never promises more | WorkManager; resumable jobs; battery-optimization prompt is *not* shown (brief §11) | one job queue in `re-core`, two schedulers |
| Haptics | Core Haptics patterns | VibrationEffect + `VibrationAttributes` | pattern map in `07` |
| Secure storage | Keychain, StrongBox-equivalent (Secure Enclave) where present | Keystore + StrongBox where present; else `encryptedSharedPreferences` fallback *labelled in the security doc* | `keys.ts`/`vault.ts` (Web Crypto AES-GCM + passphrase) is the desktop today; mobile moves to OS keystore with vault passphrase as the at-rest key |
| Biometric gate on keys | Face ID / Touch ID optional | BiometricPrompt optional | same setting, OS dialogs differ |
| Text size | Dynamic Type incl. AX sizes | sp + display-size scaling | collapse rules in `02` §2 |
| Reduced motion / transparency | both honoured | animation-scale honoured; transparency n/a → treated as reduce | `06` §5 |
| Permissions | request at use, one at a time, reason preface (microphone: "This lets you dictate your question.") | runtime perms + photo picker (no full storage perm) | never at launch, both platforms |
| Model runtime | llama.cpp Metal / MLX; Apple on-device model adapter where exposed | llama.cpp Vulkan/NNAPI; AICore/Gemini Nano adapter | feature-detect, never require (brief §4.2); size classes identical |
| Web view | WKWebView | Android System WebView | quality ladder must account for the *two* compositors — thermal soak runs on both |
| Updates | App Store only; "what's new" from the same release notes; deep link | Play Store; optional APK path with `sha256sum -c`-equivalent fingerprint (repo convention in README §C) | no in-app self-updater on mobile (brief's "replaced by stores" row) |
| Telemetry | none, both | none, both | enforced by dependency policy `security.md` |
